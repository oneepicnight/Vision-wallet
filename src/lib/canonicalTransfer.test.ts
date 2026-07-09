import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCanonicalCashTransferForWallet,
  CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT,
  CANONICAL_TRANSFER_DEFAULT_TIP,
  describeCanonicalCashTransferOutcome,
  prepareCanonicalCashTransfer,
  submitCanonicalCashTransfer,
} from './canonicalTransfer'

const PRIVATE_KEY = '1'.repeat(64)
const SENDER = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const RECIPIENT = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function jsonResponse(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    async json() {
      return body
    },
    async text() {
      return JSON.stringify(body)
    },
  } as any
}

describe('canonical wallet transfer flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/app/wallet-config.json')) {
        return jsonResponse(200, { apiBase: '' })
      }
      if (url.includes('/transactions')) {
        return jsonResponse(200, { status: 'accepted', tx_id: 'tx-123' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))
  })

  it('builds the canonical transfer payload with JSON args bytes', async () => {
    const prepared = await prepareCanonicalCashTransfer({
      from: '0xsender',
      to: RECIPIENT,
      amount: 42,
      nonce: 7,
      privateKeyHex: PRIVATE_KEY,
    })

    expect(prepared.tx.sender_pubkey).toMatch(/^[0-9a-f]{64}$/)
    expect(prepared.tx.sender_pubkey).toBe(prepared.tx.sender_pubkey.toLowerCase())
    expect(prepared.tx.module).toBe('cash')
    expect(prepared.tx.method).toBe('transfer')
    expect(prepared.tx.tip).toBe(CANONICAL_TRANSFER_DEFAULT_TIP)
    expect(prepared.tx.fee_limit).toBe(CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT)

    const decodedArgs = JSON.parse(new TextDecoder().decode(Uint8Array.from(prepared.tx.args)))
    expect(decodedArgs).toEqual({ to: RECIPIENT, amount: 42 })
  })

  it('generates a local signature without sending the private key to the node', async () => {
    const prepared = await prepareCanonicalCashTransfer({
      from: '0xsender',
      to: RECIPIENT,
      amount: 42,
      nonce: 7,
      privateKeyHex: PRIVATE_KEY,
    })

    expect(prepared.signature).toMatch(/^[0-9a-f]{128}$/)
    expect(prepared.signature.length).toBe(128)
    expect(prepared.tx.sig).toBe(prepared.signature)
  })

  it('submits only the signed canonical transaction body', async () => {
    const outcome = await submitCanonicalCashTransfer({
      from: '0xsender',
      to: RECIPIENT,
      amount: 42,
      nonce: 7,
      privateKeyHex: PRIVATE_KEY,
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.txid).toBe('tx-123')

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const submitted = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(submitted).toMatchObject({
      nonce: 7,
      sender_pubkey: expect.any(String),
      module: 'cash',
      method: 'transfer',
      tip: CANONICAL_TRANSFER_DEFAULT_TIP,
      fee_limit: CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT,
    })
    expect(submitted.privateKeyHex).toBeUndefined()
    expect(submitted.sig).toMatch(/^[0-9a-f]{128}$/)
  })

  it('returns a rejected outcome that the UI can display', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/app/wallet-config.json')) {
        return jsonResponse(200, { apiBase: '' })
      }
      if (url.includes('/transactions')) {
        return jsonResponse(400, { error: { message: 'insufficient funds' }, status: 'rejected' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const outcome = await submitCanonicalCashTransfer({
      from: '0xsender',
      to: RECIPIENT,
      amount: 42,
      nonce: 7,
      privateKeyHex: PRIVATE_KEY,
    })

    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain('Transaction rejected')
    expect(outcome.message).toContain('insufficient funds')
    expect(describeCanonicalCashTransferOutcome(outcome)).toBe(outcome.message)
  })

  it('builds the same canonical tx shape that will be submitted', () => {
    const tx = buildCanonicalCashTransferForWallet({
      senderPubkeyHex: SENDER,
      from: '0xsender',
      to: RECIPIENT,
      amount: 42,
      nonce: 7,
    })

    expect(tx).toMatchObject({
      nonce: 7,
      sender_pubkey: SENDER,
      module: 'cash',
      method: 'transfer',
      tip: CANONICAL_TRANSFER_DEFAULT_TIP,
      fee_limit: CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT,
    })
  })
})

