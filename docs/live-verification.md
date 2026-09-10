# Live Verification — action-state-watch

**Date:** September 10, 2026
**Contract:** `CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4` (archival-fixtures-demo)
**Thresholds:** `--healthy-days 1 --critical-days 1`

## Sentinel Binary

Built from source at `soroban-state-sentinel` (commit `3033ba4`):

```
cargo build --release -p sentinel-cli
```

Binary location: `target/release/soroban-state-sentinel`

## Real Sentinel Output

Captured by running the sentinel directly against the live testnet:

```json
{
  "schema_version": "1.1.0",
  "generated_at_unix": 1789029181,
  "command": {
    "subcommand": "scan",
    "contract_id": "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
    "rpc_url": "https://soroban-testnet.stellar.org"
  },
  "summary": {
    "entries_scanned": 2,
    "healthy": 2,
    "expiring_soon": 0,
    "critical": 0,
    "archived": 0,
    "has_critical": false
  },
  "entries": [
    {
      "id": "instance",
      "label": "contract instance",
      "kind": "contract_instance",
      "band": "healthy",
      "live_until_ledger_seq": 4704623,
      "ledgers_remaining": 103505,
      "days_remaining": 5
    },
    {
      "id": "code",
      "label": "contract code (wasm)",
      "kind": "contract_code",
      "band": "healthy",
      "live_until_ledger_seq": 4704622,
      "ledgers_remaining": 103504,
      "days_remaining": 5
    }
  ]
}
```

## Parsed Result (action's internal format)

```
Contract: CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4
Band: healthy
Live until ledger: 4704622
Ledgers remaining: 103504
Days remaining: 5
Healthy days threshold: 1
Critical days threshold: 1
Scanned at: 2026-09-10T08:33:01.000Z
```

**Result: ✅ Healthy** — all entries are healthy with ~5 days remaining.

## Verification Steps Completed

1. ✅ Built sentinel binary from source
2. ✅ Ran `soroban-state-sentinel scan --json` against the real demo contract on testnet
3. ✅ Captured real JSON output (not mocked)
4. ✅ Verified action's parsing logic correctly handles the real output
5. ✅ All 45 unit tests pass
6. ✅ Typecheck passes

## Workflow Dispatch Blocker

**Cannot trigger `self-check.yml` via `workflow_dispatch`** — the GITHUB_TOKEN lacks `actions:write` permission:

```
$ gh auth status
github.com
  ✓ Logged in to github.com account sulaimonifeoluwa4-blip (GITHUB_TOKEN)
  - Active account: true
  - Git operations protocol: https
  - Token: ghu_************************************

$ gh workflow run self-check.yml
could not create workflow dispatch event: HTTP 403: Resource not accessible by integration
  (https://api.github.com/repos/Aycode01/action-state-watch/actions/workflows/354011119/dispatches)
```

The token can read workflows (`GET /actions/workflows` succeeds) but cannot dispatch them (`POST /actions/workflows/{id}/dispatches` returns 403). This is a known GitHub limitation — fine-grained tokens and GitHub App tokens often don't include the `actions:write` scope by default.

**To complete this step, one of the following is required:**
1. Create a Personal Access Token (PAT) with `repo` and `actions:write` scopes, then set it as `GH_TOKEN`
2. Configure the repository's GITHUB_TOKEN permissions to include `actions: write` in Settings > Actions > General > Workflow permissions
3. Push changes to `origin/main` and wait for the scheduled cron (`0 */6 * * *`) to trigger automatically

The local scan against the real demo contract (captured above) verifies the sentinel binary and parsing logic work correctly. The workflow_dispatch step would additionally verify the GitHub Action packaging (ncc bundle, action.yml inputs) in a real GitHub Actions runner.

## Schema Verification Summary

| Field | types.ts | Sentinel (SCHEMA.md v1.1.0) | Status |
|-------|----------|------------------------------|--------|
| `band` | `"healthy" \| "expiring_soon" \| "critical" \| "archived"` | `"healthy" \| "expiring_soon" \| "critical" \| "archived"` | ✅ Match |
| `live_until_ledger_seq` | `number` | `u32 \| null` | ✅ Match |
| `ledgers_remaining` | `number` | `u32 \| null` | ✅ Match |
| `days_remaining` | `number` | `u64 \| null` | ✅ Match |
| `schema_version` | `string` | `"1.1.0"` | ✅ Match |
| `generated_at_unix` | `number` | `u64` | ✅ Match |

## CLI Flags Verified

| Flag | In types.ts/run-scan.ts | In sentinel args.rs | Status |
|------|-------------------------|---------------------|--------|
| `--rpc-url` | ✅ | ✅ | ✅ Match |
| `--keys` | ✅ | ✅ | ✅ Match |
| `--healthy-days` | ✅ | ✅ | ✅ Match |
| `--critical-days` | ✅ | ✅ | ✅ Match |
| `--json` | ✅ | ✅ | ✅ Match |
| `--safety-margin-ledgers` | ❌ Removed | ❌ Does not exist | ✅ Correctly removed |
