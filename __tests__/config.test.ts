import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../src/config";

// Mock @actions/core
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  getInput: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
}));

describe("config", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const validConfigPath = path.join(fixturesDir, "valid.yml");

  beforeAll(() => {
    fs.mkdirSync(fixturesDir, { recursive: true });

    fs.writeFileSync(
      validConfigPath,
      `
network: testnet
contracts:
  - address: CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4
    label: test-contract
    healthy-days: 1
    critical-days: 1
safety-margin-ledgers: 120960
alert:
  dedupe-window-hours: 24
`
    );
  });

  afterAll(() => {
    fs.rmSync(fixturesDir, { recursive: true, force: true });
  });

  test("loads a valid config file", () => {
    const config = loadConfig(validConfigPath);

    expect(config.network).toBe("testnet");
    expect(config.contracts).toHaveLength(1);
    expect(config.contracts[0].address).toBe(
      "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4"
    );
    expect(config.contracts[0].label).toBe("test-contract");
    expect(config.contracts[0].healthy_days).toBe(1);
    expect(config.contracts[0].critical_days).toBe(1);
    expect(config.safety_margin_ledgers).toBe(120960);
    expect(config.alert?.dedupe_window_hours).toBe(24);
  });

  test("loads config with minimal fields", () => {
    const minimalPath = path.join(fixturesDir, "minimal.yml");
    fs.writeFileSync(
      minimalPath,
      `
network: testnet
contracts:
  - address: CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4
`
    );

    const config = loadConfig(minimalPath);
    expect(config.network).toBe("testnet");
    expect(config.contracts).toHaveLength(1);
    expect(config.contracts[0].label).toBeUndefined();
    expect(config.safety_margin_ledgers).toBeUndefined();
    expect(config.alert).toBeUndefined();
  });

  test("throws if config file does not exist", () => {
    expect(() => loadConfig("/nonexistent/path.yml")).toThrow("Config file not found");
  });

  test("throws if network is missing", () => {
    const badPath = path.join(fixturesDir, "no-network.yml");
    fs.writeFileSync(
      badPath,
      `
contracts:
  - address: CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4
`
    );

    expect(() => loadConfig(badPath)).toThrow("'network'");
  });

  test("throws if contracts is empty", () => {
    const badPath = path.join(fixturesDir, "empty-contracts.yml");
    fs.writeFileSync(
      badPath,
      `
network: testnet
contracts: []
`
    );

    expect(() => loadConfig(badPath)).toThrow("non-empty");
  });

  test("throws if address is invalid format", () => {
    const badPath = path.join(fixturesDir, "bad-address.yml");
    fs.writeFileSync(
      badPath,
      `
network: testnet
contracts:
  - address: not-a-valid-address
`
    );

    expect(() => loadConfig(badPath)).toThrow("valid Stellar address");
  });

  test("throws on malformed YAML", () => {
    const badPath = path.join(fixturesDir, "malformed.yml");
    fs.writeFileSync(
      badPath,
      `
network: testnet
contracts: [
  invalid yaml syntax here
  -
`
    );

    expect(() => loadConfig(badPath)).toThrow("Failed to parse YAML");
  });

  test("accepts multiple contracts", () => {
    const multiPath = path.join(fixturesDir, "multi.yml");
    fs.writeFileSync(
      multiPath,
      `
network: testnet
contracts:
  - address: CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4
    label: contract-1
    keys: ['AAAAAQ==']
  - address: GCEZXEE7L6DX8ETIYXRZWZ6F7ZBN3JPQR3KDBBA6FPX6ABCDEF123456
    label: contract-2
`
    );

    const config = loadConfig(multiPath);
    expect(config.contracts).toHaveLength(2);
    expect(config.contracts[0].keys).toEqual(["AAAAAQ=="]);
  });
});
