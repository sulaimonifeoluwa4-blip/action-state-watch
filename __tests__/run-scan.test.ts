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

      // Mock successful scan output
      const sentinelOutput = JSON.stringify({
        health: "Healthy",
        live_until_ledger: 200000,
        ledgers_remaining: 100000,
        days_remaining: 30,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      });
      mockExecFileSync.mockReturnValue(sentinelOutput);

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

      // Third arg: options object (NOT a shell string)
      expect(callArgs[2]).toEqual(
        expect.objectContaining({
          encoding: "utf8",
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
        })
      );

      // Verify report
      expect(report.results).toHaveLength(1);
      expect(report.results[0].health).toBe("Healthy");
      expect(report.summary.healthy).toBe(1);
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

      mockExecFileSync.mockReturnValue(
        JSON.stringify({
          health: "ExpiringSoon",
          live_until_ledger: 5000,
          ledgers_remaining: 500,
          days_remaining: 5,
          healthy_days_threshold: 30,
          critical_days_threshold: 7,
          scanned_at: "2026-01-01T00:00:00.000Z",
        })
      );

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

      mockExecFileSync.mockReturnValue(
        JSON.stringify({
          health: "Healthy",
          live_until_ledger: 200000,
          ledgers_remaining: 100000,
          days_remaining: 30,
          healthy_days_threshold: 14,
          critical_days_threshold: 3,
          scanned_at: "2026-01-01T00:00:00.000Z",
        })
      );

      await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      const args = mockExecFileSync.mock.calls[0][1] as string[];
      expect(args).toContain("--healthy-days");
      expect(args).toContain("14");
      expect(args).toContain("--critical-days");
      expect(args).toContain("3");
    });

    test("passes --safety-margin-ledgers when set in global config", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
          },
        ],
        safety_margin_ledgers: 120960,
      };

      mockExecFileSync.mockReturnValue(
        JSON.stringify({
          health: "Healthy",
          live_until_ledger: 200000,
          ledgers_remaining: 100000,
          days_remaining: 30,
          scanned_at: "2026-01-01T00:00:00.000Z",
        })
      );

      await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      const args = mockExecFileSync.mock.calls[0][1] as string[];
      expect(args).toContain("--safety-margin-ledgers");
      expect(args).toContain("120960");
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
      expect(report.results[0].health).toBe("Archived");
      expect(report.results[0].error).toBe("sentinel binary not found");
      expect(report.summary.archived).toBe(1);
    });

    test("handles camelCase field names from sentinel output", async () => {
      const config: ContractsConfig = {
        network: "testnet",
        contracts: [
          {
            address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
          },
        ],
      };

      // camelCase output from sentinel
      mockExecFileSync.mockReturnValue(
        JSON.stringify({
          health: "ExpiringSoon",
          liveUntilLedgerSeq: 5000,
          ledgersRemaining: 500,
          daysRemaining: 5,
          scanned_at: "2026-01-01T00:00:00.000Z",
        })
      );

      const report = await runScan("/usr/bin/sentinel", config, "https://rpc.test");

      expect(report.results[0].live_until_ledger).toBe(5000);
      expect(report.results[0].ledgers_remaining).toBe(500);
      expect(report.results[0].days_remaining).toBe(5);
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

      mockExecFileSync.mockReturnValue(
        JSON.stringify({
          health: "Healthy",
          live_until_ledger: 200000,
          ledgers_remaining: 100000,
          days_remaining: 30,
          scanned_at: "2026-01-01T00:00:00.000Z",
        })
      );

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
