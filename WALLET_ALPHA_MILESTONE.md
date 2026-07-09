# Wallet Alpha Milestone

## Repo Status

- Repository initialized and pushed to `main`.
- Current wallet repo commit history includes the alpha API migration, local signing flow, alpha route cleanup, and live-node harness work.

## Completed Commits

- `10fc5bd` - Wallet Alpha Phase 1 - Connect frontend to Vision-Core APIs
- `9c7ffa5` - Add Wallet Alpha status document
- `f956782` - Resolve wallet handle validation test
- `8882270` - Add canonical wallet signing flow
- `d42bcce` - Prepare Wallet Alpha route set
- `df1de98` - Add Wallet Alpha live-node integration harness

## Vision-Core APIs Connected

- `GET /status`
- `GET /balance/{address}`
- `GET /nonce/{address}`
- `GET /transaction/{txid}`
- `POST /transactions`

## Local Signing

- Canonical `cash::transfer` transactions are built in the wallet.
- Nonce is read from Vision-Core.
- `sender_pubkey` is derived locally from wallet key material.
- The unsigned canonical payload is signed locally.
- Private keys are not sent to Vision-Core.

## Alpha Route Set

- Marketplace, exchange, vault, guardian, Discord, miner fleet, and experimental routes are hidden or redirected out of the alpha UI.
- Wallet Alpha shows only the wallet create/import, balance, nonce, send, transaction status, and node status surface.

## Live-Node Harness

- A gated live Vision-Core integration harness exists in `src/lib/liveNode.integration.test.ts`.
- It is skipped by default and requires explicit live-node environment variables.

## Verification Status

- `npm run test:run` passed
- `npm run build` passed

## Remaining Work Before Public Alpha

1. Run the live harness against an actual Vision-Core node.
2. Polish wallet UX.
3. Package the wallet release.
4. Write the user quick-start.
