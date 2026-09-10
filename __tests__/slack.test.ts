import { buildSlackMessage } from "../src/alerts/slack";
import { ContractScanResult } from "../src/types";

describe("alerts/slack", () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("builds message for Critical contract", () => {
    const results: ContractScanResult[] = [
      {
        address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
        label: "test-contract",
        band: "Critical",
        live_until_ledger_seq: 5000,
        ledgers_remaining: 500,
        days_remaining: 5,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const message = buildSlackMessage(results);

    expect(message.text).toContain("1 contract(s) need attention");
    expect(message.blocks.length).toBeGreaterThan(0);
    expect(message.blocks[0].type).toBe("header");

    // Should contain the contract info
    const textBlock = message.blocks.find((b) => b.text?.text?.includes("Critical"));
    expect(textBlock).toBeDefined();
  });

  test("builds message for Archived contract", () => {
    const results: ContractScanResult[] = [
      {
        address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
        band: "Archived",
        live_until_ledger_seq: 0,
        ledgers_remaining: 0,
        days_remaining: 0,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const message = buildSlackMessage(results);

    expect(message.text).toContain("1 contract(s) need attention");
    const textBlock = message.blocks.find((b) => b.text?.text?.includes("Archived"));
    expect(textBlock).toBeDefined();
  });

  test("returns empty message when all healthy", () => {
    const results: ContractScanResult[] = [
      {
        address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
        band: "Healthy",
        live_until_ledger_seq: 200000,
        ledgers_remaining: 100000,
        days_remaining: 30,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const message = buildSlackMessage(results);
    expect(message.blocks).toHaveLength(0);
    expect(message.text).toBe("All contracts healthy.");
  });

  test("builds message for multiple contracts", () => {
    const results: ContractScanResult[] = [
      {
        address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
        label: "contract-a",
        band: "Critical",
        live_until_ledger_seq: 5000,
        ledgers_remaining: 500,
        days_remaining: 5,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      },
      {
        address: "GCEZxee7L6Dx8EtiYXRzWZ6F7zB3nJpQR3kdBbA6FPX6",
        label: "contract-b",
        band: "Archived",
        live_until_ledger_seq: 0,
        ledgers_remaining: 0,
        days_remaining: 0,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const message = buildSlackMessage(results);
    expect(message.text).toContain("2 contract(s) need attention");
  });
});
