# Wallet Alpha Status

- Repository initialized as a standalone git repo.
- Current commit: `10fc5bd`.
- Wallet frontend is connected to the Vision-Core API surface through the canonical client layer.
- `npm run build` passed.
- Canonical client tests passed.
- Full Vitest currently has one pre-existing smoke test failure around `isValidHandle` uppercase behavior.

## Next Steps

1. Decide the handle casing rule.
2. Fix or update the smoke test.
3. Connect the real wallet signing flow.
4. Remove marketplace and exchange routes from the alpha build.
5. Test against a live Vision-Core node.
