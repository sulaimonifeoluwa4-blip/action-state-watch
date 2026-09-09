import * as core from "@actions/core";
import { ContractScanResult } from "../types";
import { mapSeverity, formatAlertSummary } from "../severity";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text?: string; url?: string }>;
}

interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}

/**
 * Build a Slack-formatted message for a contract alert.
 */
export function buildSlackMessage(results: ContractScanResult[]): SlackMessage {
  const criticalResults = results.filter((r) => {
    const mapping = mapSeverity(r.health);
    return mapping.shouldAlert;
  });

  if (criticalResults.length === 0) {
    return { text: "All contracts healthy.", blocks: [] };
  }

  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `🚨 Soroban State Watch — ${criticalResults.length} alert(s)`,
    },
  });

  blocks.push({ type: "divider" });

  for (const result of criticalResults) {
    const mapping = mapSeverity(result.health);

    // Section with text
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: formatAlertSummary(result),
      },
    });

    // Fields for quick scanning
    if (result.health !== "Healthy") {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Ledgers Remaining:*\n${result.ledgers_remaining.toLocaleString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Days Remaining:*\n~${result.days_remaining}`,
          },
          {
            type: "mrkdwn",
            text: `*Health Band:*\n${mapping.emoji} ${mapping.label}`,
          },
        ],
      });
    }

    blocks.push({ type: "divider" });
  }

  const text = `Soroban State Watch: ${criticalResults.length} contract(s) need attention`;

  return { text, blocks };
}

/**
 * Send alerts to Slack via webhook.
 */
export async function sendSlackAlert(
  webhookUrl: string,
  results: ContractScanResult[]
): Promise<void> {
  const message = buildSlackMessage(results);

  if (message.blocks.length === 0) {
    core.info("No alerts to send to Slack (all contracts healthy).");
    return;
  }

  core.info(`Sending Slack alert for ${results.length} contract(s)...`);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack webhook returned ${response.status}: ${body}`);
    }

    core.info("Slack alert sent successfully.");
  } catch (e) {
    core.warning(`Failed to send Slack alert: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}
