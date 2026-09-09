import { mapSeverity, shouldAlert, formatAlertSummary } from "../src/severity";
import { ContractScanResult, HealthBand } from "../src/types";

describe("severity", () => {
  describe("mapSeverity", () => {
    test("Healthy maps to no alert", () => {
      const result = mapSeverity("Healthy");
      expect(result.severity).toBe("none");
      expect(result.shouldAlert).toBe(false);
      expect(result.emoji).toBe("✅");
    });

    test("ExpiringSoon maps to info severity", () => {
      const result = mapSeverity("ExpiringSoon");
      expect(result.severity).toBe("info");
      expect(result.shouldAlert).toBe(true);
      expect(result.emoji).toBe("⚠️");
    });

    test("Critical maps to high severity", () => {
      const result = mapSeverity("Critical");
      expect(result.severity).toBe("high");
      expect(result.shouldAlert).toBe(true);
      expect(result.emoji).toBe("🔴");
    });

    test("Archived maps to critical severity", () => {
      const result = mapSeverity("Archived");
      expect(result.severity).toBe("critical");
      expect(result.shouldAlert).toBe(true);
      expect(result.emoji).toBe("💀");
    });
  });

  describe("shouldAlert", () => {
    test("Healthy contract does not trigger alert", () => {
      const result: ContractScanResult = makeResult("Healthy", 100000, 100, 30);
      expect(shouldAlert(result)).toBe(false);
    });

    test("ExpiringSoon contract triggers alert", () => {
      const result: ContractScanResult = makeResult("ExpiringSoon", 50000, 50, 15);
      expect(shouldAlert(result)).toBe(true);
    });

    test("Critical contract triggers alert", () => {
      const result: ContractScanResult = makeResult("Critical", 10000, 10, 5);
      expect(shouldAlert(result)).toBe(true);
    });

    test("Archived contract triggers alert", () => {
      const result: ContractScanResult = makeResult("Archived", 0, 0, 0);
      expect(shouldAlert(result)).toBe(true);
    });
  });

  describe("formatAlertSummary", () => {
    test("Healthy contract shows healthy summary", () => {
      const result: ContractScanResult = makeResult("Healthy", 200000, 200, 30);
      const summary = formatAlertSummary(result);
      expect(summary).toContain("✅");
      expect(summary).toContain("Healthy");
      expect(summary).not.toContain("Ledgers remaining");
    });

    test("Critical contract shows detailed summary", () => {
      const result: ContractScanResult = makeResult("Critical", 5000, 5, 3);
      const summary = formatAlertSummary(result);
      expect(summary).toContain("🔴");
      expect(summary).toContain("Critical");
      expect(summary).toContain("Ledgers remaining");
      expect(summary).toContain("5");
    });

    test("Archived contract shows action required", () => {
      const result: ContractScanResult = makeResult("Archived", 0, 0, 0);
      result.restore_xdr = "AAAAAg==";
      const summary = formatAlertSummary(result);
      expect(summary).toContain("💀");
      expect(summary).toContain("Action required now");
      expect(summary).toContain("restore XDR");
    });

    test("uses label when available", () => {
      const result: ContractScanResult = makeResult("Critical", 5000, 5, 3);
      result.label = "my-test-contract";
      const summary = formatAlertSummary(result);
      expect(summary).toContain("my-test-contract");
    });

    test("falls back to address when no label", () => {
      const result: ContractScanResult = makeResult("Critical", 5000, 5, 3);
      const summary = formatAlertSummary(result);
      expect(summary).toContain(result.address);
    });
  });
});

function makeResult(
  health: HealthBand,
  liveUntil: number,
  ledgersRemaining: number,
  daysRemaining: number
): ContractScanResult {
  return {
    address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
    health,
    live_until_ledger: liveUntil,
    ledgers_remaining: ledgersRemaining,
    days_remaining: daysRemaining,
    healthy_days_threshold: 30,
    critical_days_threshold: 7,
    scanned_at: new Date().toISOString(),
  };
}
