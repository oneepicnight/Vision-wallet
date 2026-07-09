import { useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useWalletStore } from './state/wallet'
import { pingStatus } from './lib/api'
import { requireWallet } from './lib/guards'
import { loadConfig } from './lib/config'
import { WALLET_ALPHA_LABEL, WALLET_ALPHA_UI_ENABLED } from './lib/alpha'
import Splash from './routes/Splash'
import HandleClaim from './routes/HandleClaim'
import ImportWallet from './routes/ImportWallet'
import SecureKey from './routes/SecureKey'
import Settings from './routes/Settings'
import DebugCrypto from './routes/DebugCrypto'
import WalletHome from './routes/HomeNew'
import Exchange from './pages/Exchange'
import CommandCenter from './pages/CommandCenter'
import MinerRedirect from './routes/MinerRedirect'
import { Market, Orders } from './modules/market'
import { env } from './utils/env'
import NavTabs from './components/NavTabs'

// Protected components
const ProtectedWalletHome = requireWallet(WalletHome)
const ProtectedExchange = requireWallet(Exchange)
const ProtectedSettings = requireWallet(Settings)
const ProtectedCommandCenter = requireWallet(CommandCenter)
const ProtectedMinerRedirect = requireWallet(MinerRedirect)

function App() {
  const { setNode, node } = useWalletStore()
  const isAlpha = WALLET_ALPHA_UI_ENABLED

  useEffect(() => {
    loadConfig().catch(err => console.warn('Config load failed:', err));
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await pingStatus()
        const now = Date.now()

        if (result.up && result.info && typeof result.info === 'object') {
          setNode({ status: 'up', lastSeen: now })
        } else if (result.up) {
          setNode({ status: 'degraded', lastSeen: now })
        } else {
          setNode({ status: 'down' })
        }
      } catch (error) {
        setNode({ status: 'down' })
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [setNode])

  return (
    <Router basename={'/'}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 12px 0',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '999px',
            border: '1px solid rgba(59, 130, 246, 0.45)',
            background: 'rgba(30, 41, 59, 0.85)',
            color: '#dbeafe',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: 0,
            padding: '4px 10px',
          }}
        >
          {WALLET_ALPHA_LABEL}
        </span>
      </div>

      {node.status === 'down' && (
        <div className="node-banner" style={{ background: '#fef3c7', color: '#92400e', padding: '8px 12px', textAlign: 'center' }}>
          Node offline ({env.NODE_URL}). {env.WALLET_DEV_BYPASS ? 'Running in DEV fallback — balances may be stale.' : 'Running in offline mode — balances may be stale.'}
        </div>
      )}
      <NavTabs />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/command-center" element={isAlpha ? <Navigate to="/wallet" replace /> : <ProtectedCommandCenter />} />
          <Route path="/wallet" element={<ProtectedWalletHome />} />
          <Route path="/home" element={<Navigate to="/wallet" replace />} />
          <Route path="/panel" element={isAlpha ? <Navigate to="/wallet" replace /> : <Navigate to="/mining" replace />} />
          <Route path="/miner" element={isAlpha ? <Navigate to="/wallet" replace /> : <Navigate to="/mining" replace />} />
          <Route path="/mining" element={isAlpha ? <Navigate to="/wallet" replace /> : <ProtectedMinerRedirect />} />
          <Route path="/exchange" element={isAlpha ? <Navigate to="/wallet" replace /> : <ProtectedExchange />} />
          <Route path="/market" element={isAlpha ? <Navigate to="/wallet" replace /> : <Market />} />
          <Route path="/handle" element={<HandleClaim />} />
          <Route path="/import" element={<ImportWallet />} />
          <Route path="/secure" element={<SecureKey />} />
          {isAlpha ? <Route path="/debug/crypto" element={<Navigate to="/wallet" replace />} /> : env.FEATURE_DEV_PANEL && <Route path="/debug/crypto" element={<DebugCrypto />} />}
          {isAlpha ? <Route path="/orders" element={<Navigate to="/wallet" replace />} /> : env.FEATURE_DEV_PANEL && <Route path="/orders" element={<Orders />} />}
          <Route path="/settings" element={isAlpha ? <Navigate to="/wallet" replace /> : <ProtectedSettings />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
