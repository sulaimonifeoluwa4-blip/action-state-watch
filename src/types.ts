/**
 * Typed mirror of soroban-state-sentinel SCHEMA.md version 1.1.0.
 *
 * The sentinel CLI outputs per-contract JSON with these fields.
 * This file must stay in sync with the canonical schema — do NOT
 * guess field names; read SCHEMA.md directly when updating.
 */

/** Health band values emitted by the sentinel. */
export type HealthBand = "Healthy" | "ExpiringSoon" | "Critical" | "Archived";

/** Alert severity levels used by this action's alerting subsystem. */
export type AlertSeverity = "info" | "warning" | "high" | "critical";

/** A single contract's scan result as returned by `soroban-state-sentinel scan --json`. */
export interface ContractScanResult {
  /** Stellar contract address (C…). */
  address: string;
  /** Human-readable label from config, if provided. */
  label?: string;
  /** Current health band classification. */
  health: HealthBand;
  /** The ledger sequence at which the contract's data expires. */
  live_until_ledger: number;
  /** Number of ledgers remaining until expiry (0 if archived). */
  ledgers_remaining: number;
  /** Estimated days remaining at current ledger close rate. */
  days_remaining: number;
  /** The healthy-days threshold used for classification. */
  healthy_days_threshold: number;
  /** The critical-days threshold used for classification. */
  critical_days_threshold: number;
  /** Unsigned XDR for restore, if the sentinel produced one (Archived state). */
  restore_xdr?: string;
  /** Unsigned XDR for extend, if the sentinel produced one. */
  extend_xdr?: string;
  /** ISO-8601 timestamp of the scan. */
  scanned_at: string;
  /** Error message if the scan failed for this contract. */
  error?: string;
}

/** Top-level scan report wrapping all contract results. */
export interface ScanReport {
  /** Protocol version targeted. */
  protocol_version?: string;
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
  safety_margin_ledgers?: number;
  alert?: AlertConfig;
}
