import * as core from "@actions/core";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ContractsConfig, ContractEntry, ContractScanResult, ScanReport } from "./types";

/** Sentinel CLI binary name, pinned. */
const SENTINEL_BINARY = "soroban-state-sentinel";

/**
 * Locate or install the sentinel CLI.
 * If sentinelCliPath is "install", attempts to download the binary.
 * Otherwise treats it as a filesystem path to the binary.
 */
export async function resolveSentinelCli(sentinelCliPath: string): Promise<string> {
  if (sentinelCliPath === "install") {
    return installSentinelCli();
  }

  // Validate the provided path exists
  if (!fs.existsSync(sentinelCliPath)) {
    throw new Error(`Sentinel CLI not found at: ${sentinelCliPath}`);
  }

  // Check it's executable
  try {
    fs.accessSync(sentinelCliPath, fs.constants.X_OK);
  } catch {
    throw new Error(`Sentinel CLI at ${sentinelCliPath} is not executable`);
  }

  core.info(`Using sentinel CLI at: ${sentinelCliPath}`);
  return sentinelCliPath;
}

/**
 * Install the sentinel CLI by attempting to fetch the latest release.
 * Falls back to checking PATH if the binary is already available.
 */
async function installSentinelCli(): Promise<string> {
  // First check if it's already on PATH
  const whichResult = execSync(`which ${SENTINEL_BINARY} 2>/dev/null || true`, {
    encoding: "utf8",
  }).trim();

  if (whichResult && fs.existsSync(whichResult)) {
    core.info(`Found sentinel CLI on PATH: ${whichResult}`);
    return whichResult;
  }

  // Attempt to install via cargo or download from GitHub releases
  // For now, check if cargo is available and install from source
  const hasCargo = execSync("which cargo 2>/dev/null || true", {
    encoding: "utf8",
  }).trim();

  if (hasCargo) {
    core.info("Installing soroban-state-sentinel via cargo install...");
    execSync(`cargo install soroban-state-sentinel 2>&1`, {
      encoding: "utf8",
      stdio: "inherit",
    });

    // After cargo install, binary is in ~/.cargo/bin/
    const cargoBin = path.join(os.homedir(), ".cargo", "bin", SENTINEL_BINARY);
    if (fs.existsSync(cargoBin)) {
      core.info(`Installed sentinel CLI at: ${cargoBin}`);
      return cargoBin;
    }
  }

  throw new Error(
    `Failed to install ${SENTINEL_BINARY}. ` +
      `Please provide a path via the sentinel-cli-path input, ` +
      `or ensure cargo is available for automatic installation.`
  );
}

/**
 * Run a scan for all contracts in the config and return aggregated results.
 */
export async function runScan(
  sentinelPath: string,
  config: ContractsConfig,
  rpcUrl: string
): Promise<ScanReport> {
  const results: ContractScanResult[] = [];

  for (const contract of config.contracts) {
    try {
      const result = await scanContract(sentinelPath, contract, rpcUrl, config);
      results.push(result);
    } catch (e) {
      core.warning(`Scan failed for ${contract.address}: ${e instanceof Error ? e.message : String(e)}`);
      results.push({
        address: contract.address,
        label: contract.label,
        health: "Archived",
        live_until_ledger: 0,
        ledgers_remaining: 0,
        days_remaining: 0,
        healthy_days_threshold: 0,
        critical_days_threshold: 0,
        scanned_at: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const summary = {
    total: results.length,
    healthy: results.filter((r) => r.health === "Healthy").length,
    expiring_soon: results.filter((r) => r.health === "ExpiringSoon").length,
    critical: results.filter((r) => r.health === "Critical").length,
    archived: results.filter((r) => r.health === "Archived").length,
  };

  return {
    rpc_url: rpcUrl,
    results,
    summary,
  };
}

/**
 * Scan a single contract via the sentinel CLI.
 */
async function scanContract(
  sentinelPath: string,
  contract: ContractEntry,
  rpcUrl: string,
  config: ContractsConfig
): Promise<ContractScanResult> {
  const args: string[] = [
    "scan",
    "--rpc-url", rpcUrl,
    "--json",
    contract.address,
  ];

  // Pass through keys if specified
  if (contract.keys && contract.keys.length > 0) {
    for (const key of contract.keys) {
      args.push("--keys", key);
    }
  }

  // Pass through threshold overrides if specified
  if (contract.healthy_days !== undefined) {
    args.push("--healthy-days", String(contract.healthy_days));
  }
  if (contract.critical_days !== undefined) {
    args.push("--critical-days", String(contract.critical_days));
  }

  // If safety-margin-ledgers is set in the global config, pass it
  if (config.safety_margin_ledgers !== undefined) {
    args.push("--safety-margin-ledgers", String(config.safety_margin_ledgers));
  }

  core.info(`Scanning ${contract.address} (${contract.label || "unlabeled"})...`);

  const cmd = `${sentinelPath} ${args.join(" ")}`;
  core.debug(`Running: ${cmd}`);

  const output = execSync(cmd, {
    encoding: "utf8",
    timeout: 120_000, // 2 minute timeout per contract
    maxBuffer: 1024 * 1024, // 1MB buffer
  });

  // Parse the JSON output
  const parsed = JSON.parse(output);
  return {
    address: contract.address,
    label: contract.label,
    health: parsed.health,
    live_until_ledger: parsed.live_until_ledger ?? parsed.liveUntilLedgerSeq ?? 0,
    ledgers_remaining: parsed.ledgers_remaining ?? parsed.ledgersRemaining ?? 0,
    days_remaining: parsed.days_remaining ?? parsed.daysRemaining ?? 0,
    healthy_days_threshold: parsed.healthy_days_threshold ?? contract.healthy_days ?? 30,
    critical_days_threshold: parsed.critical_days_threshold ?? contract.critical_days ?? 7,
    restore_xdr: parsed.restore_xdr ?? parsed.restoreXdr,
    extend_xdr: parsed.extend_xdr ?? parsed.extendXdr,
    scanned_at: parsed.scanned_at ?? new Date().toISOString(),
    error: parsed.error,
  };
}
