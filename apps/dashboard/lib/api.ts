/**
 * Typed API client for the TINSEL sentinel_api backend.
 * All routes are under /api/v1. Authentication via X-API-Key header.
 */

// Browser: use the Next.js proxy route so the backend URL is resolved
// server-side from the runtime API_URL env var (avoids build-time baking).
// SSR/server: call the backend directly.
const BASE =
  typeof window !== "undefined"
    ? "/api/proxy/v1"
    : `${process.env.API_URL ?? "http://localhost:8000"}/api/v1`;

// ---------------------------------------------------------------------------
// Response types — mirror Pydantic schemas from sentinel_api
// ---------------------------------------------------------------------------

export type GateStatus = "pass" | "fail" | "warn" | "skip";
export type CertificateStatus = "CERTIFIED" | "CERTIFIED_WITH_WARNINGS" | "FAILED" | "PENDING" | "REVOKED";

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

export interface SecureDNAHit {
  position: number;
  window_length: number;
  doprf_token: string;
  hazard_label: string;
  confidence: number;
}

export interface IBBISHit {
  family_id: string;
  family_name: string;
  hmm_accession: string;
  evalue: number;
  matched_signature: string;
  hit_position: number;
}

export interface DatabaseQueried {
  name: string;
  version: string;
  method: string;
  status: GateStatus;
  windows_screened?: number;
  families_screened?: number;
  db_version?: string;
  queried_at?: string;
  note?: string;
}

