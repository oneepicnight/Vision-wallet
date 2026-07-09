import { env } from '../utils/env'
import { loadConfig } from './config'
import {
  buildCanonicalCashTransferTx,
  getCanonicalBalance,
  getCanonicalNonce,
  getCanonicalTransaction,
  getNodeStatus,
  signCanonicalCashTransfer,
  submitCanonicalTx,
} from './nodeClient'
// Safe fetch handler that checks res.ok before parsing JSON
async function handle(res: Response) {
  if (!res.ok) {
    // Try to read text for better errors (404s return HTML/plain)
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText} – ${text.slice(0, 200)}`);
    // @ts-ignore - Surface status for callers
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  // Non-JSON 204/empty ok:
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  // Fallback try json, else text
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}

export async function api(path: string, init?: RequestInit) {
  const { apiBase } = await loadConfig();
  const p = path.startsWith('/') ? path : `/${path}`;
  return handle(await fetch(`${apiBase}${p}`, init));
}

// Convenience wrappers for fetch-based API
export const get = (p: string) => api(p);
export const post = (p: string, body: any) =>
  api(p, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export async function wsUrl(path: string) {
  const { wsBase } = await loadConfig();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${wsBase}${p}`;
}

// Base URL management (legacy)
export async function getBaseUrl(): Promise<string> {
  // When running in mock/dev-bypass mode, point to the local dev server
  if (env.MOCK_CHAIN || env.WALLET_DEV_BYPASS) {
    return ''
  }

  // Use runtime config
  const { apiBase } = await loadConfig();
  return localStorage.getItem('vision.node.url') || apiBase
}

export function setBaseUrl(url: string): void {
  localStorage.setItem('vision.node.url', url)
}

// API endpoints
export async function pingStatus(): Promise<{ up: boolean; info: any }> {
  if (env.WALLET_DEV_BYPASS) {
    return { up: false, info: { devBypass: true } }
  }

  if (env.MOCK_CHAIN) {
    return { up: true, info: { mock: true } }
  }

  try {
    const info = await getNodeStatus()
    return { up: true, info }
  } catch (error) {
    return {
      up: false,
      info: { error: error instanceof Error ? error.message : 'Network error' }
    }
  }
}

export async function tryKeysThenVault(): Promise<any> {
  if (env.WALLET_DEV_BYPASS) {
    throw new Error('DEV_BYPASS_ENABLED')
  }

  if (env.MOCK_CHAIN) {
    return { mock: true, vault: { receipts: [], mocked: true } }
  }

  const { loadAndDecrypt } = await import('./keystore')
  const keystore = await loadAndDecrypt()
  if (keystore) return keystore
  throw new Error('keys_and_vault_unreachable')
}

export async function getSupply(): Promise<{ total: string | number }> {
  if (env.MOCK_CHAIN) {
    return { total: 1000000 }
  }
  return { total: 0 }
}

export async function getLatestReceipts(): Promise<any[]> {
  if (env.MOCK_CHAIN) {
    try {
      const raw = localStorage.getItem('mock.receipts')
      return raw ? JSON.parse(raw) : []
    } catch (e) {
      return []
    }
  }
  return []
}

export async function getBalance(address: string): Promise<{ LAND: number; GAME: number; CASH: number }> {
  if (env.MOCK_CHAIN) {
    try {
      const key = `mock.balances.${address}`
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
      const seed = { LAND: 1, GAME: 250, CASH: 500 }
      localStorage.setItem(key, JSON.stringify(seed))
      return seed
    } catch (e) {
      console.warn('Mock balance read failed', e)
      return { LAND: 0, GAME: 0, CASH: 0 }
    }
  }

  try {
    const response = await getCanonicalBalance(address)
    return { LAND: 0, GAME: 0, CASH: Number(response.balance || 0) }
  } catch (error) {
    console.warn('Balance fetch failed:', error)
    return { LAND: 0, GAME: 0, CASH: 0 }
  }
}

