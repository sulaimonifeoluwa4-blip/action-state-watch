import { execFileSync } from "child_process";
import { ContractsConfig } from "../src/types";

// Mock @actions/core
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  getInput: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
}));

// Mock child_process
jest.mock("child_process", () => ({
  execFileSync: jest.fn(),
  execSync: jest.fn(),
}));

// Mock fs
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  accessSync: jest.fn(),
  constants: { X_OK: 1 },
}));

import { runScan, resolveSentinelCli } from "../src/run-scan";

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;

/** Build a valid sentinel ScanJson for test purposes. */
function makeScanJson(overrides?: { band?: string; live_until?: number; ledgers_remaining?: number; days_remaining?: number }) {
  return {
    schema_version: "1.1.0",
    generated_at_unix: 1704067200,
    command: {
      subcommand: "scan",
      contract_id: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
      rpc_url: "https://soroban-testnet.stellar.org",
    },
    network: {
      passphrase: "Test SDF Network ; September 2015",
      protocol_version: 20,
      latest_ledger: 12345,
      ledger_close_seconds: 5,
      ledger_close_seconds_source: "default",
      fee_per_rent_1kb: 100,
      fee_per_rent_1kb_source: "state_size_high",
      average_soroban_state_size_bytes: null,
      max_entry_ttl: 1209600,
      min_persistent_ttl: 2073600,
      min_temporary_ttl: 2073600,
    },
    health_config: {
      healthy_min_days: 30,
      critical_max_days: 7,
      healthy_min_ledgers: 518400,
      critical_max_ledgers: 120960,
      extend_horizon_ledgers: 518400,
    },
    summary: {
      entries_scanned: 1,
      healthy: overrides?.band === "healthy" ? 1 : 0,
      expiring_soon: overrides?.band === "expiring_soon" ? 1 : 0,
      critical: overrides?.band === "critical" ? 1 : 0,
      archived: overrides?.band === "archived" ? 1 : 0,
      has_critical: overrides?.band === "critical" || overrides?.band === "archived",
    },
    entries: [
      {
        id: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
        label: "contract-instance",
        kind: "contract-instance",
        durability: "persistent",
        band: overrides?.band ?? "healthy",
        current_ledger_seq: 12345,
        live_until_ledger_seq: overrides?.live_until ?? 200000,
        ledgers_remaining: overrides?.ledgers_remaining ?? 100000,
        days_remaining: overrides?.days_remaining ?? 30,
        estimated_archive_unix: null,
        size_bytes: 128,
        key_xdr: "AAAAAQ==",
        ttl_key_xdr: "AAAAAQ==",
        extend_to_healthy_cost_stroops: 100,
        restore_cost_stroops: null,
      },
    ],
  };
}

