import { mapSeverity, shouldAlert, formatAlertSummary } from "../src/severity";
import { ContractScanResult, HealthBand } from "../src/types";

describe("severity", () => {
  describe("mapSeverity", () => {
    test("healthy maps to no alert", () => {
      const result = mapSeverity("healthy");
      expect(result.severity).toBe("none");
      expect(result.shouldAlert).toBe(false);
      expect(result.emoji).toBe("✅");
    });

    test("expiring_soon maps to info severity", () => {
      const result = mapSeverity("expiring_soon");
      expect(result.severity).toBe("info");
      expect(result.shouldAlert).toBe(true);
      expect(result.emoji).toBe("⚠️");
    });

    test("critical maps to high severity", () => {
      const result = mapSeverity("critical");
      expect(result.severity).toBe("high");
      expect(result.shouldAlert).toBe(true);
      expect(result.emoji).toBe("🔴");
    });

    test("archived maps to critical severity", () => {
      const result = mapSeverity("archived");
      expect(result.severity).toBe("critical");
      expect(result.shouldAlert).toBe(true);
      expect(result.emoji).toBe("💀");
    });
  });

  describe("shouldAlert", () => {
    test("Healthy contract does not trigger alert", () => {
      const result: ContractScanResult = makeResult("healthy", 100000, 100, 30);
      expect(shouldAlert(result)).toBe(false);
    });

    test("ExpiringSoon contract triggers alert", () => {
      const result: ContractScanResult = makeResult("expiring_soon", 50000, 50, 15);
      expect(shouldAlert(result)).toBe(true);
    });

    test("Critical contract triggers alert", () => {
      const result: ContractScanResult = makeResult("critical", 10000, 10, 5);
      expect(shouldAlert(result)).toBe(true);
    });

    test("Archived contract triggers alert", () => {
      const result: ContractScanResult = makeResult("archived", 0, 0, 0);
      expect(shouldAlert(result)).toBe(true);
    });
  });

  describe("formatAlertSummary", () => {
    test("Healthy contract shows healthy summary", () => {
      const result: ContractScanResult = makeResult("healthy", 200000, 200, 30);
      const summary = formatAlertSummary(result);
      expect(summary).toContain("✅");
      expect(summary).toContain("Healthy");
      expect(summary).not.toContain("Ledgers remaining");
    });

    test("Critical contract shows detailed summary", () => {
      const result: ContractScanResult = makeResult("critical", 5000, 5, 3);
      const summary = formatAlertSummary(result);
      expect(summary).toContain("🔴");
      expect(summary).toContain("Critical");
      expect(summary).toContain("Ledgers remaining");
      expect(summary).toContain("5");
    });

    test("Archived contract shows action required", () => {
      const result: ContractScanResult = makeResult("archived", 0, 0, 0);
      const summary = formatAlertSummary(result);
      expect(summary).toContain("💀");
      expect(summary).toContain("Action required now");
    });

    test("uses label when available", () => {
      const result: ContractScanResult = makeResult("critical", 5000, 5, 3);
      result.label = "my-test-contract";
      const summary = formatAlertSummary(result);
      expect(summary).toContain("my-test-contract");
    });

    test("falls back to address when no label", () => {
      const result: ContractScanResult = makeResult("critical", 5000, 5, 3);
      const summary = formatAlertSummary(result);
      expect(summary).toContain(result.address);
    });
  });
});

function makeResult(
  band: HealthBand,
  liveUntil: number,
  ledgersRemaining: number,
  daysRemaining: number
): ContractScanResult {
  return {
    address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
    band,
    live_until_ledger_seq: liveUntil,
    ledgers_remaining: ledgersRemaining,
    days_remaining: daysRemaining,
    healthy_days_threshold: 30,
    critical_days_threshold: 7,
    scanned_at: new Date().toISOString(),
  };
}