export async function getNonce(address: string): Promise<number> {
  if (env.MOCK_CHAIN) {
    return Date.now()
  }

  try {
    const response = await getCanonicalNonce(address)
    return Number(response.nonce || 0)
  } catch (error) {
    console.warn('Nonce fetch failed:', error)
    return 0
  }
}

export async function getDepositAddress(asset: string, walletAddress: string): Promise<{ address: string }> {
  if (env.MOCK_CHAIN) {
    return { address: `mock-${asset.toLowerCase()}-${walletAddress.slice(0, 12)}` }
  }

  if (asset === 'LAND' || asset === 'CASH') {
    return { address: walletAddress }
  }

  return { address: `${asset.toLowerCase()}-${walletAddress}` }
}

export async function getWalletBalances(address: string): Promise<Record<string, { available: number; locked: number }>> {
  const balances = await getBalance(address)
  return {
    LAND: { available: balances.LAND, locked: 0 },
    CASH: { available: balances.CASH, locked: 0 },
    GAME: { available: balances.GAME, locked: 0 },
    BTC: { available: 0, locked: 0 },
    BCH: { available: 0, locked: 0 },
    DOGE: { available: 0, locked: 0 }
  }
}

export interface Transaction {
  token: string
  to: string
  amount: number
  from: string
  nonce: number
}

export interface SignedTransaction {
  tx: Transaction
  sig: string
}

interface BackendTx {
  nonce: number
  sender_pubkey: string
  module: string
  method: string
  args: number[]
  tip: number
  fee_limit: number
  sig: string
}

export interface VaultEpochStatus {
  epoch_index: number
  last_payout_height: number
  last_payout_at_ms: number
  vault_balance: string
  fund_balance: string
  treasury_balance: string
  height: number
  due: boolean
}

export interface VaultStatus {
  receipts: any[]
  balances: Record<string, Record<string, number>>
  stats: {
    totalDeposits: number
    totalWithdrawals: number
  }
}

async function serializeTransaction(tx: Transaction, sig: string): Promise<{ tx: BackendTx }> {
  const { loadAndDecrypt, deriveKeys } = await import('./keystore')
  const keystore = await loadAndDecrypt()
  if (!keystore) {
    throw new Error('Could not load keystore to get public key')
  }

  let publicKeyHex = keystore.publicKeyHex
  if (!publicKeyHex) {
    const keys = await deriveKeys(keystore.mnemonic)
    publicKeyHex = keys.publicKeyHex
  }

  const canonicalTx = buildCanonicalCashTransferTx({
    senderPubkeyHex: publicKeyHex,
    nonce: tx.nonce,
    to: tx.to,
    amount: tx.amount,
    tip: 0,
    feeLimit: 100000,
    sig,
  })

  return { tx: canonicalTx }
}

