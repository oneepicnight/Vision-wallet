import { buildCanonicalCashTransferTx, signCanonicalCashTransfer, submitCanonicalTx, type CanonicalTx } from './nodeClient'

export const CANONICAL_TRANSFER_DEFAULT_TIP = 0
export const CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT = 100000

export interface CanonicalCashTransferRequest {
  from: string
  to: string
  amount: number
  nonce: number
  privateKeyHex: string
  tip?: number
  feeLimit?: number
  apiBase?: string
}

export interface CanonicalCashTransferPrepared {
  tx: CanonicalTx
  signature: string
  senderPubkeyHex: string
}

export interface CanonicalCashTransferOutcome {
  ok: boolean
  txid: string
  message: string
  tx: CanonicalTx
  senderPubkeyHex: string
  signature: string
}

function normalizeOutcome(response: any, prepared: CanonicalCashTransferPrepared): CanonicalCashTransferOutcome {
  const txid = response?.tx_id || response?.txid || response?.id || 'pending'
  const accepted = String(response?.status || '').toLowerCase() === 'accepted' || response?.error == null
  const reason = response?.error?.message || response?.error?.code || response?.message || 'Transaction not accepted'
  const message = accepted
    ? `Transaction accepted${txid !== 'pending' ? ` (${txid})` : ''}`
    : `Transaction rejected: ${reason}`

  return {
    ok: accepted,
    txid: accepted ? txid : `error:${reason}`,
    message,
    tx: prepared.tx,
    senderPubkeyHex: prepared.senderPubkeyHex,
    signature: prepared.signature,
  }
}

export async function prepareCanonicalCashTransfer(request: CanonicalCashTransferRequest): Promise<CanonicalCashTransferPrepared> {
  return signCanonicalCashTransfer(
    {
      from: request.from,
      to: request.to,
      amount: request.amount,
      nonce: request.nonce,
      tip: request.tip ?? CANONICAL_TRANSFER_DEFAULT_TIP,
      feeLimit: request.feeLimit ?? CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT,
    },
    request.privateKeyHex,
  )
}

export function buildCanonicalCashTransferForWallet(request: Omit<CanonicalCashTransferRequest, 'privateKeyHex'> & { senderPubkeyHex: string }): CanonicalTx {
  return buildCanonicalCashTransferTx({
    senderPubkeyHex: request.senderPubkeyHex,
    nonce: request.nonce,
    to: request.to,
    amount: request.amount,
    tip: request.tip ?? CANONICAL_TRANSFER_DEFAULT_TIP,
    feeLimit: request.feeLimit ?? CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT,
  })
}

export async function submitCanonicalCashTransfer(request: CanonicalCashTransferRequest): Promise<CanonicalCashTransferOutcome> {
  const prepared = await prepareCanonicalCashTransfer(request)
  try {
    const response = await submitCanonicalTx(prepared.tx, request.apiBase)
    return normalizeOutcome(response, prepared)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      txid: `error:${reason}`,
      message: `Transaction rejected: ${reason}`,
      tx: prepared.tx,
      senderPubkeyHex: prepared.senderPubkeyHex,
      signature: prepared.signature,
    }
  }
}

export function describeCanonicalCashTransferOutcome(outcome: CanonicalCashTransferOutcome): string {
  return outcome.message
}
