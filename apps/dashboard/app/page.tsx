"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface GateResult {
  gate_name: string;
  status: "pass" | "fail" | "warn" | "skip";
  score: number | null;
  message: string | null;
}

interface PipelineResult {
  sequence_id: string;
  overall_status: "pass" | "fail" | "warn" | "skip";
  gates: GateResult[];
  passed_gates: number;
  failed_gates: number;
  warned_gates: number;
}

const STATUS_COLOR: Record<string, string> = {
  pass: "#16a34a",
  fail: "#dc2626",
  warn: "#d97706",
  skip: "#6b7280",
};

export default function HomePage() {
  const [sequenceId, setSequenceId] = useState("seq-001");
  const [sequence, setSequence] = useState("MAEQKLISEEDLNFPSTEKIQLLKEELDLFLQ");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runGates() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/gates/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence_id: sequenceId, sequence }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Sequence Gate Analysis</h1>

      <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
        Sequence ID
      </label>
      <input
        value={sequenceId}
        onChange={(e) => setSequenceId(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem", boxSizing: "border-box" }}
      />

      <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
        Protein Sequence
      </label>
      <textarea
        rows={4}
        value={sequence}
        onChange={(e) => setSequence(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", fontFamily: "monospace", boxSizing: "border-box" }}
      />

      <button
        onClick={runGates}
        disabled={loading || !sequence.trim()}
        style={{
          marginTop: "1rem",
          padding: "0.6rem 1.5rem",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "1rem",
        }}
      >
        {loading ? "Running…" : "Run Gates"}
      </button>

      {error && (
        <p style={{ color: "#dc2626", marginTop: "1rem" }}>Error: {error}</p>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>
            Result:{" "}
            <span style={{ color: STATUS_COLOR[result.overall_status] }}>
              {result.overall_status.toUpperCase()}
            </span>
          </h2>
          <p style={{ color: "#64748b", margin: "0 0 1rem" }}>
            {result.passed_gates} passed · {result.warned_gates} warned ·{" "}
            {result.failed_gates} failed
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Gate</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {result.gates.map((g) => (
                <tr key={g.gate_name} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{g.gate_name}</td>
                  <td style={{ padding: "0.5rem", color: STATUS_COLOR[g.status], fontWeight: 600 }}>
                    {g.status.toUpperCase()}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
                    {g.message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