export interface Gate2Result {
  status: GateStatus;
  /** "composition_heuristic_v1" | "chained_v1" | "blast_full_v1" */
  screening_method: string;
  blast_hits: number | null;
  toxin_probability: number | null;
  allergen_probability: number | null;
  message: string | null;
  // Composition rich visualization fields
  blast_top_hits: BlastHit[] | null;
  gravy_score: number | null;
  amino_acid_composition: Record<string, number> | null;
  // SecureDNA DOPRF results
  secureDNA_checked: boolean;
  secureDNA_windows_screened: number;
  secureDNA_hits: SecureDNAHit[];
  secureDNA_status: GateStatus | null;
  // IBBIS commec HMM results
  ibbis_checked: boolean;
  ibbis_families_screened: number;
  ibbis_hits: IBBISHit[];
  ibbis_status: GateStatus | null;
  // Audit: databases queried (for compliance manifest)
  databases_queried: DatabaseQueried[];
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

export interface Gate4Hit {
  family: string;
  organism: string;
  uniprot: string;
  category: string;
  similarity: number;
  threshold_fail: number;
  threshold_warn: number;
  status: "fail" | "warn" | "pass";
}

export interface Gate4Result {
  status: GateStatus;
  /**
   * "composition_fingerprint_v1" — 420-D amino acid + dipeptide vector (demo/dev)
   * "esm2_cosine_v1"             — ESM-2 650M mean-pooled embeddings (production)
   * "mock_v1"                    — test mock
   */
  method: string;
  query_dimensions: number;
  references_screened: number;
  threshold_fail: number;
  threshold_warn: number;
  max_similarity: number | null;
  top_hits: Gate4Hit[];
  message: string | null;
  /** Explains demo vs production method and threshold values */
  note: string | null;
}

export interface ConsequenceReport {
  overall_status: GateStatus;
  gate1: Gate1Result | null;
  gate2: Gate2Result | null;
  gate3: Gate3Result | null;
  gate4: Gate4Result | null;
  skipped_gates: number[];
  run_gates: number[];
  /** "real" = production adapters ran; "mock" = test stubs ran — no real biosafety assurance */
  gate_mode: string;
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
  /** Post-quantum signature algorithm ID, e.g. "wots_plus_sha3_256_w256_l35" */
  pq_algorithm: string;
  /** True for pre-Session-3 certificates with zero-filled stubs */
  pq_is_stub: boolean;
}

export interface CertificateListResponse {
  items: CertificateSummary[];
  count: number;
  offset: number;
  limit: number;
}

export interface FrameworkAttestation {
  framework: string;
  version: string;
  fields: Record<string, unknown>;
}

export interface ComplianceManifest {
  schema_version: string;
  generated_at: string;
  registry_id: string;
  certificate_hash: string;
  sequence_hash: string;
  status: string;
  certified_at: string;
  owner_id: string;
  org_id: string;
  ethics_code: string;
  host_organism: string;
  gate_mode: string;
  run_gates: number[];
  skipped_gates: number[];
  gate_summary: Record<string, string>;
  databases_queried: DatabaseQueried[];
  wots_algorithm: string;
  wots_is_stub: boolean;
  framework_attestations: FrameworkAttestation[];
  regulatory_notice: string;
}

export interface ComplianceVerify {
  registry_id: string;
  certificate_hash: string;
  sequence_hash: string;
  status: string;
  certified_at: string;
  pq_algorithm: string;
  pq_is_stub: boolean;
  overall_gate_status: string;
  screening_databases: string[];
  verified_at: string;
}

export function fetchComplianceVerify(registryId: string): Promise<ComplianceVerify> {
  return fetch(`${BASE}/certificates/${registryId}/compliance/verify`).then((res) => {
    if (!res.ok) throw new Error(`Compliance verify failed (${res.status})`);
    return res.json() as Promise<ComplianceVerify>;
  });
}

// ---------------------------------------------------------------------------
// Sequence hash lookup (public, no auth)
// ---------------------------------------------------------------------------

export interface CertificateLookupItem {
  registry_id: string;
  status: CertificateStatus;
  tier: string;
  certified_at: string;
  host_organism: string;
}

export interface CertificateLookupResponse {
  results: CertificateLookupItem[];
  count: number;
}

export function lookupBySequenceHash(sequenceHash: string): Promise<CertificateLookupResponse> {
  return fetch(`${BASE}/certificates/lookup?sequence_hash=${encodeURIComponent(sequenceHash)}`).then(
    (res) => {
      if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
      return res.json() as Promise<CertificateLookupResponse>;
    }
  );
}

// ---------------------------------------------------------------------------
// ArtGene-SCD-1.0 types
// ---------------------------------------------------------------------------

export interface MachineInstructions {
  proceed_with_synthesis: boolean;
  hold_for_review: boolean;
  reject: boolean;
  log_for_regulatory_audit: boolean;
  special_handling_notes: string | null;
}

export interface SynthesisAuthorizationDoc {
  authorized: boolean;
  authorization_level: "FULL" | "CONDITIONAL" | "DENIED";
  decision: "PROCEED" | "HOLD" | "REJECT";
  decision_reason: string;
  requires_biosafety_officer_countersign: boolean;
  valid_from: string;
  valid_until: string;
  host_organism: string;
  max_synthesis_length_bp: number | null;
}

export interface SynthesisAuthDocument {
  spec_version: string;
  issued_by: string;
  issued_at: string;
  registry_id: string;
  sequence_hash: string;
  certificate_hash: string;
  synthesis_authorization: SynthesisAuthorizationDoc;
  regulatory_clearance: Record<string, unknown>;
  screening_record: Record<string, unknown>;
  cryptographic_proof: Record<string, unknown>;
  machine_instructions: MachineInstructions;
  notice: string;
}

export interface RegistrationRequest {
  fasta: string;
  owner_id: string;
  // org_id is NOT sent — the server derives it from the authenticated API key.
  ethics_code: string;
  host_organism?: string;
  visibility?: "public" | "embargoed";
}

export interface RegistrationResponse {
  status: CertificateStatus | "FAILED";
  registry_id: string | null;
  consequence_report: ConsequenceReport | null;
  message: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  // env is intentionally absent from the public /health endpoint.
  // Use /health/detail (authenticated) if env is needed.
  db: string;
  vault: string;
}

// ---------------------------------------------------------------------------
// Demo / Analyse types — /api/v1/analyse and /api/v1/analyse/structure
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Provenance Tracing types
// ---------------------------------------------------------------------------

export interface DistributionSummary {
  id: string;
  sequence_id: string;
  recipient_name: string;
  recipient_org: string;
  recipient_email: string | null;
  purpose: string;
  host_organism: string;
  issued_at: string;
  revoked_at: string | null;
  fingerprint_id: string;
}

export interface IssueDistributionRequest {
  recipient_name: string;
  recipient_org: string;
  recipient_email?: string;
  purpose?: string;
  host_organism?: string;
}

export interface VerifySourceRequest {
  fasta: string;
}

export interface VerifySourceResponse {
  match_found: boolean;
  sequence_id: string | null;
  recipient_name: string | null;
  recipient_org: string | null;
  purpose: string | null;
  issued_at: string | null;
  fingerprint_id: string | null;
  message: string;
}

// ---------------------------------------------------------------------------
// Demo / Analyse types — /api/v1/analyse and /api/v1/analyse/structure
// ---------------------------------------------------------------------------

export interface CodonDiff {
  position: number;
  amino_acid: string;
  original_codon: string;
  fingerprinted_codon: string;
}

export interface RecipientCopy {
  recipient_name: string;
  recipient_org: string;
  dna: string;
  codon_diffs: CodonDiff[];
  n_codons_changed: number;
}

export interface AnalyseRequest {
  fasta: string;
  host_organism?: string;
}

export interface AnalyseResponse {
  original_protein: string;
  sequence_length: number;
  host_organism: string;
  control_dna: string;
  n_codons_total: number;
  recipient_a: RecipientCopy;
  recipient_b: RecipientCopy;
  n_codons_differ_between_copies: number;
  protein_preserved: boolean;
  verify_demo: {
    scenario: string;
    submitted_dna: string;
    match_found: boolean;
    matched_recipient: string;
    matched_org: string;
    issued_at: string;
    confidence: string;
    explanation: string;
  };
}

export interface StructureRequest {
  protein: string;
}

export interface StructureResponse {
  pdb_text: string | null;
  plddt_mean: number | null;
  plddt_per_residue: number[] | null;
  instability_index: number | null;
  sequence_length: number;
  fallback: boolean;
  message: string | null;
}

// ---------------------------------------------------------------------------
// No-auth fetch helpers for demo endpoints
// ---------------------------------------------------------------------------

async function demoFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail: string | null = null;
    try {
      const err = await res.json();
      detail =
        typeof err?.detail === "string"
          ? err.detail
          : JSON.stringify(err?.detail ?? err);
    } catch {
      detail = res.statusText || null;
    }
    throw new Error(detail ?? `Request failed with status ${res.status}.`);
  }

  return res.json() as Promise<T>;
}

