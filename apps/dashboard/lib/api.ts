/**
 * Typed API client for the TINSEL sentinel_api backend.
 * All routes are under /api/v1. Authentication via X-API-Key header.
 */

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

const BASE = `${API_URL}/api/v1`;

// ---------------------------------------------------------------------------
// Response types — mirror Pydantic schemas from sentinel_api
// ---------------------------------------------------------------------------

export type GateStatus = "pass" | "fail" | "warn" | "skip";
export type CertificateStatus = "CERTIFIED" | "FAILED" | "PENDING";

export interface Gate1Result {
  status: GateStatus;
  plddt_mean: number | null;
  plddt_low_fraction: number | null;
  delta_mfe: number | null;
  message: string | null;
  // Rich visualization fields
  plddt_per_residue: number[] | null;
  instability_index: number | null;
  sequence_length: number | null;
}

export interface BlastHit {
  motif: string;
  description: string;
  position: number;
  mismatches: number;
  score: number;
}

export interface Gate2Result {
  status: GateStatus;
  blast_hits: number | null;
  toxin_probability: number | null;
  allergen_probability: number | null;
  message: string | null;
  // Rich visualization fields
  blast_top_hits: BlastHit[] | null;
  gravy_score: number | null;
  amino_acid_composition: Record<string, number> | null;
}

export interface Gate3Result {
  status: GateStatus;
  pathogen_hits: number | null;
  hgt_score: number | null;
  escape_probability: number | null;
  message: string | null;
  // Rich visualization fields
  gc_content: number | null;
  codon_adaptation_index: number | null;
  hgt_risk_factors: string[] | null;
}

export interface ConsequenceReport {
  overall_status: GateStatus;
  gate1: Gate1Result | null;
  gate2: Gate2Result | null;
  gate3: Gate3Result | null;
  skipped_gates: number[];
  run_gates: number[];
}

export interface CertificateSummary {
  registry_id: string;
  status: CertificateStatus;
  tier: string;
  chi_squared: number | null;
  owner_id: string;
  host_organism: string;
  timestamp: string;
}

/** v1.0 WatermarkResult from TINSELEncoder.encode_v1() stored as JSONB */
export interface WatermarkConfig {
  watermark_id: string;
  tier: string;
  sig_bytes: number;
  spreading_key_id: string;
  codeword_length: number;
  rs_n: number | null;
  rs_k: number | null;
}

export interface AnchorMap {
  carrier_indices: number[];
  pool_sizes: number[];
  protein_length: number;
}

export interface CodonBiasMetrics {
  chi_squared: number;
  p_value: number;
  is_covert: boolean;
  per_aa_deviations: Record<string, number>;
}

export interface WatermarkMetadata {
  original_protein: string;
  dna_sequence: string;
  watermark_id: string;
  carrier_positions: number;
  config: WatermarkConfig;
  anchor_map: AnchorMap;
  codon_bias_metrics: CodonBiasMetrics;
  signature_hex: string;
}

export interface Certificate extends CertificateSummary {
  org_id: string;
  ethics_code: string;
  sequence_type: string;
  certificate_hash: string;
  watermark_metadata: WatermarkMetadata | null;
  consequence_report: ConsequenceReport | null;
}

export interface CertificateListResponse {
  items: CertificateSummary[];
  count: number;
  offset: number;
  limit: number;
}

export interface RegistrationRequest {
  fasta: string;
  owner_id: string;
  org_id: string;
  ethics_code: string;
  host_organism?: string;
}

export interface RegistrationResponse {
  status: CertificateStatus | "FAILED";
  registry_id: string | null;
  tier: string | null;
  chi_squared: number | null;
  consequence_report: ConsequenceReport | null;
  message: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  env: string;
  db: string;
  vault: string;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
}

async function apiFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...buildHeaders(apiKey), ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    // Try to extract the detail field from a JSON error body
    let detail: string | null = null;
    try {
      const body = await res.json();
      detail =
        typeof body?.detail === "string"
          ? body.detail
          : JSON.stringify(body?.detail ?? body);
    } catch {
      detail = res.statusText || null;
    }

    switch (res.status) {
      case 401:
        throw new Error(
          'API key not recognised. Click "Set API Key" in the navigation bar ' +
          "and enter a valid key for your organisation. " +
          "If you have just created the key, wait a moment and try again."
        );
      case 403:
        throw new Error(
          "Access denied. Your API key does not have permission to perform this action. " +
          "Contact your organisation administrator if you believe this is an error."
        );
      case 404:
        throw new Error(
          "The requested record was not found. " +
          "It may have been deleted or the ID may be incorrect."
        );
      case 422:
        throw new Error(
          `Validation error — one or more fields were rejected by the server. ` +
          `Check your input and try again. (${detail ?? "unprocessable entity"})`
        );
      case 500:
        throw new Error(
          "The server encountered an internal error. Please try again. " +
          "If the problem persists, contact support."
        );
      default:
        throw new Error(
          detail ?? `Request failed with status ${res.status}.`
        );
    }
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export function createApiClient(apiKey: string) {
  return {
    health: () =>
      apiFetch<HealthResponse>("/health", apiKey),

    listCertificates: (limit = 50, offset = 0) =>
      apiFetch<CertificateListResponse>(
        `/certificates/?limit=${limit}&offset=${offset}`,
        apiKey
      ),

    getCertificate: (registryId: string) =>
      apiFetch<Certificate>(`/certificates/${registryId}`, apiKey),

    register: (body: RegistrationRequest) =>
      apiFetch<RegistrationResponse>("/register", apiKey, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
