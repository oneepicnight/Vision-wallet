import { getNodeStatus } from '../../lib/nodeClient'

export async function getStatus() {
  return getNodeStatus()
}

export async function getSupply(): Promise<{ total: number }> {
  const status = await getNodeStatus().catch(() => null)
  return { total: Number(status?.total_supply ?? status?.supply ?? 0) }
}

export async function getVault(): Promise<any> {
  const status = await getNodeStatus().catch(() => null)
  return status ?? { receipts: [], balances: {}, stats: {} }
}

export async function getLatestReceipts(): Promise<any[]> {
  const status = await getNodeStatus().catch(() => null)
  return Array.isArray(status?.recent_transactions) ? status.recent_transactions : []
}
