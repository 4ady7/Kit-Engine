import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { ApiError, listRules, loadConfiguration, saveConfiguration } from "../api/client.ts";
import { Header } from "../components/layout/Header.tsx";
import { SummaryPanel } from "../components/layout/SummaryPanel.tsx";
import { ParameterPanel } from "../components/parameters/ParameterPanel.tsx";
import { Viewport } from "../components/configurator/Viewport.tsx";
import { ViewportErrorBoundary } from "../components/configurator/ViewportErrorBoundary.tsx";
import { highlightedParts } from "../engine/highlight.ts";
import { compileRuleSource, builtinRules } from "../engine/ruleEngine.ts";
import { buildSpecification } from "../engine/specification.ts";
import { parseConfigurationDocument } from "../engine/serialize.ts";
import { downloadQuote } from "../pdf/downloadQuote.tsx";
import { captureViewport } from "../scene/capture.ts";
import { sharedRouteState } from "./routeState.ts";
import { cloneConfiguration } from "../engine/parameters.ts";
import { displayConfigurationId } from "../engine/specification.ts";
import { mergeRemoteRules, saveMatchesScreen, selectCanUndo, selectDirty, useConfigurationStore } from "../store/configurationStore.ts";
import { useEvaluation } from "../store/useEvaluation.ts";

const quotedAt = new Date();

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

