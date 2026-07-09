export const WALLET_ALPHA_UI_ENABLED = ((import.meta as any).env.VITE_WALLET_ALPHA_UI ?? '1') === '1'

export const WALLET_ALPHA_LABEL = 'Wallet Alpha'

export const WALLET_ALPHA_VISIBLE_TABS = [
  { label: 'Wallet', path: '/wallet' },
  { label: 'Import', path: '/import' },
]

export const WALLET_ALPHA_BLOCKED_ROUTES = [
  '/command-center',
  '/exchange',
  '/market',
  '/mining',
  '/panel',
  '/miner',
  '/settings',
  '/debug/crypto',
  '/orders',
]
