"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CertificateCard } from "../../components/CertificateCard";
import { CodonBiasChart } from "../../components/CodonBiasChart";
import { FastaUploader } from "../../components/FastaUploader";
import { GateProgressTracker, type RunPhase } from "../../components/GateProgressTracker";
import type { ConsequenceReport, RegistrationResponse, WatermarkMetadata } from "../../lib/api";
import { useApiKey } from "../../lib/providers";

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const RegisterSchema = z.object({
  fasta: z.string().min(10, "Paste a valid FASTA sequence (≥ 10 chars)"),
  owner_id: z.string().min(1, "Owner ID is required"),
  org_id: z.string().min(1, "Organisation ID is required"),
  ethics_code: z.string().min(1, "Ethics code is required"),
  host_organism: z.enum(["ECOLI", "YEAST", "MAMMALIAN", "INSECT", "PLANT", "HUMAN"]),
});

type RegisterForm = z.infer<typeof RegisterSchema>;

// ---------------------------------------------------------------------------
// Sleep helper for animation pacing
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const { client, apiKey } = useApiKey();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<RunPhase>("idle");
  const [response, setResponse] = useState<RegistrationResponse | null>(null);
  const [report, setReport] = useState<ConsequenceReport | null>(null);
  const [watermark, setWatermark] = useState<WatermarkMetadata | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      host_organism: "ECOLI",
      owner_id: "researcher@example.com",
      org_id: "00000000-0000-0000-0000-000000000001",
      ethics_code: "ETHICS-2026-001",
      fasta: "",
    },
  });

  const fastaValue = watch("fasta");

  async function onSubmit(data: RegisterForm) {
    if (!apiKey) {
      setSubmitError("Set your API key in the top navigation before registering.");
      return;
    }
    setSubmitError(null);
    setResponse(null);
    setReport(null);

    // ── Animate: Gate 1 ───────────────────────────────────────────────────
    setPhase("gate1");

    // Fire the actual API call in parallel with the animation
    const registrationPromise = client.register({
      fasta: data.fasta,
      owner_id: data.owner_id,
      org_id: data.org_id,
      ethics_code: data.ethics_code,
      host_organism: data.host_organism,
    });

    // Minimum display time for Gate 1 stage
    await sleep(900);

    let result: RegistrationResponse;
    try {
      result = await registrationPromise;
    } catch (err) {
      setPhase("idle");
      setSubmitError(err instanceof Error ? err.message : "Registration failed");
      return;
    }

    // ── Animate: Gates 2+3 (only if Gate 1 passed) ────────────────────────
    const gate1Failed = result.consequence_report?.gate1?.status === "fail";
    if (!gate1Failed) {
      setPhase("gates23");
      await sleep(700);
    }

    // ── Done ──────────────────────────────────────────────────────────────
    setReport(result.consequence_report);
    setPhase("done");
    setResponse(result);

    // Invalidate certificate list so registry page refreshes
    qc.invalidateQueries({ queryKey: ["certificates"] });

    // Fetch full certificate to get watermark_metadata for CodonBiasChart
    if (result.status === "CERTIFIED" && result.registry_id) {
      try {
        const cert = await client.getCertificate(result.registry_id);
        setWatermark(cert.watermark_metadata);
      } catch {
        // Non-fatal — chart just won't render
      }
    }
  }

  const busy = phase !== "idle" && phase !== "done";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Register Sequence
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Submit a FASTA sequence for TINSEL watermarking and biosafety certification.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Form ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* FASTA upload */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                1. FASTA Sequence
              </h2>
              <FastaUploader
                value={fastaValue}
                onChange={(v) => setValue("fasta", v, { shouldValidate: true })}
                error={errors.fasta?.message}
                disabled={busy}
              />
            </div>

            {/* Metadata */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                2. Registration Metadata
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Owner ID / Email</label>
                  <input {...register("owner_id")} className="input" disabled={busy} />
                  {errors.owner_id && (
                    <p className="mt-1 text-xs text-red-500">{errors.owner_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Organisation UUID</label>
                  <input
                    {...register("org_id")}
                    className="input font-mono text-xs"
                    disabled={busy}
                  />
                  {errors.org_id && (
                    <p className="mt-1 text-xs text-red-500">{errors.org_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Ethics Code</label>
                  <input {...register("ethics_code")} className="input" disabled={busy} />
                  {errors.ethics_code && (
                    <p className="mt-1 text-xs text-red-500">{errors.ethics_code.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Host Organism</label>
                  <select {...register("host_organism")} className="input" disabled={busy}>
                    <option value="ECOLI">E. coli</option>
                    <option value="YEAST">Yeast</option>
                    <option value="CHO">CHO / Mammalian</option>
                    <option value="INSECT">Insect (Sf9)</option>
                    <option value="PLANT">Plant</option>
                    <option value="HUMAN">Human</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy || !fastaValue.trim()}
              className="btn-primary w-full justify-center py-3 text-base"
              data-testid="submit-register"
            >
              {busy ? "Running biosafety gates…" : "Register Sequence"}
            </button>

            {submitError && (
              <p className="text-sm text-red-500">{submitError}</p>
            )}

            {!apiKey && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ No API key set. Click "Set API Key" in the navigation bar.
              </p>
            )}
          </form>
        </div>

        {/* ── Right: Progress + Result ────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Gate progress tracker — always visible once started */}
          {phase !== "idle" && (
            <div className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Biosafety Pipeline
              </h2>
              <GateProgressTracker phase={phase} report={report} />
            </div>
          )}

          {/* Idle state hint */}
          {phase === "idle" && (
            <div className="card p-5 text-sm text-slate-500 dark:text-slate-400 text-center space-y-2">
              <div className="text-3xl">🛡️</div>
              <p>Three biosafety gates run automatically after submission:</p>
              <ol className="text-left space-y-1 text-xs">
                <li>1. Structural (ESMFold pLDDT)</li>
                <li>2. Off-Target (BLAST + ToxinPred2)</li>
                <li>3. Ecological (HGT + DriftRadar)</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* ── Certificate result (full-width) ─────────────────────────────── */}
      {response && phase === "done" && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Registration Result
          </h2>
          <CertificateCard response={response} />

          {/* CodonBiasChart — shown when watermark_metadata is loaded */}
          {response.status === "CERTIFIED" && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Codon Bias Analysis
                </h3>
                {response.registry_id && (
                  <a
                    href={`/sequences/${response.registry_id}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View full certificate →
                  </a>
                )}
              </div>
              {watermark ? (
                <CodonBiasChart watermark={watermark} />
              ) : (
                <div className="flex items-center justify-center h-24 gap-2 text-slate-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  <span className="text-sm">Loading codon data…</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
