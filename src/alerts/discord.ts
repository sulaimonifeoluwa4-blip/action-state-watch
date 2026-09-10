import * as core from "@actions/core";
import { ContractScanResult } from "../types";
import { mapSeverity, formatAlertSummary } from "../severity";

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  content: string;
  embeds: DiscordEmbed[];
}

/** Discord embed colors by severity. */
const SEVERITY_COLORS: Record<string, number> = {
  info: 0x3498db, // Blue
  high: 0xe74c3c, // Red
  critical: 0x1a1a2e, // Dark
};

/**
 * Build a Discord-formatted message for contract alerts.
 */
export function buildDiscordMessage(results: ContractScanResult[]): DiscordMessage {
  const criticalResults = results.filter((r) => {
    const mapping = mapSeverity(r.band);
    return mapping.shouldAlert;
  });

  if (criticalResults.length === 0) {
    return { content: "All contracts healthy.", embeds: [] };
  }

  const embeds: DiscordEmbed[] = [];

  for (const result of criticalResults) {
    const mapping = mapSeverity(result.band);
    const color = SEVERITY_COLORS[mapping.severity] || 0x95a5a6;

    const embed: DiscordEmbed = {
      title: `${mapping.emoji} ${mapping.label} — ${result.label || "Unknown"}`,
      description: formatAlertSummary(result),
      color,
      fields: [],
      timestamp: result.scanned_at || new Date().toISOString(),
    };

    if (result.band !== "Healthy") {
      embed.fields = [
        { name: "Ledgers Remaining", value: result.ledgers_remaining.toLocaleString(), inline: true },
        { name: "Days Remaining", value: `~${result.days_remaining}`, inline: true },
        { name: "Live Until Ledger", value: result.live_until_ledger_seq.toLocaleString(), inline: true },
      ];
    }

    embed.footer = { text: "Soroban State Watch" };
    embeds.push(embed);
  }

  const content = `🚨 **Soroban State Watch** — ${criticalResults.length} alert(s)`;

  return { content, embeds };
}

/**
 * Send alerts to Discord via webhook.
 */
export async function sendDiscordAlert(
  webhookUrl: string,
  results: ContractScanResult[]
): Promise<void> {
  const message = buildDiscordMessage(results);

  if (message.embeds.length === 0) {
    core.info("No alerts to send to Discord (all contracts healthy).");
    return;
  }

  core.info(`Sending Discord alert for ${results.length} contract(s)...`);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Discord webhook returned ${response.status}: ${body}`);
    }

    core.info("Discord alert sent successfully.");
  } catch (e) {
    core.warning(`Failed to send Discord alert: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}
