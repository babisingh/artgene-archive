"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { CertSeal } from "../../components/design/CertSeal";
import { FastaUploader } from "../../components/FastaUploader";
import type { ConsequenceReport, RegistrationResponse } from "../../lib/api";
import { useApiKey } from "../../lib/providers";

// ---------------------------------------------------------------------------
// Schema — only fields the API accepts are required; UI-only fields optional
// ---------------------------------------------------------------------------

const RegisterSchema = z.object({
  fasta:           z.string().min(10, "Paste a valid FASTA sequence (≥ 10 chars)"),
  owner_id:        z.string().min(1, "Owner ID is required"),
  ethics_code:     z.string().min(1, "Ethics code is required"),
  host_organism:   z.enum(["ECOLI", "YEAST", "CHO", "INSECT", "PLANT", "HUMAN"]),
  visibility:      z.enum(["public", "embargoed"]).default("public"),
  // UI-only — collected for display / future API support, not sent to backend
  sequence_name:   z.string().optional(),
  molecule_type:   z.string().optional(),
  generating_model:z.string().optional(),
  design_method:   z.string().optional(),
  institution:     z.string().optional(),
  abstract_text:   z.string().optional(),
});

type RegisterForm = z.infer<typeof RegisterSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const GATES = [
  { letter: "α", name: "Structural confidence (ESMFold)",          ms: 900  },
  { letter: "β", name: "Off-target homology (BLAST + ToxinPred2)", ms: 1900 },
  { letter: "γ", name: "Ecological risk (HGT + DriftRadar)",       ms: 3200 },
] as const;

const STEPPER = [
  ["01", "Sequence"],
  ["02", "Metadata"],
  ["03", "Biosafety review"],
  ["04", "Certificate"],
] as const;

const HOST_OPTIONS: [string, string][] = [
  ["ECOLI",  "E. coli BL21(DE3)"],
  ["YEAST",  "Yeast (S. cerevisiae)"],
  ["CHO",    "CHO / Mammalian"],
  ["INSECT", "Insect (Sf9)"],
  ["PLANT",  "Plant"],
  ["HUMAN",  "Human"],
];

// ---------------------------------------------------------------------------
// GateRow — animated progress bar per biosafety gate
// ---------------------------------------------------------------------------

