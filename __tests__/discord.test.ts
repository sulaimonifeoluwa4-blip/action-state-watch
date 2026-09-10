import { buildDiscordMessage } from "../src/alerts/discord";
import { ContractScanResult } from "../src/types";

describe("alerts/discord", () => {
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

    const message = buildDiscordMessage(results);

    expect(message.content).toContain("1 alert(s)");
    expect(message.embeds).toHaveLength(1);
    expect(message.embeds[0].title).toContain("Critical");
    expect(message.embeds[0].color).toBe(0xe74c3c); // Red
    expect(message.embeds[0].fields).toBeDefined();
    expect(message.embeds[0].fields!.length).toBe(3);
    expect(message.embeds[0].fields![0].name).toBe("Ledgers Remaining");
    expect(message.embeds[0].fields![1].name).toBe("Days Remaining");
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

    const message = buildDiscordMessage(results);

    expect(message.embeds[0].title).toContain("Archived");
    expect(message.embeds[0].color).toBe(0x1a1a2e); // Dark
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

    const message = buildDiscordMessage(results);
    expect(message.embeds).toHaveLength(0);
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
        band: "ExpiringSoon",
        live_until_ledger_seq: 15000,
        ledgers_remaining: 1500,
        days_remaining: 15,
        healthy_days_threshold: 30,
        critical_days_threshold: 7,
        scanned_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const message = buildDiscordMessage(results);
    expect(message.embeds).toHaveLength(2);
    expect(message.embeds[0].title).toContain("Critical");
    expect(message.embeds[1].title).toContain("Expiring Soon");
  });
});
