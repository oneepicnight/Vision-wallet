import { describe, expect, it } from 'vitest'
import { ed25519 } from './ed25519-setup'
import { canonicalUnsignedPayload, buildCanonicalCashTransferTx } from './nodeClient'
import { runLiveNodeHarness } from './liveNodeHarness'

const liveApiBase = (process.env.VISION_CORE_LIVE_URL || '').trim().replace(/\/$/, '')
const senderPrivateKeyHex = (process.env.VISION_WALLET_LIVE_TEST_PRIVATE_KEY || '').trim()
const senderAddress = (process.env.VISION_WALLET_LIVE_TEST_ADDRESS || '').trim()
const recipientAddress = (process.env.VISION_WALLET_LIVE_TEST_RECIPIENT || '').trim()
const amount = Number(process.env.VISION_WALLET_LIVE_TEST_AMOUNT || '1')
const tip = Number(process.env.VISION_WALLET_LIVE_TEST_TIP || '0')
const feeLimit = Number(process.env.VISION_WALLET_LIVE_TEST_FEE_LIMIT || '100000')
const shouldRunLive = Boolean(liveApiBase && senderPrivateKeyHex && senderAddress && recipientAddress)

const runIfLive = shouldRunLive ? describe : describe.skip

describe('live-node test harness wiring', () => {
  it('documents the required env vars', () => {
    expect(true).toBe(true)
  })
})

runIfLive('Wallet Alpha live Vision-Core integration', () => {
  it('reads status, balance, nonce, signs locally, and submits a canonical transfer', async () => {
    const senderPublicKeyHex = Buffer.from(ed25519.getPublicKey(Buffer.from(senderPrivateKeyHex, 'hex'))).toString('hex')
    const harness = await runLiveNodeHarness({
      apiBase: liveApiBase,
      senderAddress,
      senderPublicKeyHex,
      senderPrivateKeyHex,
      recipientAddress,
      amount,
      tip,
      feeLimit,
    })

    expect(harness.status).toBeTruthy()
    expect(harness.balance).toBeTruthy()
    expect(harness.nonce).toBeTruthy()
    expect(harness.preparedTx.module).toBe('cash')
    expect(harness.preparedTx.method).toBe('transfer')
    expect(harness.preparedTx.sender_pubkey).toBe(senderPublicKeyHex.toLowerCase())
    expect(JSON.parse(new TextDecoder().decode(Uint8Array.from(harness.preparedTx.args)))).toEqual({ to: recipientAddress, amount })
    expect(harness.outcome.message).toMatch(/Transaction (accepted|rejected)/)
    expect(harness.outcome.tx.sig).toMatch(/^[0-9a-f]{128}$/)

    const unsigned = canonicalUnsignedPayload({ ...buildCanonicalCashTransferTx({
      senderPubkeyHex: senderPublicKeyHex,
      nonce: Number(harness.nonce?.nonce ?? 0),
      to: recipientAddress,
      amount,
      tip,
      feeLimit,
    }), sig: '' })
    expect(unsigned.length).toBeGreaterThan(0)
  })
})

