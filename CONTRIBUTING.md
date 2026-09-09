# Contributing to action-state-watch

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone <repo-url>
cd action-state-watch

# Install dependencies
npm install

# Run tests
npm test

# Typecheck
npm run typecheck

# Build
npm run build
```

## Project Structure

```
action-state-watch/
├── action.yml              # GitHub Action definition
├── src/
│   ├── index.ts            # Entry point — wires everything together
│   ├── config.ts           # contracts.yml parser + validation
│   ├── run-scan.ts         # Shells out to soroban-state-sentinel
│   ├── severity.ts         # Health band → alert severity mapping
│   ├── types.ts            # Typed mirror of SCHEMA.md 1.1.0
│   └── alerts/
│       ├── slack.ts        # Slack webhook POST
│       ├── discord.ts      # Discord webhook POST
│       └── github-issue.ts # Issue dedup, create, comment, auto-resolve
├── __tests__/              # Jest test files
├── .github/workflows/
│   ├── ci.yml              # PR-triggered: lint, test, build
│   └── self-check.yml      # Schedule-triggered: live contract check
├── contracts.example.yml   # Example config
└── dist/                   # Bundled output (ncc)
```

## Coding Standards

- **TypeScript strict mode** — no `any` types, strict null checks
- **No private keys** — this action never handles signing. If you need signing, that belongs in a separate repo.
- **No `git add .`** — stage specific files only
- **Conventional commits** — use `feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:` prefixes
- **One commit per logical unit**

## Testing

Tests use Jest with ts-jest. Run them with:

```bash
npm test
```

### Test Coverage

- **config.ts**: Valid/invalid YAML, missing fields, malformed addresses
- **severity.ts**: Boundary tests for each health band
- **alerts/**: Message format snapshot tests, dedup behavior
- **github-issue.ts**: Idempotency, recovery auto-close

### Writing Tests

Tests live in `__tests__/` and follow the naming convention `*.test.ts`. Mock `@actions/core` and `@actions/github` in your test files:

```typescript
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  // ...
}));
```

## Commit Messages

Follow conventional commit format:

```
feat(config): add contracts.yml parser
fix(alerts): handle empty webhook response
test(severity): add boundary tests for Archived band
docs: update README with cron example
ci: add self-check workflow
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure `npm test` and `npm run typecheck` pass
4. Build with `npm run build` and verify `dist/index.js` is updated
5. Submit PR with conventional commit title
6. Wait for CI checks to pass (ci.yml runs on pull_request)

## Important Rules

- **Never make `self-check.yml` a required check** — it only runs on schedule and would deadlock PR merges
- **Never add signing capability** — this action only scans and alerts
- **Read SCHEMA.md from soroban-state-sentinel** when updating types.ts — don't guess field names
