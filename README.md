# action-state-watch

Scheduled TTL/archival health monitor for deployed Soroban contracts.

This GitHub Action runs on a cron schedule to monitor the health of Soroban smart contracts on the Stellar network. It checks contract state archival status and sends alerts via Slack, Discord, or GitHub Issues before contracts are archived.

## What It Does

On a cron schedule (not on pull requests), this action:

1. **Reads** contract addresses from a `contracts.yml` config file
2. **Scans** each contract using the `soroban-state-sentinel` CLI
3. **Classifies** health bands: `Healthy`, `ExpiringSoon`, `Critical`, `Archived`
4. **Alerts** via Slack, Discord, or GitHub Issues with severity-formatted messages
5. **Deduplicates** GitHub Issues per contract address
6. **Auto-closes** issues when contracts recover to Healthy
7. **Uploads** unsigned restore XDR as workflow artifacts (never signs or submits)

## Quick Start

### 1. Create `contracts.yml`

```yaml
network: testnet

contracts:
  - address: 'CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4'
    label: 'my-contract'
    keys: ['<padded SCVal XDR for your key>']
    healthy-days: 30
    critical-days: 7

safety-margin-ledgers: 120960  # ~7 days at 5s ledger close

alert:
  dedupe-window-hours: 24
```

### 2. Create the workflow

```yaml
name: Contract Health Monitor

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./
        with:
          sentinel-cli-path: 'install'
          config-path: 'contracts.yml'
          rpc-url: 'https://soroban-testnet.stellar.org'
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          # Or discord-webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
          # Or github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Configure Secrets

In your repository settings, add:

- **`SLACK_WEBHOOK_URL`** — Your Slack incoming webhook URL
- **`DISCORD_WEBHOOK_URL`** — Your Discord webhook URL
- **`GITHUB_TOKEN`** — Provided automatically if using `${{ secrets.GITHUB_TOKEN }}`

At least one alert channel must be configured.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `sentinel-cli-path` | No | `install` | Path to `soroban-state-sentinel` binary, or `install` to fetch |
| `config-path` | No | `contracts.yml` | Path to contracts config file |
| `rpc-url` | **Yes** | — | Stellar RPC node URL |
| `slack-webhook-url` | No | — | Slack incoming webhook URL |
| `discord-webhook-url` | No | — | Discord webhook URL |
| `github-token` | No | — | GitHub token for issue dedup |

## Outputs

| Output | Description |
|--------|-------------|
| `contracts-critical` | JSON array of addresses in Critical/Archived state |
| `restore-xdr-artifact` | Name of uploaded workflow artifact with unsigned XDR |

## Alert Severity

| Health Band | Severity | Behavior |
|-------------|----------|----------|
| ✅ Healthy | None | No alert |
| ⚠️ ExpiringSoon | Info | Informational alert |
| 🔴 Critical | High | Alert with ping/mention |
| 💀 Archived | Critical | "Action required now" alert |

## Configuration

### contracts.yml

```yaml
network: testnet  # or mainnet

contracts:
  - address: 'C...'       # Required: Stellar contract address
    label: 'My Contract'  # Optional: human-readable label
    keys: ['AAAAAQ==']    # Optional: padded SCVal XDR keys
    healthy-days: 30       # Optional: override default threshold
    critical-days: 7       # Optional: override default threshold

safety-margin-ledgers: 120960  # Optional: safety buffer in ledgers

alert:
  dedupe-window-hours: 24  # Optional: dedup window for GitHub Issues
```

### Threshold Overrides

You can override the sentinel's default thresholds (30 days healthy, 7 days critical) per contract. This is critical for test/demo contracts with short TTLs.

## Security

This action **never** holds, generates, or uses private keys. It never signs or submits transactions. It shells out to the sentinel CLI for scanning and POSTs alerts only.

See [SECURITY.md](SECURITY.md) for details.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Typecheck
npm run typecheck

# Build (bundles to dist/)
npm run build
```

## License

MIT
