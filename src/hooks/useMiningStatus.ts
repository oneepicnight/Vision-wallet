import { useState, useEffect } from 'react'
import { getNodeStatus } from '../lib/nodeClient'

export interface MiningStatus {
  mode: 'solo' | 'pool' | 'off'
  hashrate: number
  active: boolean
}

export function useMiningStatus(pollInterval = 3000) {
  const [miningStatus, setMiningStatus] = useState<MiningStatus>({
    mode: 'off',
    hashrate: 0,
    active: false
  })

  useEffect(() => {
    const fetchMiningStatus = async () => {
      try {
        const data = await getNodeStatus().catch(() => null)
        const mining = data?.mining_status ?? data?.mining ?? data?.miner ?? null
        setMiningStatus({
          mode: mining?.pool_mining ? 'pool' : (mining?.active ? 'solo' : 'off'),
          hashrate: Number(mining?.hashrate ?? mining?.hash_rate ?? 0),
          active: Boolean(mining?.active)
        })
      } catch (err) {
        console.debug('Failed to fetch mining status:', err)
      }
    }

    fetchMiningStatus()
    const interval = setInterval(fetchMiningStatus, pollInterval)
    return () => clearInterval(interval)
  }, [pollInterval])

  return miningStatus
}
