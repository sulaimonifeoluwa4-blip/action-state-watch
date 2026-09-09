import { ContractScanResult } from "../types";
interface SlackBlock {
    type: string;
    text?: {
        type: string;
        text: string;
    };
    fields?: Array<{
        type: string;
        text: string;
    }>;
    elements?: Array<{
        type: string;
        text?: string;
        url?: string;
    }>;
}
interface SlackMessage {
    text: string;
    blocks: SlackBlock[];
}
/**
 * Build a Slack-formatted message for a contract alert.
 */
export declare function buildSlackMessage(results: ContractScanResult[]): SlackMessage;
/**
 * Send alerts to Slack via webhook.
 */
export declare function sendSlackAlert(webhookUrl: string, results: ContractScanResult[]): Promise<void>;
export {};
//# sourceMappingURL=slack.d.ts.map