function GateRow({
  letter, name, gateMs, running, allDone, status,
}: {
  letter: string;
  name: string;
  gateMs: number;
  running: boolean;
  allDone: boolean;
  status?: string;
}) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  // Animate bar while API is in flight
  useEffect(() => {
    if (!running) return;
    setProgress(0);
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / gateMs);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, gateMs]);

  // Snap to 100% when API returns
  useEffect(() => {
    if (allDone) setProgress(1);
  }, [allDone]);

  const isFail = status === "fail";
  const isWarn = status === "warn";
  const isSkip = status === "skip";
  const doneColor = isFail
    ? "var(--danger)"
    : isWarn
    ? "var(--warn)"
    : isSkip
    ? "var(--ink-4)"
    : "var(--verify)";
  const doneLabel = isFail ? "✗ FAIL" : isWarn ? "⚠ WARN" : isSkip ? "— SKIP" : "✓ PASS";

  return (
    <div style={{ padding: "14px 0", borderTop: "0.5px solid var(--rule-2)" }} role="listitem">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "0.5px solid var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: "var(--accent)", flexShrink: 0,
          }}>
            {letter}
          </div>
          <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{name}</span>
        </div>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: allDone ? doneColor : "var(--ink-3)",
        }}>
          {allDone
            ? doneLabel
            : progress > 0
            ? `${Math.round(progress * 100)}%`
            : "QUEUED"}
        </span>
      </div>
      <div style={{ height: 2, background: "var(--rule)", borderRadius: 1, marginTop: 10, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: allDone ? doneColor : "var(--accent)",
          transition: "width 0.1s",
        }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RegisterPage
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const { client, apiKey } = useApiKey();
  const qc = useQueryClient();

  // wizard step: 1 = FASTA, 2 = Metadata, 3 = Biosafety review, 4 = Certificate
  const [step, setStep]           = useState(1);
  const [running, setRunning]     = useState(false);  // gates animating
  const [allDone, setAllDone]     = useState(false);  // API returned + animations snapped
  const [response, setResponse]   = useState<RegistrationResponse | null>(null);
  const [report, setReport]       = useState<ConsequenceReport | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register, handleSubmit, setValue, watch, trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      host_organism: "ECOLI",
      owner_id:      "researcher@example.com",
      ethics_code:   "ETHICS-2026-001",
      fasta:         "",
      visibility:    "public",
    },
  });

  const fastaValue = watch("fasta");

  // Triggered when user submits from step 2
  async function onSubmit(data: RegisterForm) {
    if (!apiKey) {
      setSubmitError("No API key configured. Contact your administrator.");
      return;
    }
    setSubmitError(null);
    setResponse(null);
    setReport(null);
    setStep(3);
    setRunning(true);
    setAllDone(false);

    const registrationPromise = client.register({
      fasta:         data.fasta,
      owner_id:      data.owner_id,
      ethics_code:   data.ethics_code,
      host_organism: data.host_organism,
      visibility:    data.visibility,
    });

    let result: RegistrationResponse;
    try {
      // Wait for both the API and the longest gate animation (3.4 s)
      [result] = await Promise.all([registrationPromise, sleep(3400)]);
    } catch (err) {
      setRunning(false);
      setAllDone(false);
      setSubmitError(err instanceof Error ? err.message : "Registration failed. Please try again.");
      return;
    }

    setReport(result.consequence_report);
    setRunning(false);
    setAllDone(true);
    setResponse(result);
    qc.invalidateQueries({ queryKey: ["certificates"] });
  }

  // Validate only the fasta field before advancing from step 1
  async function handleStep1Continue() {
    const valid = await trigger("fasta");
    if (valid) setStep(2);
  }

  function resetToStep2() {
    setStep(2);
    setRunning(false);
    setAllDone(false);
    setResponse(null);
    setReport(null);
    setSubmitError(null);
  }

  return (
    <div className="wrap" style={{ padding: "48px 0 80px" }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <section style={{ paddingBottom: 24 }}>
        <div className="eyebrow mb-8">Deposit pathway</div>
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: 0 }}>
          Register a <em>new sequence.</em>
        </h1>
        <p className="lede mt-16" style={{ maxWidth: 640 }}>
          Four short steps. Your sequence is analyzed in under ninety seconds; a signed
          certificate is issued on pass. Submissions are free for public deposits.
        </p>
      </section>

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        borderTop: "0.5px solid var(--rule)", borderBottom: "0.5px solid var(--rule)",
        marginBottom: 40,
      }}>
        {STEPPER.map(([n, label], i) => {
          const idx    = i + 1;
          const active = step === idx;
          const past   = step > idx;
          return (
            <div key={n} style={{
              padding: "18px 24px",
              borderRight: i < 3 ? "0.5px solid var(--rule)" : "none",
              background: active ? "var(--paper-3)" : "transparent",
              opacity: past ? 0.6 : 1,
            }}>
              <div className="mono" style={{
                fontSize: 10.5, letterSpacing: "0.12em",
                color: active ? "var(--accent)" : "var(--ink-3)", marginBottom: 4,
              }}>
                {past ? "✓ " : ""}STEP {n}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Form (wraps steps 1 & 2; step 3/4 are results, not fields) ── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid-12" style={{ alignItems: "start" }}>

          {/* ── Main column ─────────────────────────────────────── */}
          <div style={{ gridColumn: "span 8" }}>

            {/* STEP 1 — FASTA input */}
            {step === 1 && (
              <div className="card">
                <div className="eyebrow mb-16">§ 01 · Sequence input</div>
                <h3 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", color: "var(--ink)" }}>
                  Paste a FASTA or drop a file
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 20 }}>
                  Accepted: FASTA, GenBank, plain DNA / RNA / protein. Up to 1,000 residues per
                  sequence (contact us for larger). We do not store rejected inputs.
                </p>

                <FastaUploader
                  value={fastaValue}
                  onChange={(v) => setValue("fasta", v, { shouldValidate: true })}
                  error={errors.fasta?.message}
                />

                <div className="flex between center mt-24">
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    All uploads are scanned locally before transmission.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleStep1Continue}
                    disabled={!fastaValue.trim()}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 — Metadata */}
            {step === 2 && (
              <div className="card">
                <div className="eyebrow mb-16">§ 02 · Metadata</div>
                <h3 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "var(--ink)" }}>
                  Describe your deposit
                </h3>

                {/* Design fields (UI-only — not submitted to API) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {([
                    ["sequence_name",    "Sequence name",    "e.g. CA-ΔT7"],
                    ["molecule_type",    "Molecule type",    "Protein / DNA / RNA"],
                    ["generating_model", "Generating model", "ESM-3 · v2.1"],
                    ["design_method",    "Design method",    "Conditional generation"],
                    ["institution",      "Institution",      "Your institution"],
                  ] as const).map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label
                        className="mono"
                        style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}
                      >
                        {label}
                      </label>
                      <input {...register(field)} className="input" placeholder={placeholder} />
                    </div>
                  ))}

                  {/* Expression host → host_organism enum */}
                  <div>
                    <label
                      htmlFor="host_organism"
                      className="mono"
                      style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}
                    >
                      Expression host
                    </label>
                    <select {...register("host_organism")} id="host_organism" className="input">
                      {HOST_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Abstract */}
                <div className="mt-24">
                  <label
                    className="mono"
                    style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}
                  >
                    Abstract / description
                  </label>
                  <textarea
                    {...register("abstract_text")}
                    style={{
                      width: "100%", minHeight: 100, padding: 12,
                      background: "var(--paper)", border: "0.5px solid var(--rule)",
                      borderRadius: 3, fontSize: 13.5, fontFamily: "var(--sans)",
                      color: "var(--ink)", resize: "vertical", outline: "none", lineHeight: 1.6,
                    }}
                    placeholder="A short description of the sequence, its intended function, how it was generated, and any wet-lab validation performed…"
                  />
                </div>

                {/* Registration credentials — required by the API */}
                <div style={{ marginTop: 24, padding: "20px 22px", background: "var(--paper-3)", border: "0.5px solid var(--rule)", borderRadius: 4 }}>
                  <div className="mono mb-16" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Registration credentials
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label htmlFor="owner_id" className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                        Owner ID *
                      </label>
                      <input {...register("owner_id")} id="owner_id" className="input" placeholder="researcher@example.com" />
                      {errors.owner_id && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }} role="alert">{errors.owner_id.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="ethics_code" className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                        Ethics code *
                      </label>
                      <input {...register("ethics_code")} id="ethics_code" className="input" placeholder="ETHICS-2026-001" />
                      {errors.ethics_code && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }} role="alert">{errors.ethics_code.message}</p>}
                    </div>
                  </div>
                </div>

                {/* CC-BY / visibility toggle */}
                <div className="mt-24 flex gap-16" style={{ background: "var(--paper-3)", padding: 16, borderRadius: 4, border: "0.5px solid var(--rule)", alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    id="visibility-public"
                    checked={watch("visibility") === "public"}
                    onChange={(e) => setValue("visibility", e.target.checked ? "public" : "embargoed")}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <label htmlFor="visibility-public" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: 13, color: "var(--ink)" }}>Publish under CC-BY-4.0 (recommended)</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Makes the record public and citable. You retain attribution.</div>
                  </label>
                </div>

                {/* Warnings */}
                {submitError && (
                  <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 16 }} role="alert">{submitError}</p>
                )}
                {!apiKey && (
                  <p style={{ fontSize: 12, color: "var(--warn)", marginTop: 12 }}>⚠ No API key configured. Contact your administrator.</p>
                )}

                <div className="flex between mt-24">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                  <button type="submit" className="btn btn-primary">Run biosafety analysis →</button>
                </div>
              </div>
            )}

            {/* STEP 3 — Biosafety review */}
            {step === 3 && (
              <div className="card" aria-live="polite" aria-atomic="true">
                <div className="eyebrow mb-16">§ 03 · Automated biosafety review</div>
                <div className="flex between center mb-24">
                  <h3 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "var(--ink)" }}>
                    {running
                      ? "Running three gates…"
                      : allDone && response?.status === "CERTIFIED"
                      ? "All gates passed"
                      : allDone
                      ? "Review complete"
                      : "Preparing…"}
                  </h3>
                  {running && (
                    <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      ● LIVE
                    </div>
                  )}
                </div>

                <div role="list">
                  {GATES.map((g) => {
                    const gateKey = g.letter === "α" ? "gate1" : g.letter === "β" ? "gate2" : "gate3";
                    const status  = allDone ? (report?.[gateKey as "gate1" | "gate2" | "gate3"]?.status ?? "pass") : undefined;
                    return (
                      <GateRow
                        key={g.letter}
                        letter={g.letter}
                        name={g.name}
                        gateMs={g.ms}
                        running={running}
                        allDone={allDone}
                        status={status}
                      />
                    );
                  })}
                </div>

                {/* All gates passed → invite user to mint */}
                {allDone && response?.status === "CERTIFIED" && (
                  <div style={{ marginTop: 24, padding: "20px 22px", background: "color-mix(in oklab, var(--verify) 10%, var(--paper-2))", border: "0.5px solid color-mix(in oklab, var(--verify) 30%, transparent)", borderRadius: 4 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--verify)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                      Tier 1 · Unrestricted · Ready to certify
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 16px" }}>
                      Your sequence passed all three biosafety gates. Proceed to mint the certificate and receive your AG-ID.
                    </p>
                    <button type="button" className="btn btn-accent" onClick={() => setStep(4)}>
                      Mint certificate →
                    </button>
                  </div>
                )}

                {/* Gate failure */}
                {allDone && response && response.status !== "CERTIFIED" && (
                  <div style={{ marginTop: 24, padding: "20px 22px", background: "color-mix(in oklab, var(--danger) 8%, var(--paper-2))", border: "0.5px solid color-mix(in oklab, var(--danger) 30%, transparent)", borderRadius: 4 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--danger)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                      Registration {response.status}
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 16px" }}>
                      {response.message ?? "One or more biosafety gates failed. Review the results and revise your sequence."}
                    </p>
                    <button type="button" className="btn btn-ghost" onClick={resetToStep2}>
                      ← Revise and resubmit
                    </button>
                  </div>
                )}

                {/* Network / API error */}
                {submitError && !running && (
                  <div style={{ marginTop: 24, padding: "16px 20px", background: "color-mix(in oklab, var(--danger) 8%, var(--paper-2))", border: "0.5px solid color-mix(in oklab, var(--danger) 30%, transparent)", borderRadius: 4 }}>
                    <p style={{ fontSize: 13.5, color: "var(--danger)", margin: "0 0 12px" }} role="alert">{submitError}</p>
                    <button type="button" className="btn btn-ghost" onClick={resetToStep2}>← Back to form</button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4 — Certificate issued */}
            {step === 4 && response && (
              <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                  <CertSeal size={200} />
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
                  Certificate issued
                </div>
                <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 40px)", margin: "0 0 14px" }}>
                  Your accession is<br /><em>{response.registry_id ?? "—"}</em>
                </h2>
                <p style={{ fontSize: 15, color: "var(--ink-2)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.6 }}>
                  The record is now public. A watermark has been embedded in the coding sequence
                  and the certificate has been anchored to the ledger.
                </p>
                <div className="flex gap-12" style={{ justifyContent: "center" }}>
                  {response.registry_id && (
                    <Link href={`/sequences/${response.registry_id}`} className="btn btn-primary">
                      View record →
                    </Link>
                  )}
                  {/* Download wires to /certificates/:id/export — registry_id lookup needed */}
                  <button type="button" className="btn btn-ghost">↓ Download certificate</button>
                </div>
              </div>
            )}

          </div>{/* end main column */}

          {/* ── Sidebar ─────────────────────────────────────────── */}
          <aside style={{ gridColumn: "span 4" }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="mono mb-16" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                The three gates
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                {([
                  ["α", "Structural",  "ESMFold pLDDT ≥ 0.70"],
                  ["β", "Off-target",  "BLAST vs. pathogen DB. ToxinPred2 < 0.4"],
                  ["γ", "Ecological",  "HGT probability < 0.25. DriftRadar."],
                ] as const).map(([L, n, d]) => (
                  <div key={L} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      border: "0.5px solid var(--ink)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, color: "var(--accent)", flexShrink: 0,
                    }}>
                      {L}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{n}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.4, marginTop: 1 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card mt-16" style={{ padding: 20 }}>
              <div className="mono mb-8" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Need help?
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55, margin: "0 0 12px" }}>
                First-time depositors can request a walkthrough from the Consortium office.
              </p>
              <Link href="/getting-started" className="btn btn-ghost btn-sm">Read the docs →</Link>
            </div>
          </aside>

        </div>{/* end grid-12 */}
      </form>
    </div>
  );
}
