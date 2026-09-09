import * as fs from "fs";
import * as yaml from "js-yaml";
import { ContractsConfig, ContractEntry, AlertConfig } from "./types";

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
export function loadConfig(configPath: string): ContractsConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  let parsed: Record<string, unknown>;

  try {
    parsed = yaml.load(raw) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `Failed to parse YAML in ${configPath}: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Config file ${configPath} is not a valid YAML mapping`);
  }

  // Validate network
  if (typeof parsed["network"] !== "string" || !parsed["network"]) {
    throw new Error("Config must include a 'network' string (e.g. 'testnet', 'mainnet')");
  }

  // Validate contracts array
  if (!Array.isArray(parsed["contracts"]) || parsed["contracts"].length === 0) {
    throw new Error("Config must include a non-empty 'contracts' array");
  }

  const contracts: ContractEntry[] = parsed["contracts"].map(
    (entry: unknown, i: number) => validateContractEntry(entry, i)
  );

  // Optional safety-margin-ledgers
  let safetyMarginLedgers: number | undefined;
  if (parsed["safety-margin-ledgers"] !== undefined) {
    safetyMarginLedgers = validatePositiveInteger(
      parsed["safety-margin-ledgers"],
      "safety-margin-ledgers"
    );
  }

  // Optional alert config
  let alert: AlertConfig | undefined;
  if (parsed["alert"] !== undefined) {
    alert = validateAlertConfig(parsed["alert"]);
  }

  return {
    network: parsed["network"] as string,
    contracts,
    safety_margin_ledgers: safetyMarginLedgers,
    alert,
  };
}

function validateContractEntry(entry: unknown, index: number): ContractEntry {
  if (!entry || typeof entry !== "object") {
    throw new Error(`contracts[${index}]: must be a mapping`);
  }

  const e = entry as Record<string, unknown>;

  if (typeof e["address"] !== "string" || !e["address"]) {
    throw new Error(`contracts[${index}]: 'address' is required and must be a non-empty string`);
  }

  // Validate Stellar address format (starts with C or G, 56 chars)
  const addr = e["address"] as string;
  if (!/^[CG][A-Z0-9]{55}$/.test(addr)) {
    throw new Error(
      `contracts[${index}]: address '${addr}' does not look like a valid Stellar address`
    );
  }

  if (e["label"] !== undefined && typeof e["label"] !== "string") {
    throw new Error(`contracts[${index}]: 'label' must be a string if provided`);
  }

  if (e["keys"] !== undefined) {
    if (!Array.isArray(e["keys"])) {
      throw new Error(`contracts[${index}]: 'keys' must be an array if provided`);
    }
    for (let k = 0; k < e["keys"].length; k++) {
      if (typeof e["keys"][k] !== "string") {
        throw new Error(`contracts[${index}]: keys[${k}] must be a string`);
      }
    }
  }

  if (e["healthy-days"] !== undefined) {
    validatePositiveNumber(e["healthy-days"], `contracts[${index}].healthy-days`);
  }

  if (e["critical-days"] !== undefined) {
    validatePositiveNumber(e["critical-days"], `contracts[${index}].critical-days`);
  }

  const result: ContractEntry = { address: e["address"] as string };
  if (typeof e["label"] === "string") result.label = e["label"];
  if (Array.isArray(e["keys"])) result.keys = e["keys"] as string[];
  if (e["healthy-days"] !== undefined)
    result.healthy_days = e["healthy-days"] as number;
  if (e["critical-days"] !== undefined)
    result.critical_days = e["critical-days"] as number;

  return result;
}

function validateAlertConfig(alert: unknown): AlertConfig {
  if (!alert || typeof alert !== "object") {
    throw new Error("'alert' must be a mapping if provided");
  }

  const a = alert as Record<string, unknown>;
  const result: AlertConfig = {};

  if (a["dedupe-window-hours"] !== undefined) {
    result.dedupe_window_hours = validatePositiveInteger(
      a["dedupe-window-hours"],
      "alert.dedupe-window-hours"
    );
  }

  return result;
}

function validatePositiveNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    throw new Error(`'${fieldName}' must be a non-negative number, got: ${value}`);
  }
  return num;
}

function validatePositiveInteger(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num) || num < 1) {
    throw new Error(`'${fieldName}' must be a positive integer, got: ${value}`);
  }
  return num;
}
