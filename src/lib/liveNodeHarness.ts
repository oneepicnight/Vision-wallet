import { buildCanonicalCashTransferForWallet, describeCanonicalCashTransferOutcome, submitCanonicalCashTransfer } from './canonicalTransfer'
import { getCanonicalBalance, getCanonicalNonce, getNodeStatus } from './nodeClient'

export interface LiveNodeHarnessConfig {
  apiBase: string
  senderAddress: string
  senderPublicKeyHex: string
  senderPrivateKeyHex: string
  recipientAddress: string
  amount: number
  tip?: number
  feeLimit?: number
}

export interface LiveNodeHarnessResult {
  status: any
  balance: any
  nonce: any
  preparedTx: ReturnType<typeof buildCanonicalCashTransferForWallet>
  outcome: Awaited<ReturnType<typeof submitCanonicalCashTransfer>>
  outcomeText: string
}

export async function runLiveNodeHarness(config: LiveNodeHarnessConfig): Promise<LiveNodeHarnessResult> {
  const base = config.apiBase.replace(/\/$/, '')
  const status = await getNodeStatus(base)
  const balance = await getCanonicalBalance(config.senderAddress, base)
  const nonce = await getCanonicalNonce(config.senderAddress, base)
  const preparedTx = buildCanonicalCashTransferForWallet({
    senderPubkeyHex: config.senderPublicKeyHex,
    from: config.senderAddress,
    to: config.recipientAddress,
    amount: config.amount,
    nonce: Number(nonce?.nonce ?? 0),
    tip: config.tip,
    feeLimit: config.feeLimit,
  })

  const outcome = await submitCanonicalCashTransfer({
    from: config.senderAddress,
    to: config.recipientAddress,
    amount: config.amount,
    nonce: Number(nonce?.nonce ?? 0),
    privateKeyHex: config.senderPrivateKeyHex,
    tip: config.tip,
    feeLimit: config.feeLimit,
    apiBase: base,
  })

  return {
    status,
    balance,
    nonce,
    preparedTx,
    outcome,
    outcomeText: describeCanonicalCashTransferOutcome(outcome),
  }
}