export function analyseSequence(req: AnalyseRequest): Promise<AnalyseResponse> {
  return demoFetch<AnalyseResponse>("/analyse", req);
}

export function fetchStructure(protein: string): Promise<StructureResponse> {
  return demoFetch<StructureResponse>("/analyse/structure", { protein });
}

// ---------------------------------------------------------------------------
// Fragment assembly risk types + fetch helper
// ---------------------------------------------------------------------------

export interface FragmentScreenResult {
  header: string;
  sequence_length: number;
  gate2_status: GateStatus;
  gate4_status: GateStatus;
  overall_status: GateStatus;
  message: string | null;
}

export interface AssemblyResult {
  contigs_found: number;
  assembled_length: number;
  gate2_status: GateStatus;
  gate4_status: GateStatus;
  gate2_message: string | null;
  gate4_message: string | null;
  overall_status: GateStatus;
  risk_verdict: "SAFE" | "WARN" | "BLOCKED";
}

export interface FragmentsRequest {
  fragments_fasta: string;
  host_organism?: string;
}

export interface FragmentsResponse {
  privacy_notice: string;
  fragment_count: number;
  fragment_results: FragmentScreenResult[];
  assembly_detected: boolean;
  overlaps_found: number;
  assembled_result: AssemblyResult | null;
  message: string;
}

export function analyseFragments(req: FragmentsRequest): Promise<FragmentsResponse> {
  return demoFetch<FragmentsResponse>("/analyse/fragments", req);
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
      case 409:
        throw new Error(
          detail ?? "This sequence has already been registered. Contact support if you believe this is an error."
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

    exportCertificate: (registryId: string) =>
      apiFetch<Record<string, unknown>>(`/certificates/${registryId}/export`, apiKey),

    getCompliance: (registryId: string, frameworks = "US_DURC,EU_DUAL_USE") =>
      apiFetch<ComplianceManifest>(
        `/certificates/${registryId}/compliance?frameworks=${encodeURIComponent(frameworks)}`,
        apiKey
      ),

    register: (body: RegistrationRequest) =>
      apiFetch<RegistrationResponse>("/register", apiKey, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    getSynthesisAuth: (registryId: string) =>
      apiFetch<SynthesisAuthDocument>(`/certificates/${registryId}/synthesis-auth`, apiKey),

    revokeCertificate: (registryId: string) =>
      apiFetch<{ registry_id: string; status: string; revoked_at?: string; message: string }>(
        `/certificates/${registryId}/revoke`,
        apiKey,
        { method: "POST" }
      ),

    listDistributions: (sequenceId: string) =>
      apiFetch<DistributionSummary[]>(`/sequences/${sequenceId}/distributions`, apiKey),

    issueDistribution: async (sequenceId: string, body: IssueDistributionRequest): Promise<Blob> => {
      const res = await fetch(
        `${BASE}/sequences/${sequenceId}/distributions`,
        {
          method: "POST",
          headers: buildHeaders(apiKey),
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        let detail: string | null = null;
        try { detail = (await res.json()).detail; } catch { /* ignore */ }
        throw new Error(detail ?? `Failed to issue distribution copy (${res.status})`);
      }
      return res.blob();
    },

    verifySource: (body: VerifySourceRequest) =>
      apiFetch<VerifySourceResponse>("/verify-source", apiKey, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
