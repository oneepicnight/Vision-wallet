import { describe, expect, it } from 'vitest'
import { WALLET_ALPHA_BLOCKED_ROUTES, WALLET_ALPHA_UI_ENABLED, WALLET_ALPHA_VISIBLE_TABS } from './alpha'

describe('wallet alpha route set', () => {
  it('defaults to alpha mode', () => {
    expect(WALLET_ALPHA_UI_ENABLED).toBe(true)
  })

  it('keeps the visible route set minimal', () => {
    expect(WALLET_ALPHA_VISIBLE_TABS.map((tab) => tab.path)).toEqual(['/wallet', '/import'])
  })

  it('blocks non-alpha routes', () => {
    expect(WALLET_ALPHA_BLOCKED_ROUTES).toEqual(expect.arrayContaining([
      '/command-center',
      '/exchange',
      '/market',
      '/mining',
      '/settings',
    ]))
  })
})
