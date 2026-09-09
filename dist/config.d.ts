import { ContractsConfig } from "./types";
/**
 * Load and validate contracts.yml.
 *
 * The file is based on archival-fixtures-demo's proposal, with fields:
 *   network: testnet
 *   contracts: [...]
 *   safety-margin-ledgers: 120960
 *   alert:
 *     dedupe-window-hours: 24
 */
export declare function loadConfig(configPath: string): ContractsConfig;