describe("run-scan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("runScan", () => {
    test("calls execFileSync with sentinelPath and args array (no shell string)", async () => {
      const sentinelPath = "/usr/local/bin/soroban-state-sentinel";
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
            label: "test-contract",
          },
        ],
      };
      const rpcUrl = "https://soroban-testnet.stellar.org";

      mockExecFileSync.mockReturnValue(JSON.stringify(makeScanJson({ band: "healthy" })));

      const report = await runScan(sentinelPath, config, rpcUrl);

      // Verify execFileSync is called with (sentinelPath, argsArray, options)
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
      const callArgs = mockExecFileSync.mock.calls[0];

      // First arg: sentinelPath (string, NOT a concatenated command)
      expect(callArgs[0]).toBe(sentinelPath);

      // Second arg: args array (NOT a string)
      expect(Array.isArray(callArgs[1])).toBe(true);
      const args = callArgs[1] as string[];
      expect(args[0]).toBe("scan");
      expect(args).toContain("--rpc-url");
      expect(args).toContain("--json");
      expect(args).toContain(rpcUrl);
      expect(args).toContain(
        "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4"
      );

      // Verify NO --safety-margin-ledgers flag (doesn't exist in real sentinel)
      expect(args).not.toContain("--safety-margin-ledgers");

      // Third arg: options object (NOT a shell string)
      expect(callArgs[2]).toEqual(
        expect.objectContaining({
          encoding: "utf8",
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
        })
      );

      // Verify report uses lowercase snake_case band values
      expect(report.results).toHaveLength(1);
      expect(report.results[0].band).toBe("healthy");
      expect(report.summary.healthy).toBe(1);
    });

    test("parses sentinel ScanJson and maps band correctly", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
          },
        ],
      };

      mockExecFileSync.mockReturnValue(
        JSON.stringify(makeScanJson({ band: "expiring_soon", live_until: 5000, ledgers_remaining: 500, days_remaining: 5 }))
      );

      const report = await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      expect(report.results[0].band).toBe("expiring_soon");
      expect(report.results[0].live_until_ledger_seq).toBe(5000);
      expect(report.results[0].ledgers_remaining).toBe(500);
      expect(report.results[0].days_remaining).toBe(5);
    });

    test("passes --keys flag when keys are specified", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
            keys: ["AAAAAQ==", "AAAAAg=="],
          },
        ],
      };

      mockExecFileSync.mockReturnValue(JSON.stringify(makeScanJson({ band: "expiring_soon" })));

      await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      const args = mockExecFileSync.mock.calls[0][1] as string[];
      expect(args).toContain("--keys");
      expect(args).toContain("AAAAAQ==");
      expect(args).toContain("AAAAAg==");
    });

    test("passes --healthy-days and --critical-days when specified", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
            healthy_days: 14,
            critical_days: 3,
          },
        ],
      };

      mockExecFileSync.mockReturnValue(JSON.stringify(makeScanJson({ band: "healthy" })));

      await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      const args = mockExecFileSync.mock.calls[0][1] as string[];
      expect(args).toContain("--healthy-days");
      expect(args).toContain("14");
      expect(args).toContain("--critical-days");
      expect(args).toContain("3");
    });

    test("handles scan failure gracefully", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
          },
        ],
      };

      mockExecFileSync.mockImplementation(() => {
        throw new Error("sentinel binary not found");
      });

      const report = await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      expect(report.results).toHaveLength(1);
      expect(report.results[0].band).toBe("archived");
      expect(report.results[0].error).toBe("sentinel binary not found");
      expect(report.summary.archived).toBe(1);
    });

    test("handles empty entries from sentinel", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
          },
        ],
      };

      // Sentinel returned no entries
      mockExecFileSync.mockReturnValue(
        JSON.stringify({
          schema_version: "1.1.0",
          generated_at_unix: 1704067200,
          command: { subcommand: "scan", contract_id: "C...", rpc_url: "https://..." },
          network: { passphrase: "", protocol_version: 20, latest_ledger: 0, ledger_close_seconds: 5, ledger_close_seconds_source: "default", fee_per_rent_1kb: 0, fee_per_rent_1kb_source: "default", average_soroban_state_size_bytes: null, max_entry_ttl: 0, min_persistent_ttl: 0, min_temporary_ttl: 0 },
          health_config: { healthy_min_days: 30, critical_max_days: 7, healthy_min_ledgers: 0, critical_max_ledgers: 0, extend_horizon_ledgers: 0 },
          summary: { entries_scanned: 0, healthy: 0, expiring_soon: 0, critical: 0, archived: 0, has_critical: false },
          entries: [],
        })
      );

      const report = await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      expect(report.results).toHaveLength(1);
      expect(report.results[0].band).toBe("healthy");
    });

    test("never concatenates sentinelPath into a shell command string", async () => {
      const sentinelPath = "/tmp/weird path/with spaces/sentinel";
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
          },
        ],
      };

      mockExecFileSync.mockReturnValue(JSON.stringify(makeScanJson({ band: "healthy" })));

      await runScan(sentinelPath, config, "https://rpc.test");

      // Verify first argument to execFileSync is the raw path, not a concatenated string
      const firstArg = mockExecFileSync.mock.calls[0][0] as string;
      expect(firstArg).toBe(sentinelPath);

      // The second argument must be an array, never a string
      expect(typeof mockExecFileSync.mock.calls[0][1]).not.toBe("string");
    });
  });

  describe("resolveSentinelCli", () => {
    test("returns provided path when it exists and is executable", async () => {
      const { existsSync, accessSync } = require("fs");
      existsSync.mockReturnValue(true);
      accessSync.mockReturnValue(undefined);

      const result = await resolveSentinelCli("/usr/bin/sentinel");
      expect(result).toBe("/usr/bin/sentinel");
    });

    test("throws when path does not exist", async () => {
      const { existsSync } = require("fs");
      existsSync.mockReturnValue(false);

      await expect(resolveSentinelCli("/nonexistent")).rejects.toThrow(
        "Sentinel CLI not found"
      );
    });
  });
});
