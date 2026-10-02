import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
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
import { selectCanUndo, selectDirty, useConfigurationStore } from "../store/configurationStore.ts";
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
  const dirty = useConfigurationStore(selectDirty);
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
  const suspended = Boolean(routeId && routeId !== configurationId && failedRoute !== routeId);

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
    void listRules()
      .then((response) => {
        if (cancelled) return;
        const merged = new Map(useConfigurationStore.getState().customRules.map((rule) => [rule.id, rule]));
        for (const entry of response.rules) {
          const compiled = compileRuleSource(entry.dsl);
          const rule = compiled.rules[0];
          if (compiled.errors.length === 0 && compiled.rules.length === 1 && rule) merged.set(rule.id, rule);
        }
        setCustomRules([...merged.values()]);
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

  const persist = async (): Promise<string | null> => {
    if (!dirty && configurationId) return configurationId;
    setSaving(true);
    try {
      const saved = await saveConfiguration(config, title || "Untitled configuration");
      markSaved(saved.id);
      navigate(`/configure/${saved.id}`, { replace: true });
      setBanner(null);
      return saved.id;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "The configuration could not be saved.";
      setBanner(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const id = await persist();
    if (!id) return;
    const url = `${window.location.origin}/configure/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setBanner(`Link copied: ${url}`);
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
        canUndo={canUndo}
        canRedo={canRedo}
        saving={saving}
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
              suspended={suspended}
              onReset={() => setResetSignal((value) => value + 1)}
            />
          </ViewportErrorBoundary>
        </div>
        <div className="order-3 min-h-0 lg:overflow-y-auto">
          <SummaryPanel evaluation={evaluation} specification={specification} rules={rules} exporting={exporting} onExport={() => void exportPdf()} />
        </div>
      </main>
      <Outlet />
    </div>
  );
}
