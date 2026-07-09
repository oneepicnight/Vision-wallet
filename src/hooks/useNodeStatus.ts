import { useEffect, useState } from 'react'
import { getNodeStatus } from '../lib/nodeClient'

export interface NodeStatus {
  online: boolean
  network: string
  height: number
  guardianMode: boolean
  peerCount: number
  p2pHealth: 'isolated' | 'weak' | 'ok' | 'stable' | 'immortal'
}

export function useNodeStatus(pollInterval = 5000) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>({
    online: false,
    network: 'Mainnet',
    height: 0,
    guardianMode: false,
    peerCount: 0,
    p2pHealth: 'isolated'
  })

  useEffect(() => {
    const fetchNodeStatus = async () => {
      try {
        const data = await getNodeStatus()
        const height = Number(data?.canonical_tip_height ?? data?.height ?? 0)
        const peers = Array.isArray(data?.peers) ? data.peers.length : Number(data?.peer_count ?? 0)

        setNodeStatus({
          online: true,
          network: data?.guardian_mode ? 'Guardian Mode' : (data?.network ?? 'Mainnet'),
          height,
          guardianMode: Boolean(data?.guardian_mode),
          peerCount: peers,
          p2pHealth: data?.p2p_health || 'isolated'
        })
      } catch (err) {
        console.debug('Failed to fetch node status:', err)
        setNodeStatus(prev => ({ ...prev, online: false }))
      }
    }

    fetchNodeStatus()
    const interval = setInterval(fetchNodeStatus, pollInterval)
    return () => clearInterval(interval)
  }, [pollInterval])

  return nodeStatus
}
