import { HealthBand, AlertSeverity, ContractScanResult } from "./types";
/**
 * Map a health band to the corresponding alert severity.
 *
 * - Healthy: no alert (mapped to 'none')
 * - ExpiringSoon: low-severity, informational
 * - Critical: high-severity, mention/ping
 * - Archived: highest severity, action required now
 */
export type SeverityMapping = {
    severity: AlertSeverity | "none";
    emoji: string;
    label: string;
    shouldAlert: boolean;
};
export declare function mapSeverity(health: HealthBand): SeverityMapping;
/**
 * Determine if an alert should be fired for this scan result.
 */
export declare function shouldAlert(result: ContractScanResult): boolean;
/**
 * Build a human-readable alert summary for a single contract.
 */
export declare function formatAlertSummary(result: ContractScanResult): string;
