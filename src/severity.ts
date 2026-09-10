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

export function mapSeverity(band: HealthBand): SeverityMapping {
  switch (band) {
    case "Healthy":
      return { severity: "none", emoji: "✅", label: "Healthy", shouldAlert: false };
    case "ExpiringSoon":
      return { severity: "info", emoji: "⚠️", label: "Expiring Soon", shouldAlert: true };
    case "Critical":
      return { severity: "high", emoji: "🔴", label: "Critical", shouldAlert: true };
    case "Archived":
      return { severity: "critical", emoji: "💀", label: "Archived", shouldAlert: true };
  }
}

/**
 * Determine if an alert should be fired for this scan result.
 */
export function shouldAlert(result: ContractScanResult): boolean {
  const mapping = mapSeverity(result.band);
  return mapping.shouldAlert;
}

/**
 * Build a human-readable alert summary for a single contract.
 */
export function formatAlertSummary(result: ContractScanResult): string {
  const mapping = mapSeverity(result.band);
  const label = result.label || result.address;
  const lines: string[] = [
    `${mapping.emoji} **${mapping.label}** — ${label}`,
    `Address: \`${result.address}\``,
  ];

  if (result.band === "Archived") {
    lines.push(`**Action required now** — contract state has been archived.`);
  }

  if (result.band !== "Healthy") {
    lines.push(
      `Ledgers remaining: ${result.ledgers_remaining.toLocaleString()} (~${result.days_remaining} days)`
    );
    lines.push(`Live until ledger: ${result.live_until_ledger_seq.toLocaleString()}`);
  }

  if (result.error) {
    lines.push(`\nError: ${result.error}`);
  }

  return lines.join("\n");
}
