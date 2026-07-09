import { NavLink, useLocation } from 'react-router-dom'
import { useWalletStore } from '../state/wallet'
import { env } from '../utils/env'
import { WALLET_ALPHA_LABEL, WALLET_ALPHA_UI_ENABLED, WALLET_ALPHA_VISIBLE_TABS } from '../lib/alpha'
import '../styles/nav-tabs.css'

interface NavTab {
  label: string
  path: string
  devOnly?: boolean
}

const devTabs: NavTab[] = [
  { label: 'Debug Crypto', path: '/debug/crypto', devOnly: true },
]

export default function NavTabs() {
  const { profile } = useWalletStore()
  const location = useLocation()

  const hideOnRoutes = ['/', '/import', '/handle', '/secure']
  if (hideOnRoutes.includes(location.pathname) || !profile) {
    return null
  }

  const alphaTabs: NavTab[] = WALLET_ALPHA_VISIBLE_TABS as NavTab[]
  const allTabs: NavTab[] = WALLET_ALPHA_UI_ENABLED ? alphaTabs : (env.FEATURE_DEV_PANEL ? [...alphaTabs, ...devTabs] : alphaTabs) as NavTab[]

  return (
    <nav className="nav-tabs">
      <div className="nav-tabs-container" style={{ alignItems: 'center' }}>
        <span
          className="nav-tab nav-tab-active"
          aria-label={WALLET_ALPHA_LABEL}
          title={WALLET_ALPHA_LABEL}
          style={{ pointerEvents: 'none', cursor: 'default', opacity: 0.9 }}
        >
          {WALLET_ALPHA_LABEL}
        </span>
        {allTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `nav-tab ${isActive ? 'nav-tab-active' : ''} ${tab.devOnly ? 'nav-tab-dev' : ''}`
            }
            aria-current={location.pathname === tab.path ? 'page' : undefined}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