export function Configurator() {
  const routeId = useParams().id;
  const navigate = useNavigate();
  const evaluation = useEvaluation();
  const config = useConfigurationStore((state) => state.config);
  const title = useConfigurationStore((state) => state.title);
  const configurationId = useConfigurationStore((state) => state.configurationId);
  const customRules = useConfigurationStore((state) => state.customRules);
  const canUndo = useConfigurationStore(selectCanUndo);
  const canRedo = useConfigurationStore((state) => state.future.length > 0);
  const undo = useConfigurationStore((state) => state.undo);
  const redo = useConfigurationStore((state) => state.redo);
  const setTitle = useConfigurationStore((state) => state.setTitle);
  const markSaved = useConfigurationStore((state) => state.markSaved);
  const replaceConfiguration = useConfigurationStore((state) => state.replaceConfiguration);
  const setCustomRules = useConfigurationStore((state) => state.setCustomRules);
  const [resetSignal, setResetSignal] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [failedRoute, setFailedRoute] = useState<string | null>(null);
  const routeState = sharedRouteState(routeId, configurationId, failedRoute);

  const rules = useMemo(() => [...builtinRules, ...customRules], [customRules]);
  const specification = useMemo(
    () => buildSpecification({ id: configurationId, title, config, evaluation, generatedAt: quotedAt }),
    [configurationId, title, config, evaluation],
  );
  const highlighted = useMemo(
    () => highlightedParts([...evaluation.errors, ...evaluation.warnings]),
    [evaluation.errors, evaluation.warnings],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) useConfigurationStore.getState().redo();
        else useConfigurationStore.getState().undo();
      } else if (!meta && event.key.toLowerCase() === "r") {
        event.preventDefault();
        setResetSignal((value) => value + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const epochAtRequest = useConfigurationStore.getState().rulesEpoch;
    void listRules()
      .then((response) => {
        if (cancelled) return;
        const remote = [];
        for (const entry of response.rules) {
          const compiled = compileRuleSource(entry.dsl);
          const rule = compiled.rules[0];
          if (compiled.errors.length === 0 && compiled.rules.length === 1 && rule) remote.push(rule);
        }
        const merged = mergeRemoteRules(
          useConfigurationStore.getState().customRules,
          remote,
          epochAtRequest,
          useConfigurationStore.getState().rulesEpoch,
        );
        if (merged) setCustomRules(merged);
      })
      .catch(() => {
        if (!cancelled) setBanner("Custom rules could not be loaded from the server. Using the rules stored on this device.");
      });
    return () => {
      cancelled = true;
    };
  }, [setCustomRules]);

  useEffect(() => {
    if (!routeId || routeId === configurationId) return;
    let cancelled = false;
    void loadConfiguration(routeId)
      .then((saved) => {
        if (cancelled) return;
        const parsed = parseConfigurationDocument({ version: 1, title: saved.title, parameters: saved.parameters });
        if (!parsed.ok) {
          setFailedRoute(routeId);
          setBanner(parsed.message);
          return;
        }
        replaceConfiguration(parsed.document.parameters, { id: saved.id, title: saved.title });
        setBanner(null);
        setResetSignal((value) => value + 1);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailedRoute(routeId);
        const message = error instanceof ApiError ? error.message : "This shared configuration could not be loaded.";
        setBanner(message);
      });
    return () => {
      cancelled = true;
    };
  }, [routeId, configurationId, replaceConfiguration]);

  const persist = async (): Promise<{ id: string; matchesScreen: boolean } | null> => {
    const snapshot = useConfigurationStore.getState();
    if (!selectDirty(snapshot) && snapshot.configurationId) {
      return { id: snapshot.configurationId, matchesScreen: true };
    }
    const savedConfig = cloneConfiguration(snapshot.config);
    const savedTitle = snapshot.title;
    setSaving(true);
    try {
      const saved = await saveConfiguration(savedConfig, savedTitle || "Untitled configuration");
      const latest = useConfigurationStore.getState();
      const matchesScreen = saveMatchesScreen(savedConfig, savedTitle, latest.config, latest.title);
      if (matchesScreen) {
        markSaved(saved.id);
        navigate(`/configure/${saved.id}`, { replace: true });
        setBanner(null);
      } else {
        setBanner(`Saved the earlier version as ${displayConfigurationId(saved.id)}. This screen has newer edits that were not saved.`);
      }
      return { id: saved.id, matchesScreen };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "The configuration could not be saved.";
      setBanner(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const saved = await persist();
    if (!saved) return;
    const url = `${window.location.origin}/configure/${saved.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setBanner(saved.matchesScreen
        ? `Link copied: ${url}`
        : `Link copied for the saved version, not the newer edits on screen: ${url}`);
    } catch {
      setBanner(`Copy this link: ${url}`);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const model = buildSpecification({
        id: configurationId,
        title,
        config,
        evaluation,
        generatedAt: new Date(),
      });
      await downloadQuote(model, captureViewport());
      setBanner(null);
    } catch {
      setBanner("The PDF could not be generated.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink lg:h-dvh lg:overflow-hidden">
      <a href="#parameters" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-panel focus:px-3 focus:py-2">
        Skip to parameters
      </a>
      <Header
        title={title}
        configurationId={configurationId}
        status={evaluation.status}
        canUndo={routeState === "ready" && canUndo}
        canRedo={routeState === "ready" && canRedo}
        saving={saving || routeState !== "ready"}
        pendingLabel={routeState === "loading" ? "LOADING" : routeState === "failed" ? "NOT LOADED" : null}
        onTitle={setTitle}
        onUndo={undo}
        onRedo={redo}
        onSave={() => void persist()}
        onShare={() => void share()}
      />
      {banner ? (
        <div className="border-b border-line bg-copper-soft px-4 py-2 text-[13px]" role="status">
          {banner}
        </div>
      ) : null}
      {routeState !== "ready" ? (
        <main className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="font-mono text-[12px] tracking-wide text-muted uppercase">
              {routeState === "loading" ? "Loading configuration" : "Configuration unavailable"}
            </p>
            <p className="mt-2 max-w-md text-[14px]">
              {routeState === "loading"
                ? "The shared configuration is being loaded. Rules and price will be calculated after it arrives."
                : "This link could not be loaded. The configuration on screen was not replaced."}
            </p>
            <Link className="mt-4 inline-block border border-ink px-3 py-2 text-[13px]" to="/">
              Back to the configurator
            </Link>
          </div>
        </main>
      ) : null}
      {routeState === "ready" ? (
      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_380px] lg:grid-rows-1 lg:overflow-hidden">
        <div id="parameters" className="order-2 min-h-0 lg:order-1 lg:overflow-y-auto">
          <ParameterPanel evaluation={evaluation} onPreset={() => setResetSignal((value) => value + 1)} />
        </div>
        <div className="order-1 h-[46vh] min-h-[320px] lg:order-2 lg:h-full lg:min-h-0">
          <ViewportErrorBoundary>
            <Viewport
              config={config}
              derived={evaluation.derived}
              highlighted={highlighted}
              resetSignal={resetSignal}
              suspended={false}
              onReset={() => setResetSignal((value) => value + 1)}
            />
          </ViewportErrorBoundary>
        </div>
        <div className="order-3 min-h-0 lg:overflow-y-auto">
          <SummaryPanel evaluation={evaluation} specification={specification} rules={rules} exporting={exporting} onExport={() => void exportPdf()} />
        </div>
      </main>
      ) : null}
      <Outlet />
    </div>
  );
}
