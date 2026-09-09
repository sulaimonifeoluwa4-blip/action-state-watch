import { STATE_WATCH_LABEL } from "../src/alerts/github-issue";
import { ContractScanResult } from "../src/types";

// Mock @actions/github and @actions/core
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  getInput: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
}));

jest.mock("@actions/github", () => {
  const mockIssues = {
    listForRepo: jest.fn(),
    create: jest.fn(),
    createComment: jest.fn(),
    update: jest.fn(),
  };

  return {
    context: {
      repo: { owner: "test-owner", repo: "test-repo" },
    },
    getOctokit: jest.fn(() => ({
      rest: { issues: mockIssues },
    })),
    __mockIssues: mockIssues,
  };
});

import { handleGitHubIssues } from "../src/alerts/github-issue";
import * as github from "@actions/github";

describe("alerts/github-issue", () => {
  const mockIssues = (github as any).__mockIssues;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const criticalResult: ContractScanResult = {
    address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
    label: "test-contract",
    health: "Critical",
    live_until_ledger: 5000,
    ledgers_remaining: 500,
    days_remaining: 5,
    healthy_days_threshold: 30,
    critical_days_threshold: 7,
    scanned_at: "2026-01-01T00:00:00.000Z",
  };

  const healthyResult: ContractScanResult = {
    address: "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
    health: "Healthy",
    live_until_ledger: 200000,
    ledgers_remaining: 100000,
    days_remaining: 30,
    healthy_days_threshold: 30,
    critical_days_threshold: 7,
    scanned_at: "2026-01-01T00:00:00.000Z",
  };

  test("creates issue when none exists for Critical contract", async () => {
    // No existing issues
    mockIssues.listForRepo.mockResolvedValue({ data: [] });
    mockIssues.create.mockResolvedValue({ data: { number: 1 } });
    // For recovery check
    mockIssues.listForRepo
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    await handleGitHubIssues("fake-token", [criticalResult]);

    expect(mockIssues.create).toHaveBeenCalledTimes(1);
    expect(mockIssues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: [STATE_WATCH_LABEL],
        title: expect.stringContaining("CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4"),
      })
    );
  });

  test("does not duplicate issue when one already exists", async () => {
    // Existing issue found
    mockIssues.listForRepo
      .mockResolvedValueOnce({
        data: [
          {
            number: 42,
            title: `[state-watch] Critical: ${criticalResult.address}`,
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            number: 42,
            title: `[state-watch] Critical: ${criticalResult.address}`,
          },
        ],
      });
    mockIssues.createComment.mockResolvedValue({ data: {} });

    await handleGitHubIssues("fake-token", [criticalResult]);

    // Should comment, not create
    expect(mockIssues.create).not.toHaveBeenCalled();
    expect(mockIssues.createComment).toHaveBeenCalledTimes(1);
    expect(mockIssues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 42,
      })
    );
  });

  test("auto-closes issue when contract recovers to Healthy", async () => {
    // Existing issue for the contract
    const existingIssue = {
      number: 42,
      title: `[state-watch] Critical: ${criticalResult.address}`,
    };

    mockIssues.listForRepo
      .mockResolvedValueOnce({
        data: [existingIssue],
      })
      .mockResolvedValueOnce({
        data: [existingIssue],
      });
    mockIssues.createComment.mockResolvedValue({ data: {} });
    mockIssues.update.mockResolvedValue({ data: {} });

    // The contract is now Healthy
    await handleGitHubIssues("fake-token", [healthyResult]);

    // Should have been called to list for recovery check
    expect(mockIssues.listForRepo).toHaveBeenCalled();
    // Should have commented recovery and closed the issue
    expect(mockIssues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 42,
        body: expect.stringContaining("Recovery Confirmed"),
      })
    );
    expect(mockIssues.update).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 42,
        state: "closed",
        state_reason: "completed",
      })
    );
  });

  test("does not create issue for Healthy contracts", async () => {
    mockIssues.listForRepo.mockResolvedValue({ data: [] });

    await handleGitHubIssues("fake-token", [healthyResult]);

    expect(mockIssues.create).not.toHaveBeenCalled();
  });

  test("creates issue for Archived contracts", async () => {
    const archivedResult: ContractScanResult = {
      ...criticalResult,
      health: "Archived",
      live_until_ledger: 0,
      ledgers_remaining: 0,
      days_remaining: 0,
      restore_xdr: "AAAAAg==",
    };

    mockIssues.listForRepo
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    mockIssues.create.mockResolvedValue({ data: { number: 1 } });

    await handleGitHubIssues("fake-token", [archivedResult]);

    expect(mockIssues.create).toHaveBeenCalledTimes(1);
    expect(mockIssues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: [STATE_WATCH_LABEL],
        title: expect.stringContaining("Archived"),
      })
    );
  });

  test("second run updates existing issue instead of duplicating", async () => {
    // First run: no existing issues, should create
    mockIssues.listForRepo
      .mockResolvedValueOnce({ data: [] }) // search for existing
      .mockResolvedValueOnce({ data: [] }); // recovery check
    mockIssues.create.mockResolvedValue({ data: { number: 1 } });

    await handleGitHubIssues("fake-token", [criticalResult]);
    expect(mockIssues.create).toHaveBeenCalledTimes(1);

    // Second run: issue now exists, should comment
    mockIssues.listForRepo
      .mockResolvedValueOnce({
        data: [
          {
            number: 1,
            title: `[state-watch] Critical: ${criticalResult.address}`,
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            number: 1,
            title: `[state-watch] Critical: ${criticalResult.address}`,
          },
        ],
      });
    mockIssues.createComment.mockResolvedValue({ data: {} });

    await handleGitHubIssues("fake-token", [criticalResult]);

    // Should NOT create a second issue
    expect(mockIssues.create).toHaveBeenCalledTimes(1); // still just 1 from first run
    // Should comment on existing
    expect(mockIssues.createComment).toHaveBeenCalledTimes(1);
  });
});
