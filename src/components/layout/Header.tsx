import { Redo2, Share2, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { displayConfigurationId } from "../../engine/specification.ts";
import type { ConfigStatus } from "../../engine/types.ts";

interface HeaderProps {
  title: string;
  configurationId: string | null;
  status: ConfigStatus;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  onTitle: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onShare: () => void;
}

const STATUS_CLASS = {
  ready: "bg-ok-soft text-ok",
  warning: "bg-warn-soft text-warn",
  invalid: "bg-bad-soft text-bad",
} as const;

export function Header({
  title,
  configurationId,
  status,
  canUndo,
  canRedo,
  saving,
  onTitle,
  onUndo,
  onRedo,
  onSave,
  onShare,
}: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-black/40 bg-header px-4 py-3 text-panel">
      <Link to="/" className="mr-2 leading-tight">
        <span className="block font-mono text-[11px] tracking-[0.18em]">KIT ENGINE</span>
        <span className="text-[12px] text-white/60">Shelving configurator</span>
      </Link>
      <label className="min-w-40 flex-1">
        <span className="sr-only">Configuration title</span>
        <input
          className="w-full border border-white/15 bg-white/5 px-2 py-1 text-[13px] text-panel"
          value={title}
          maxLength={80}
          onChange={(event) => onTitle(event.target.value)}
        />
      </label>
      <p className="font-mono text-[12px] text-white/70">{displayConfigurationId(configurationId)}</p>
      <p className={`px-2 py-1 font-mono text-[11px] tracking-wide ${STATUS_CLASS[status.code]}`} aria-live="polite">
        {status.label}
        <span className="sr-only">. {status.detail}</span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="border border-white/20 p-2 disabled:opacity-40" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={16} aria-hidden="true" />
        </button>
        <button type="button" className="border border-white/20 p-2 disabled:opacity-40" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={16} aria-hidden="true" />
        </button>
        <button type="button" className="border border-white/20 px-3 py-2 text-[13px] disabled:opacity-40" disabled={saving} onClick={onSave}>
          Save
        </button>
        <button type="button" className="flex items-center gap-2 border border-white/20 px-3 py-2 text-[13px] disabled:opacity-40" disabled={saving} onClick={onShare}>
          <Share2 size={14} aria-hidden="true" />
          Share
        </button>
      </div>
    </header>
  );
}
