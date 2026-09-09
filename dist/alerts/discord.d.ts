import { ContractScanResult } from "../types";
interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    footer?: {
        text: string;
    };
    timestamp?: string;
}
interface DiscordMessage {
    content: string;
    embeds: DiscordEmbed[];
}
/**
 * Build a Discord-formatted message for contract alerts.
 */
export declare function buildDiscordMessage(results: ContractScanResult[]): DiscordMessage;
/**
 * Send alerts to Discord via webhook.
 */
export declare function sendDiscordAlert(webhookUrl: string, results: ContractScanResult[]): Promise<void>;
export {};
//# sourceMappingURL=discord.d.ts.map