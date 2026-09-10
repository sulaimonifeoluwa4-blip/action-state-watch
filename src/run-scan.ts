import * as core from "@actions/core";
import { execFileSync, execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ContractsConfig,
  ContractEntry,
  ContractScanResult,
  HealthBand,
  ScanReport,
  SentinelScanOutput,
} from "./types";

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
      const result = await scanContract(sentinelPath, contract, rpcUrl);
      results.push(result);
    } catch (e) {
      core.warning(`Scan failed for ${contract.address}: ${e instanceof Error ? e.message : String(e)}`);
      results.push({
        address: contract.address,
        label: contract.label,
        band: "Archived",
        live_until_ledger_seq: 0,
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
    healthy: results.filter((r) => r.band === "Healthy").length,
    expiring_soon: results.filter((r) => r.band === "ExpiringSoon").length,
    critical: results.filter((r) => r.band === "Critical").length,
    archived: results.filter((r) => r.band === "Archived").length,
  };

  return {
    rpc_url: rpcUrl,
    results,
    summary,
  };
}

/** Map a sentinel band string to our HealthBand type. */
function parseHealthBand(raw: string): HealthBand {
  switch (raw) {
    case "Healthy":
    case "ExpiringSoon":
    case "Critical":
    case "Archived":
      return raw;
    default:
      core.warning(`Unknown health band from sentinel: "${raw}" — defaulting to Archived`);
      return "Archived";
  }
}

/**
 * Determine the overall health band for a contract from its scanned entries.
 * The worst entry wins: Archived > Critical > ExpiringSoon > Healthy.
 */
function worstBand(entries: SentinelScanOutput["entries"]): HealthBand {
  const order: HealthBand[] = ["Archived", "Critical", "ExpiringSoon", "Healthy"];
  let worst: HealthBand = "Healthy";
  for (const entry of entries) {
    const band = parseHealthBand(entry.band);
    if (order.indexOf(band) < order.indexOf(worst)) {
      worst = band;
    }
  }
  return worst;
}

/**
 * Scan a single contract via the sentinel CLI.
 *
 * The sentinel outputs a top-level ScanJson with an `entries[]` array
 * (one per ledger entry of the contract).  We derive a single
 * ContractScanResult by taking the worst health band and minimum
 * remaining values across all entries.
 */
async function scanContract(
  sentinelPath: string,
  contract: ContractEntry,
  rpcUrl: string
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

  // NOTE: --safety-margin-ledgers does NOT exist in the real sentinel CLI.
  // The sentinel uses health_config fields instead.  Removed.

  core.info(`Scanning ${contract.address} (${contract.label || "unlabeled"})...`);

  core.debug(`Running: ${sentinelPath} ${args.join(" ")}`);

  const output = execFileSync(sentinelPath, args, {
    encoding: "utf8",
    timeout: 120_000, // 2 minute timeout per contract
    maxBuffer: 1024 * 1024, // 1MB buffer
  });

  // Parse the full ScanJson from the sentinel
  const scanJson: SentinelScanOutput = JSON.parse(output);

  if (!scanJson.entries || scanJson.entries.length === 0) {
    // Sentinel returned no entries — treat as healthy with a warning
    core.warning(`Sentinel returned 0 entries for ${contract.address}`);
    return {
      address: contract.address,
      label: contract.label,
      band: "Healthy",
      live_until_ledger_seq: 0,
      ledgers_remaining: 0,
      days_remaining: 0,
      healthy_days_threshold: scanJson.health_config?.healthy_min_days ?? contract.healthy_days ?? 30,
      critical_days_threshold: scanJson.health_config?.critical_max_days ?? contract.critical_days ?? 7,
      scanned_at: new Date(scanJson.generated_at_unix * 1000).toISOString(),
    };
  }

  // Derive per-contract result from entries (worst band wins)
  const band = worstBand(scanJson.entries);

  // Minimum across all entries for remaining fields
  let minLiveUntil = Infinity;
  let minLedgersRemaining = Infinity;
  let minDaysRemaining = Infinity;

  for (const entry of scanJson.entries) {
    if (entry.live_until_ledger_seq != null && entry.live_until_ledger_seq < minLiveUntil) {
      minLiveUntil = entry.live_until_ledger_seq;
    }
    if (entry.ledgers_remaining != null && entry.ledgers_remaining < minLedgersRemaining) {
      minLedgersRemaining = entry.ledgers_remaining;
    }
    if (entry.days_remaining != null && entry.days_remaining < minDaysRemaining) {
      minDaysRemaining = entry.days_remaining;
    }
  }

  return {
    address: contract.address,
    label: contract.label,
    band,
    live_until_ledger_seq: minLiveUntil === Infinity ? 0 : minLiveUntil,
    ledgers_remaining: minLedgersRemaining === Infinity ? 0 : minLedgersRemaining,
    days_remaining: minDaysRemaining === Infinity ? 0 : minDaysRemaining,
    healthy_days_threshold: scanJson.health_config?.healthy_min_days ?? contract.healthy_days ?? 30,
    critical_days_threshold: scanJson.health_config?.critical_max_days ?? contract.critical_days ?? 7,
    scanned_at: new Date(scanJson.generated_at_unix * 1000).toISOString(),
  };
}
