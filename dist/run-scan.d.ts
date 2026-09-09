import { ContractsConfig, ScanReport } from "./types";
/**
 * Locate or install the sentinel CLI.
 * If sentinelCliPath is "install", attempts to download the binary.
 * Otherwise treats it as a filesystem path to the binary.
 */
export declare function resolveSentinelCli(sentinelCliPath: string): Promise<string>;
/**
 * Run a scan for all contracts in the config and return aggregated results.
 */
export declare function runScan(sentinelPath: string, config: ContractsConfig, rpcUrl: string): Promise<ScanReport>;
