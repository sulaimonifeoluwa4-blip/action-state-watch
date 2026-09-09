import { ContractScanResult } from "../types";
/** Label applied to state-watch issues for dedup search. */
export declare const STATE_WATCH_LABEL = "state-watch";
/**
 * Create or update issues for Critical/Archived contracts.
 * Deduplicates by searching for open issues with `state-watch` label
 * whose title contains the contract address.
 */
export declare function handleGitHubIssues(token: string, results: ContractScanResult[]): Promise<void>;
//# sourceMappingURL=github-issue.d.ts.map