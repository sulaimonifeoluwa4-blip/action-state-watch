/**
 * Typed mirror of soroban-state-sentinel JSON schema (v1.1.0).
 *
 * Verified against the sentinel's crates/cli/src/output/json.rs source,
 * crates/ttl-scanner/src/health.rs, and SCHEMA.md v1.1.0.
 *
 * The sentinel outputs a ScanJson with an entries[] array — NOT a flat
 * per-contract object.  Band values are lowercase snake_case:
 * "healthy", "expiring_soon", "critical", "archived".
 *
 * NOTE: The prior version of this file claimed PascalCase band values
 * ("Healthy", "ExpiringSoon", etc.) and contained speculative camelCase
 * fallbacks.  Those were incorrect and have been corrected.
 */

/** Health band values emitted by the sentinel (lowercase snake_case). */
export type HealthBand = "healthy" | "expiring_soon" | "critical" | "archived";

/** Alert severity levels used by this action's alerting subsystem. */
export type AlertSeverity = "info" | "warning" | "high" | "critical";

// ─── Sentinel schema types (from crates/cli/src/output/json.rs, SCHEMA.md v1.1.0) ──

/** Top-level ScanJson emitted by `soroban-state-sentinel scan --json`. */
export interface SentinelScanOutput {
  schema_version: string;
  generated_at_unix: number;
  command: {
    subcommand: string;
    contract_id: string;
    rpc_url: string;
  };
  network: {
    passphrase: string;
    protocol_version: number;
    latest_ledger: number;
    ledger_close_seconds: number;
    ledger_close_seconds_source: string;
    fee_per_rent_1kb: number;
    fee_per_rent_1kb_source: string;
    average_soroban_state_size_bytes: number | null;
    max_entry_ttl: number;
    min_persistent_ttl: number;
    min_temporary_ttl: number;
  };
  health_config: {
    healthy_min_days: number;
    critical_max_days: number;
    healthy_min_ledgers: number;
    critical_max_ledgers: number;
    extend_horizon_ledgers: number;
  };
  summary: {
    entries_scanned: number;
    healthy: number;
    expiring_soon: number;
    critical: number;
    archived: number;
    has_critical: boolean;
  };
  entries: SentinelEntry[];
}

/** A single scanned ledger entry within a ScanJson. */
export interface SentinelEntry {
  id: string;
  label: string;
  kind: string;
  durability: string | null;
  band: string;
  current_ledger_seq: number;
  live_until_ledger_seq: number | null;
  ledgers_remaining: number | null;
  days_remaining: number | null;
  estimated_archive_unix: number | null;
  size_bytes: number | null;
  key_xdr: string;
  ttl_key_xdr: string;
  extend_to_healthy_cost_stroops: number | null;
  restore_cost_stroops: number | null;
}

// ─── Action-internal types (derived from sentinel output) ─────────────────

/**
 * A single contract's scan result as derived from the sentinel's ScanJson.
 *
 * Field names match the sentinel schema:
 *   - `band` (not "health") — from EntryJson.band
 *   - `live_until_ledger_seq` (not "live_until_ledger") — from EntryJson.live_until_ledger_seq
 *
 * Band values use lowercase snake_case matching the sentinel:
 *   - "healthy", "expiring_soon", "critical", "archived"
 */
export interface ContractScanResult {
  /** Stellar contract address (C…). */
  address: string;
  /** Human-readable label from config, if provided. */
  label?: string;
  /** Current health band classification (worst across all entries). */
  band: HealthBand;
  /** The ledger sequence at which the contract's data expires (minimum across entries). */
  live_until_ledger_seq: number;
  /** Number of ledgers remaining until expiry (minimum across entries, 0 if archived). */
  ledgers_remaining: number;
  /** Estimated days remaining at current ledger close rate (minimum across entries). */
  days_remaining: number;
  /** The healthy-days threshold used for classification. */
  healthy_days_threshold: number;
  /** The critical-days threshold used for classification. */
  critical_days_threshold: number;
  /** ISO-8601 timestamp of the scan. */
  scanned_at: string;
  /** Error message if the scan failed for this contract. */
  error?: string;
}

/** Top-level scan report wrapping all contract results. */
export interface ScanReport {
  /** RPC endpoint used. */
  rpc_url: string;
  /** All per-contract results. */
  results: ContractScanResult[];
  /** Summary counts. */
  summary: {
    total: number;
    healthy: number;
    expiring_soon: number;
    critical: number;
    archived: number;
  };
}

/** Input contract entry as defined in contracts.yml. */
export interface ContractEntry {
  address: string;
  label?: string;
  keys?: string[];
  healthy_days?: number;
  critical_days?: number;
}

/** Alert configuration from contracts.yml. */
export interface AlertConfig {
  dedupe_window_hours?: number;
}

/** Top-level contracts.yml config shape. */
export interface ContractsConfig {
  network: string;
  contracts: ContractEntry[];
  alert?: AlertConfig;
}
