"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CertificateCard } from "../../components/CertificateCard";
import { FastaUploader } from "../../components/FastaUploader";
import { GateProgressTracker, type RunPhase } from "../../components/GateProgressTracker";
import type { ConsequenceReport, RegistrationResponse } from "../../lib/api";
import { useApiKey } from "../../lib/providers";

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const RegisterSchema = z.object({
  fasta: z.string().min(10, "Paste a valid FASTA sequence (≥ 10 chars)"),
  owner_id: z.string().min(1, "Owner ID is required"),
  // org_id is NOT in the form — it is derived server-side from the API key.
  ethics_code: z.string().min(1, "Ethics code is required"),
  host_organism: z.enum(["ECOLI", "YEAST", "CHO", "INSECT", "PLANT", "HUMAN"]),
  visibility: z.enum(["public", "embargoed"]).default("public"),
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
  const { client } = useApiKey();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<RunPhase>("idle");
  const [response, setResponse] = useState<RegistrationResponse | null>(null);
  const [report, setReport] = useState<ConsequenceReport | null>(null);
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
      ethics_code: "ETHICS-2026-001",
      fasta: "",
      visibility: "public",
    },
  });

  const fastaValue = watch("fasta");

  async function onSubmit(data: RegisterForm) {
    setSubmitError(null);
    setResponse(null);
    setReport(null);

    // ── Animate: Gate 1 ───────────────────────────────────────────────────
    setPhase("gate1");

    // Fire the actual API call in parallel with the animation
    const registrationPromise = client.register({
      fasta: data.fasta,
      owner_id: data.owner_id,
      ethics_code: data.ethics_code,
      host_organism: data.host_organism,
      visibility: data.visibility,
      // org_id intentionally omitted — server derives it from the API key.
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
          Submit a FASTA sequence for biosafety certification and provenance tracing.
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
                  <label htmlFor="owner_id" className="label">
                    Owner ID / Email <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input {...register("owner_id")} id="owner_id" className="input" disabled={busy}
                    placeholder="researcher@example.com" />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Email or username of the submitting researcher.
                  </p>
                  {errors.owner_id && (
                    <p className="mt-1 text-xs text-red-500" role="alert">{errors.owner_id.message}</p>
                  )}
                </div>

                <div className="flex flex-col justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  <div className="font-semibold mb-0.5">Organisation</div>
                  Derived automatically from your API key. The sequence will be registered under the organisation that issued your key. Contact your administrator if you need to register under a different organisation.
                </div>

                <div>
                  <label htmlFor="ethics_code" className="label">
                    Ethics Code <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input {...register("ethics_code")} id="ethics_code" className="input" disabled={busy}
                    placeholder="e.g. ERC-2026-001" />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    IRB / ethics committee approval reference number.
                  </p>
                  {errors.ethics_code && (
                    <p className="mt-1 text-xs text-red-500" role="alert">{errors.ethics_code.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="host_organism" className="label">
                    Host Organism <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <select {...register("host_organism")} id="host_organism" className="input" disabled={busy}>
                    <option value="ECOLI">E. coli</option>
                    <option value="YEAST">Yeast (S. cerevisiae)</option>
                    <option value="CHO">CHO / Mammalian</option>
                    <option value="INSECT">Insect (Sf9)</option>
                    <option value="PLANT">Plant</option>
                    <option value="HUMAN">Human</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Intended expression system — affects biosafety gate thresholds.
                  </p>
                </div>
              </div>
              {/* Visibility */}
              <div>
                <label htmlFor="visibility" className="label">Visibility</label>
                <select {...register("visibility")} id="visibility" className="input" disabled={busy}>
                  <option value="public">Public — visible to all organisations</option>
                  <option value="embargoed">Embargoed — visible to your org only until published</option>
                </select>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Embargoed certificates are registered but hidden from other organisations.
                  You can publish them later from the certificate detail page.
                </p>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Fields marked <span className="text-red-500">*</span> are required.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy || !fastaValue.trim()}
              aria-busy={busy}
              className="btn-primary w-full justify-center py-3 text-base"
              data-testid="submit-register"
            >
              {busy ? "Running biosafety gates…" : "Register Sequence"}
            </button>

            {submitError && (
              <p className="text-sm text-red-500" role="alert">{submitError}</p>
            )}

          </form>
        </div>

        {/* ── Right: Progress + Result ────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Gate progress tracker — always visible once started */}
          {phase !== "idle" && (
            <div className="card p-4" aria-live="polite" aria-atomic="true">
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
              <p>Four biosafety gates run automatically after submission:</p>
              <ol className="text-left space-y-1 text-xs">
                <li>1. Structural (ESMFold pLDDT)</li>
                <li>2. Off-Target (SecureDNA + IBBIS)</li>
                <li>3. Ecological (Codon bias + HGT)</li>
                <li>4. Embedding (Sequence fingerprint)</li>
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

          {response.status === "CERTIFIED" && response.registry_id && (
            <div className="card p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
              <span className="text-blue-700 dark:text-blue-300">
                Sequence certified.{" "}
                <a
                  href={`/sequences/${response.registry_id}`}
                  className="font-semibold underline"
                >
                  Open the sequence detail page
                </a>{" "}
                to issue fingerprinted distribution copies via the Provenance Tracing tab.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
