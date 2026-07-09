# Wallet Alpha Live-Node Harness

This repository includes a gated live-node integration harness in `src/lib/liveNode.integration.test.ts`.

It is skipped by default. To run it against a real Vision-Core node, set:

- `VISION_CORE_LIVE_URL` - Vision-Core base URL, for example `http://127.0.0.1:7070`
- `VISION_WALLET_LIVE_TEST_PRIVATE_KEY` - local wallet private key in lowercase hex
- `VISION_WALLET_LIVE_TEST_ADDRESS` - sender address
- `VISION_WALLET_LIVE_TEST_RECIPIENT` - recipient address
- Optional: `VISION_WALLET_LIVE_TEST_AMOUNT`, `VISION_WALLET_LIVE_TEST_TIP`, `VISION_WALLET_LIVE_TEST_FEE_LIMIT`

The harness verifies:

- `GET /status`
- `GET /balance/{address}`
- `GET /nonce/{address}`
- local canonical `cash::transfer` signing
- `POST /transactions`
- accepted/rejected result handling

It does not send private keys to Vision-Core.
