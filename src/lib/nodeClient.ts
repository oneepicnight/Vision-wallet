import { ed25519 } from './ed25519-setup'
import { loadConfig } from './config'

export interface WalletTransferRequest {
  from: string
  to: string
  amount: number
  nonce: number
  tip?: number
  feeLimit?: number
}

export interface CanonicalTx {
  nonce: number
  sender_pubkey: string
  module: string
  method: string
  args: number[]
  tip: number
  fee_limit: number
  sig: string
}

export interface CanonicalAccountBalance {
  address: string
  exists: boolean
  balance: number
}

export interface CanonicalAccountNonce {
  address: string
  exists: boolean
  nonce: number
}

export interface CanonicalTransactionLookup {
  tx_id: string
  found: boolean
  block_hash: string | null
  block_height: number | null
  tx_index: number | null
  tx: CanonicalTx | null
}

export interface CanonicalApiOptions {
  apiBase?: string
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.trim().toLowerCase()
  if (cleaned.length % 2 !== 0) throw new Error('hex length must be even')
  const out = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function encodeU64(value: number): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigUint64(0, BigInt(value), true)
  return out
}

function encodeBytes(bytes: Uint8Array): Uint8Array {
  return concatBytes(encodeU64(bytes.length), bytes)
}

function encodeString(value: string): Uint8Array {
  return encodeBytes(new TextEncoder().encode(value))
}

function encodeArgs(to: string, amount: number): number[] {
  return Array.from(new TextEncoder().encode(JSON.stringify({ to, amount })))
}

function encodeCanonicalTx(tx: CanonicalTx): Uint8Array {
  return concatBytes(
    encodeU64(tx.nonce),
    encodeString(tx.sender_pubkey),
    encodeString(tx.module),
    encodeString(tx.method),
    encodeBytes(Uint8Array.from(tx.args)),
    encodeU64(tx.tip),
    encodeU64(tx.fee_limit),
    encodeString(tx.sig),
  )
}

export function canonicalUnsignedPayload(tx: CanonicalTx): Uint8Array {
  return encodeCanonicalTx({ ...tx, sig: '' })
}

export function buildCanonicalCashTransferTx(input: {
  senderPubkeyHex: string
  nonce: number
  to: string
  amount: number
  tip?: number
  feeLimit?: number
  sig?: string
}): CanonicalTx {
  return {
    nonce: input.nonce,
    sender_pubkey: input.senderPubkeyHex.toLowerCase(),
    module: 'cash',
    method: 'transfer',
    args: encodeArgs(input.to, input.amount),
    tip: input.tip ?? 0,
    fee_limit: input.feeLimit ?? 100000,
    sig: input.sig ?? '',
  }
}

export async function signCanonicalCashTransfer(
  request: WalletTransferRequest,
  privateKeyHex: string,
): Promise<{ tx: CanonicalTx; signature: string; senderPubkeyHex: string }> {
  const privateKeyBytes = hexToBytes(privateKeyHex)
  const senderPubkeyHex = bytesToHex(ed25519.getPublicKey(privateKeyBytes)).toLowerCase()
  const unsignedTx = buildCanonicalCashTransferTx({
    senderPubkeyHex,
    nonce: request.nonce,
    to: request.to,
    amount: request.amount,
    tip: request.tip,
    feeLimit: request.feeLimit,
    sig: '',
  })
  const signature = bytesToHex(await ed25519.sign(canonicalUnsignedPayload(unsignedTx), privateKeyBytes))
  return {
    tx: { ...unsignedTx, sig: signature },
    signature,
    senderPubkeyHex,
  }
}

async function resolveApiBase(apiBaseOverride?: string): Promise<string> {
  if (apiBaseOverride) return apiBaseOverride.replace(/\/$/, '')
  const { apiBase } = await loadConfig()
  return apiBase.replace(/\/$/, '')
}

async function fetchJson<T>(path: string, init?: RequestInit, apiBaseOverride?: string): Promise<T> {
  const apiBase = await resolveApiBase(apiBaseOverride)
  const response = await fetch(`${apiBase}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`.trim())
  }
  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

export async function getNodeStatus(apiBase?: string): Promise<any> {
  return fetchJson('/status', undefined, apiBase)
}

export async function getCanonicalBalance(address: string, apiBase?: string): Promise<CanonicalAccountBalance> {
  return fetchJson(`/balance/${address}`, undefined, apiBase)
}

export async function getCanonicalNonce(address: string, apiBase?: string): Promise<CanonicalAccountNonce> {
  return fetchJson(`/nonce/${address}`, undefined, apiBase)
}

export async function getCanonicalTransaction(txId: string, apiBase?: string): Promise<CanonicalTransactionLookup> {
  return fetchJson(`/transaction/${txId}`, undefined, apiBase)
}

export async function submitCanonicalTx(tx: CanonicalTx, apiBase?: string): Promise<any> {
  return fetchJson('/transactions', {
    method: 'POST',
    body: JSON.stringify(tx),
  }, apiBase)
}
