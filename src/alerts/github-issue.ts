import * as core from "@actions/core";
import * as github from "@actions/github";
import { ContractScanResult } from "../types";
import { mapSeverity } from "../severity";

/** Label applied to state-watch issues for dedup search. */
export const STATE_WATCH_LABEL = "state-watch";

/**
 * Create an authenticated Octokit client.
 */
function getClient(token: string) {
  return github.getOctokit(token);
}

/**
 * Find an existing open issue for a contract address.
 * Searches issues with the `state-watch` label whose title contains the address.
 */
async function findExistingIssue(
  octokit: ReturnType<typeof getClient>,
  repo: { owner: string; repo: string },
  contractAddress: string
): Promise<{ number: number; title: string } | null> {
  try {
    const issues = await octokit.rest.issues.listForRepo({
      ...repo,
      labels: STATE_WATCH_LABEL,
      state: "open",
      per_page: 100,
    });

    for (const issue of issues.data) {
      if (issue.title.includes(contractAddress)) {
        return { number: issue.number, title: issue.title };
      }
    }

    return null;
  } catch (e) {
    core.warning(`Failed to search for existing issues: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Create or update issues for Critical/Archived contracts.
 * Deduplicates by searching for open issues with `state-watch` label
 * whose title contains the contract address.
 */
export async function handleGitHubIssues(
  token: string,
  results: ContractScanResult[]
): Promise<void> {
  const octokit = getClient(token);
  const context = github.context;
  const repo = { owner: context.repo.owner, repo: context.repo.repo };

  for (const result of results) {
    const mapping = mapSeverity(result.band);

    // Only create/update issues for Critical and Archived
    if (!mapping.shouldAlert) continue;

    const existing = await findExistingIssue(octokit, repo, result.address);

    if (existing) {
      // Update existing issue with latest status
      await commentOnIssue(octokit, repo, existing.number, result);
    } else if (result.band === "critical" || result.band === "archived") {
      // Create new issue
      await createIssue(octokit, repo, result);
    }
  }

  // Check for recovery: close issues for contracts that are now Healthy
  await handleRecovery(octokit, repo, results);
}

/**
 * Create a new GitHub Issue for a Critical or Archived contract.
 */
async function createIssue(
  octokit: ReturnType<typeof getClient>,
  repo: { owner: string; repo: string },
  result: ContractScanResult
): Promise<void> {
  const mapping = mapSeverity(result.band);
  const title = `[state-watch] ${mapping.label}: ${result.address}`;
  const body = [
    `## ${mapping.emoji} Contract State Alert`,
    "",
    `**Contract:** \`${result.address}\``,
    result.label ? `**Label:** ${result.label}` : "",
    `**Health Band:** ${result.band}`,
    `**Ledgers Remaining:** ${result.ledgers_remaining.toLocaleString()} (~${result.days_remaining} days)`,
    `**Live Until Ledger:** ${result.live_until_ledger_seq.toLocaleString()}`,
    `**Scanned At:** ${result.scanned_at}`,
    "",
    result.error ? `### Error\n${result.error}` : "",
    "",
    "---",
    "*This issue was automatically created by [action-state-watch](https://github.com/nicolo-ribaudo/action-state-watch).*",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await octokit.rest.issues.create({
      ...repo,
      title,
      body,
      labels: [STATE_WATCH_LABEL],
    });
    core.info(`Created issue for ${result.address}`);
  } catch (e) {
    core.warning(`Failed to create issue for ${result.address}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Comment on an existing issue with the latest scan status.
 */
async function commentOnIssue(
  octokit: ReturnType<typeof getClient>,
  repo: { owner: string; repo: string },
  issueNumber: number,
  result: ContractScanResult
): Promise<void> {
  const mapping = mapSeverity(result.band);

  const body = [
    `### ${mapping.emoji} Status Update — ${new Date().toISOString()}`,
    "",
    `**Health Band:** ${result.band}`,
    `**Ledgers Remaining:** ${result.ledgers_remaining.toLocaleString()} (~${result.days_remaining} days)`,
    `**Live Until Ledger:** ${result.live_until_ledger_seq.toLocaleString()}`,
    "",
    result.error ? `**Error:** ${result.error}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await octokit.rest.issues.createComment({
      ...repo,
      issue_number: issueNumber,
      body,
    });
    core.info(`Commented on issue #${issueNumber} for ${result.address}`);
  } catch (e) {
    core.warning(`Failed to comment on issue #${issueNumber}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Auto-close issues for contracts that have recovered to Healthy.
 */
async function handleRecovery(
  octokit: ReturnType<typeof getClient>,
  repo: { owner: string; repo: string },
  results: ContractScanResult[]
): Promise<void> {
  // Find all open state-watch issues
  let issues;
  try {
    issues = await octokit.rest.issues.listForRepo({
      ...repo,
      labels: STATE_WATCH_LABEL,
      state: "open",
      per_page: 100,
    });
  } catch (e) {
    core.warning(`Failed to list issues for recovery check: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  for (const issue of issues.data) {
    // Extract contract address from issue title
    const addressMatch = issue.title.match(/\b([CG][A-Z0-9]{55})\b/);
    if (!addressMatch) continue;

    const address = addressMatch[1];
    const currentResult = results.find((r) => r.address === address);

    if (currentResult && currentResult.band === "healthy") {
      // Contract has recovered — close the issue with a comment
      try {
        await octokit.rest.issues.createComment({
          ...repo,
          issue_number: issue.number,
          body: [
            `### ✅ Recovery Confirmed — ${new Date().toISOString()}`,
            "",
            `Contract \`${address}\` is now **Healthy**. Auto-closing this issue.`,
          ].join("\n"),
        });

        await octokit.rest.issues.update({
          ...repo,
          issue_number: issue.number,
          state: "closed",
          state_reason: "completed",
        });

        core.info(`Closed issue #${issue.number} — contract ${address} recovered`);
      } catch (e) {
        core.warning(`Failed to close issue #${issue.number}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