export async function signTransaction(tx: Transaction, privateKey: string): Promise<string> {
  if (env.MOCK_CHAIN) {
    return 'mock_signature_' + Date.now()
  }

  try {
    const signed = await signCanonicalCashTransfer(
      {
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        nonce: tx.nonce,
        tip: 0,
        feeLimit: 100000,
      },
      privateKey,
    )
    return signed.signature
  } catch (error) {
    throw new Error(`Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function submitTx(payload: SignedTransaction): Promise<{ ok: boolean; txid: string }> {
  if (env.MOCK_CHAIN) {
    try {
      const tx = payload.tx
      const txid = `mock-${Date.now()}-${Math.floor(Math.random()*10000)}`

      try {
        const fromKey = `mock.balances.${tx.from}`
        const rawFrom = localStorage.getItem(fromKey)
        const fromBal = rawFrom ? JSON.parse(rawFrom) : { LAND: 1, GAME: 250, CASH: 500 }
        if (fromBal[tx.token as keyof typeof fromBal] !== undefined) {
          fromBal[tx.token as keyof typeof fromBal] = Math.max(0, fromBal[tx.token as keyof typeof fromBal] - tx.amount)
        }
        localStorage.setItem(fromKey, JSON.stringify(fromBal))
      } catch (e) {
        console.warn('Failed to update mock sender balance', e)
      }

      try {
        const toKey = `mock.balances.${tx.to}`
        const rawTo = localStorage.getItem(toKey)
        const toBal = rawTo ? JSON.parse(rawTo) : { LAND: 0, GAME: 0, CASH: 0 }
        if (toBal[tx.token as keyof typeof toBal] !== undefined) {
          toBal[tx.token as keyof typeof toBal] = (toBal[tx.token as keyof typeof toBal] || 0) + tx.amount
        }
        localStorage.setItem(toKey, JSON.stringify(toBal))
      } catch (e) {
        console.warn('Failed to update mock recipient balance', e)
      }

      try {
        const raw = localStorage.getItem('mock.receipts')
        const arr = raw ? JSON.parse(raw) : []
        arr.unshift({ txid, from: tx.from, to: tx.to, token: tx.token, amount: tx.amount, time: Date.now(), status: 'confirmed' })
        localStorage.setItem('mock.receipts', JSON.stringify(arr.slice(0, 100)))
      } catch (e) {
        console.warn('Failed to persist mock receipt', e)
      }

      return { ok: true, txid }
    } catch (e) {
      return { ok: false, txid: `error:${e instanceof Error ? e.message : String(e)}` }
    }
  }

  try {
    const backendPayload = await serializeTransaction(payload.tx, payload.sig)
    const response = await submitCanonicalTx(backendPayload.tx)
    const txId = response?.tx_id || response?.txid || response?.id

    const accepted = String(response?.status || '').toLowerCase() === 'accepted' || response?.error == null
    if (!accepted) {
      const reason = response?.error?.message || response?.error?.code || response?.message || 'Transaction not accepted'
      return { ok: false, txid: `error:${reason}` }
    }

    if (txId) {
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5_000))
        try {
          const lookup = await getCanonicalTransaction(txId)
          if (lookup?.found) {
            return { ok: true, txid: txId }
          }
        } catch (_) {
          // keep polling until the block lands or timeout expires
        }
      }
    }

    return { ok: true, txid: txId || 'pending' }
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error'
    return {
      ok: false,
      txid: `error:${errorMsg}`
    }
  }
}

export async function getVaultEpochStatus(): Promise<VaultEpochStatus> {
  const status = await getNodeStatus().catch(() => null)
  return {
    epoch_index: 0,
    last_payout_height: 0,
    last_payout_at_ms: 0,
    vault_balance: '0',
    fund_balance: '0',
    treasury_balance: '0',
    height: status?.canonical_tip_height ?? 0,
    due: false
  }
}

export async function getVaultStatus(): Promise<VaultStatus> {
  return {
    receipts: [],
    balances: {
      LAND: { miners: 0, dev: 0, founders: 0 },
      BTC: { miners: 0, dev: 0, founders: 0 },
      BCH: { miners: 0, dev: 0, founders: 0 },
      DOGE: { miners: 0, dev: 0, founders: 0 }
    },
    stats: {
      totalDeposits: 0,
      totalWithdrawals: 0
    }
  }
}

// Exchange API
export interface OrderBook {
  bids: [number, number][]  // [price, size]
  asks: [number, number][]
  chain: string
}

export interface Ticker {
  chain: string
  last: number
  change24h: number
  vol24h: number
  high24h: number
  low24h: number
}

export interface Trade {
  id: string
  ts: number
  price: number
  size: number
  side: 'buy' | 'sell'
  chain: string
}

export interface UserOrder {
  id: string
  chain: string
  side: 'buy' | 'sell'
  price: number | null
  size_total: number
  size_filled: number
  status: 'open' | 'filled' | 'cancelled' | 'partial'
  tif: string
  post_only: boolean
}

export interface OrderRequest {
  owner: string
  chain: string
  side: 'buy' | 'sell'
  price: number
  size: number
  post_only?: boolean
  tif?: 'GTC' | 'IOC' | 'FOK' | 'GTT'
}

export interface OrderResponse {
  ok: boolean
  order_id: string
  trades: Array<{
    id: string
    price: number
    size: number
    buyer: string
    seller: string
  }>
  message: string
}

export async function getExchangeBook(chain: string = 'BTC', depth: number = 50): Promise<OrderBook> {
  if (env.MOCK_CHAIN) {
    return {
      bids: [
        [0.00000042, 1250.50],
        [0.00000041, 2500.00],
        [0.00000040, 5000.00],
        [0.00000039, 10000.00],
        [0.00000038, 7500.00]
      ],
      asks: [
        [0.00000043, 2000.00],
        [0.00000044, 3500.00],
        [0.00000045, 5000.00],
        [0.00000046, 8000.00],
        [0.00000047, 12000.00]
      ],
      chain
    }
  }

  try {
    return await get(`/api/market/exchange/book?chain=${chain}&depth=${depth}`)
  } catch (error) {
    throw new Error(`Failed to get order book: ${error instanceof Error ? error.message : 'Network error'}`)
  }
}

export async function getExchangeTicker(chain: string = 'BTC'): Promise<Ticker> {
  if (env.MOCK_CHAIN) {
    return {
      chain,
      last: 0.00000042,
      change24h: 5.2,
      vol24h: 125000,
      high24h: 0.00000045,
      low24h: 0.00000038
    }
  }

  try {
    return await get(`/api/market/exchange/ticker?chain=${chain}`)
  } catch (error) {
    throw new Error(`Failed to get ticker: ${error instanceof Error ? error.message : 'Network error'}`)
  }
}

export async function getExchangeTrades(chain: string = 'BTC', limit: number = 50): Promise<Trade[]> {
  if (env.MOCK_CHAIN) {
    return [
      { id: '1', ts: Date.now(), price: 0.00000042, size: 250.50, side: 'buy', chain },
      { id: '2', ts: Date.now() - 17000, price: 0.00000042, size: 500.00, side: 'sell', chain },
      { id: '3', ts: Date.now() - 33000, price: 0.00000043, size: 1000.00, side: 'buy', chain },
      { id: '4', ts: Date.now() - 50000, price: 0.00000041, size: 750.00, side: 'sell', chain },
      { id: '5', ts: Date.now() - 67000, price: 0.00000042, size: 2000.00, side: 'buy', chain }
    ]
  }

  try {
    return await get(`/api/market/exchange/trades?chain=${chain}&limit=${limit}`)
  } catch (error) {
    throw new Error(`Failed to get trades: ${error instanceof Error ? error.message : 'Network error'}`)
  }
}

export async function getMyOrders(owner: string, chain: string = 'BTC'): Promise<UserOrder[]> {
  if (env.MOCK_CHAIN) {
    return [
      {
        id: '1',
        chain,
        side: 'buy',
        price: 0.00000040,
        size_total: 5000,
        size_filled: 0,
        status: 'open',
        tif: 'GTC',
        post_only: false
      }
    ]
  }

  try {
    return await get(`/api/market/exchange/my/orders?owner=${encodeURIComponent(owner)}&chain=${chain}`)
  } catch (error) {
    throw new Error(`Failed to get orders: ${error instanceof Error ? error.message : 'Network error'}`)
  }
}

export async function createOrder(request: OrderRequest): Promise<OrderResponse> {
  if (env.MOCK_CHAIN) {
    return {
      ok: true,
      order_id: `mock-order-${Date.now()}`,
      trades: [],
      message: 'Mock order placed on book'
    }
  }

  try {
    return await post('/api/market/exchange/order', request)
  } catch (error) {
    throw new Error(`Failed to create order: ${error instanceof Error ? error.message : 'Network error'}`)
  }
}







