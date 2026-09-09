# Security Policy

## Trust Boundary

This action has a deliberately minimal trust boundary:

### What This Action Does

- **Scans** contract TTL/archival status via the `soroban-state-sentinel` CLI
- **Reads** public blockchain state via Stellar RPC
- **Posts** alerts to Slack/Discord webhooks
- **Creates/manages** GitHub Issues (with dedup)
- **Uploads** unsigned XDR as workflow artifacts

### What This Action NEVER Does

- ❌ **Never holds, generates, or uses a private key**
- ❌ **Never signs a transaction**
- ❌ **Never submits a transaction to the network**
- ❌ **Never writes to the blockchain**

If a future requirement asks this action to sign or submit transactions, that is a **different trust boundary** and must be implemented in a separate, explicitly-scoped repository.

## Secret Management

### Required Secrets

| Secret | Purpose | Stored In |
|--------|---------|-----------|
| `SLACK_WEBHOOK_URL` | Slack alert delivery | GitHub Secrets |
| `DISCORD_WEBHOOK_URL` | Discord alert delivery | GitHub Secrets |
| `GITHUB_TOKEN` | Issue management | GitHub Actions (automatic) |

### Security Best Practices

- Use repository secrets, never hardcode credentials
- Rotate webhook URLs periodically
- Use a dedicated GitHub token with minimal permissions (just `issues: write`)
- Review webhook logs periodically for unauthorized alerts

## Data Flow

```
contracts.yml → sentinel CLI → RPC calls → parse results → POST alerts
                                         ↓
                                   unsigned XDR → workflow artifact
```

- No data is persisted beyond the workflow run
- RPC calls are read-only (`getLedgerEntries`)
- Alert webhooks receive only contract addresses and health status
- No user PII is transmitted

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do not** open a public GitHub Issue
2. Email security concerns to the repository maintainer
3. Include steps to reproduce the issue
4. Allow reasonable time for a fix before public disclosure

## Audit Considerations

This action is designed for monitoring, not for control. It cannot:

- Modify contract state
- Transfer assets
- Execute transactions
- Access private keys

The unsigned XDR it produces must be signed and submitted by a separate, authorized process with its own trust boundary.
