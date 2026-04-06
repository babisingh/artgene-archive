"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GLP-1 example (from tinsel-demo sequence 01)
// ---------------------------------------------------------------------------
const GLP1_EXAMPLE = `>NB-GLP1-047 GLP-1 receptor agonist variant | organism:synthetic | host:ecoli | ethics:ETHICS-GLP1-2026-001
MAEQKLISEEDLNFPSTEKIQLLKEELDLFLQTSSKELEEVIQKLAELEQLRNNAEKLEAKKLEEQSQQAL
RSEISHLRELFQILEKLWQATAEEIAQQLERQLQEQAEQLRQQLQEQLKTLVEQDKRLKLELEELAALQKE
LEQQLEQERLQLAKEELDLFLQTAAKELEENAEQKLQEELDAFLQTSSKELEEVIAKLSELQEQLRNNAEQL
EAKKLEEQSETESKRQFMQEHNRRSGTSSATASSRLQGSRSKLHTHAVPANKALENRWQQLVKGRLFPRGI
ESGVQHFTTEFRQAAASTLKKLVQELKEQLEDLRQFMQEHNRRSGTSSATASSRLQ`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function looksLikeFasta(text: string): boolean {
  const lines = text.trim().split("\n");
  return lines.some((l) => l.trimStart().startsWith(">"));
}

function countResidues(text: string): number {
  return text
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">") && l.trim() !== "")
    .join("")
    .replace(/\s/g, "").length;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FastaUploaderProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FastaUploader({ value, onChange, error, disabled }: FastaUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => onChange(ev.target?.result as string ?? "");
        reader.readAsText(file);
      }
    },
    [disabled, onChange]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => onChange(ev.target?.result as string ?? "");
        reader.readAsText(file);
      }
    },
    [onChange]
  );

  const residues = value ? countResidues(value) : 0;
  const valid = value ? looksLikeFasta(value) : null;

  return (
    <div className="space-y-2">
      {/* Drop zone + textarea */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
            : error
              ? "border-red-400"
              : "border-slate-300 dark:border-slate-600"
        }`}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={7}
          spellCheck={false}
          placeholder={`Paste FASTA here or drag-and-drop a .fasta file\n\n>SEQUENCE_ID description\nMSEQUENCEHERE...`}
          className="input w-full font-mono text-xs border-0 bg-transparent rounded-lg resize-y
                     focus:ring-0 focus:ring-offset-0 placeholder:text-slate-400"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-blue-50/80 dark:bg-blue-900/40">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Drop .fasta file here
            </span>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* File picker */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="btn-secondary text-xs py-1 px-2"
        >
          Browse file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".fasta,.fa,.faa,.fna,.ffn,.frn,text/plain"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Load example */}
        <button
          type="button"
          onClick={() => onChange(GLP1_EXAMPLE)}
          disabled={disabled}
          className="btn-secondary text-xs py-1 px-2"
        >
          Load GLP-1 example
        </button>

        {/* Residue count / validation feedback */}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {value ? (
            valid ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ {residues.toLocaleString()} residues
              </span>
            ) : (
              <span className="text-amber-500">⚠ No FASTA header detected</span>
            )
          ) : (
            "0 residues"
          )}
        </span>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
