import { describe, expect, it } from 'vitest'
import { buildCanonicalCashTransferTx, canonicalUnsignedPayload } from './nodeClient'

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

describe('nodeClient canonical payload helpers', () => {
  const base = {
    senderPubkeyHex: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
    nonce: 7,
    to: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    amount: 42,
    tip: 3,
    feeLimit: 999,
  }

  it('keeps the unsigned payload stable when only sig changes', () => {
    const a = buildCanonicalCashTransferTx({ ...base, sig: 'aa' })
    const b = buildCanonicalCashTransferTx({ ...base, sig: 'bb' })

    expect(toHex(canonicalUnsignedPayload(a))).toBe(toHex(canonicalUnsignedPayload(b)))
  })

  it('changes the unsigned payload when canonical transaction fields change', () => {
    const nonceA = buildCanonicalCashTransferTx({ ...base, sig: 'aa' })
    const nonceB = buildCanonicalCashTransferTx({ ...base, nonce: 8, sig: 'aa' })
    const tipB = buildCanonicalCashTransferTx({ ...base, tip: 4, sig: 'aa' })
    const feeB = buildCanonicalCashTransferTx({ ...base, feeLimit: 1000, sig: 'aa' })

    expect(toHex(canonicalUnsignedPayload(nonceA))).not.toBe(toHex(canonicalUnsignedPayload(nonceB)))
    expect(toHex(canonicalUnsignedPayload(nonceA))).not.toBe(toHex(canonicalUnsignedPayload(tipB)))
    expect(toHex(canonicalUnsignedPayload(nonceA))).not.toBe(toHex(canonicalUnsignedPayload(feeB)))
  })

  it('normalizes the sender public key to lowercase hex', () => {
    const tx = buildCanonicalCashTransferTx({ ...base, sig: 'aa' })
    expect(tx.sender_pubkey).toBe(tx.sender_pubkey.toLowerCase())
  })
})
