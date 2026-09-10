import * as core from "@actions/core";

import { loadConfig } from "./config";
import { resolveSentinelCli, runScan } from "./run-scan";
import { mapSeverity, shouldAlert } from "./severity";
import { sendSlackAlert } from "./alerts/slack";
import { sendDiscordAlert } from "./alerts/discord";
import { handleGitHubIssues } from "./alerts/github-issue";

/**
 * Main entry point for the action-state-watch GitHub Action.
 */
async function run(): Promise<void> {
  try {
    // 1. Read inputs
    const sentinelCliPath = core.getInput("sentinel-cli-path") || "install";
    const configPath = core.getInput("config-path") || "contracts.yml";
    const rpcUrl = core.getInput("rpc-url", { required: true });
    const slackWebhookUrl = core.getInput("slack-webhook-url");
    const discordWebhookUrl = core.getInput("discord-webhook-url");
    const githubToken = core.getInput("github-token");

    // Validate that at least one alert channel is configured
    if (!slackWebhookUrl && !discordWebhookUrl && !githubToken) {
      core.setFailed(
        "At least one alert channel must be configured: " +
          "slack-webhook-url, discord-webhook-url, or github-token"
      );
      return;
    }

    core.info("=== Soroban State Watch ===");
    core.info(`Config: ${configPath}`);
    core.info(`RPC URL: ${rpcUrl}`);

    // 2. Load and validate config
    const config = loadConfig(configPath);
    core.info(`Loaded ${config.contracts.length} contract(s) from config`);

    // 3. Resolve sentinel CLI
    const sentinelPath = await resolveSentinelCli(sentinelCliPath);
    core.info(`Sentinel CLI: ${sentinelPath}`);

    // 4. Run scan against all contracts
    core.info("Starting contract scans...");
    const report = await runScan(sentinelPath, config, rpcUrl);

    // 5. Log summary
    core.info(`\n=== Scan Summary ===`);
    core.info(`Total: ${report.summary.total}`);
    core.info(`Healthy: ${report.summary.healthy}`);
    core.info(`Expiring Soon: ${report.summary.expiring_soon}`);
    core.info(`Critical: ${report.summary.critical}`);
    core.info(`Archived: ${report.summary.archived}`);

    // 6. Set outputs
    const criticalContracts = report.results
      .filter((r) => {
        const mapping = mapSeverity(r.band);
        return mapping.shouldAlert;
      })
      .map((r) => r.address);

    core.setOutput("contracts-critical", JSON.stringify(criticalContracts));

    // 7. Send alerts
    const alertResults = report.results.filter((r) => shouldAlert(r));

    if (alertResults.length > 0) {
      core.warning(`${alertResults.length} contract(s) need attention!`);

      // Slack alerts
      if (slackWebhookUrl) {
        try {
          await sendSlackAlert(slackWebhookUrl, alertResults);
        } catch (e) {
          core.warning(`Slack alert failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Discord alerts
      if (discordWebhookUrl) {
        try {
          await sendDiscordAlert(discordWebhookUrl, alertResults);
        } catch (e) {
          core.warning(`Discord alert failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // GitHub Issues (for Critical and Archived)
      if (githubToken) {
        try {
          await handleGitHubIssues(
            githubToken,
            alertResults,
            config.alert?.dedupe_window_hours
          );
        } catch (e) {
          core.warning(`GitHub issue handling failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      core.info("All contracts are healthy. No alerts to send.");
    }

    // 8. Fail if any Critical or Archived findings
    if (report.summary.critical > 0 || report.summary.archived > 0) {
      core.setFailed(
        `${report.summary.critical} contract(s) Critical, ${report.summary.archived} Archived`
      );
    }

    core.info("\n=== Done ===");
  } catch (error) {
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

run();
