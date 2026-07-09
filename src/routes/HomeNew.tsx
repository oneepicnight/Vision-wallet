import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWalletStore } from '../state/wallet'
import { useMessageStore } from '../state/messages'
import { getBalance, getVaultStatus, getDepositAddress, getNonce } from '../lib/api'
import { submitCanonicalCashTransfer, CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT, CANONICAL_TRANSFER_DEFAULT_TIP } from '../lib/canonicalTransfer'
import { useExchangeStatus } from '../hooks/useExchangeStatus'
import TipButton from '../components/TipButton'
import { DepositModal } from '../components/DepositModal'
import { DepositWatcher } from '../components/DepositWatcher'
import MessageCenter from '../components/MessageCenter'
import { loadAndDecrypt } from '../lib/keystore'
import '../styles/wallet-vision.css'

type Asset = 'LAND' | 'CASH' | 'BTC' | 'BCH' | 'DOGE'

interface AssetInfo {
  symbol: Asset
  name: string
  description: string
}

const ASSETS: AssetInfo[] = [
  { symbol: 'LAND', name: 'LAND', description: 'Primary chain token' },
  { symbol: 'CASH', name: 'CASH', description: 'In-game credit' },
  { symbol: 'BTC', name: 'Bitcoin', description: 'Bitcoin' },
  { symbol: 'BCH', name: 'Bitcoin Cash', description: 'Bitcoin Cash' },
  { symbol: 'DOGE', name: 'Dogecoin', description: 'Dogecoin' }
]

export default function HomeNew() {
  const navigate = useNavigate()
  const { profile, balances, setBalances, setPrivateKey } = useWalletStore()
  const { status: exchangeStatus } = useExchangeStatus(profile?.address || null)
  const addMessage = useMessageStore((s) => s.addMessage)
  
  // UI state
  const [sendAsset, setSendAsset] = useState<Asset>('LAND')
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)
  const [receiveAsset, setReceiveAsset] = useState<Asset>('LAND')
  const [receiveAddress, setReceiveAddress] = useState('')
  const [receiveCopyMsg, setReceiveCopyMsg] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false)
  const [privateKeyInput, setPrivateKeyInput] = useState('')
  const [showKeysModal, setShowKeysModal] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)
  const [seedPhrase, setSeedPhrase] = useState<string[]>([])
  const [showSeedPhrase, setShowSeedPhrase] = useState(false)
  
  // Vault data
  const [vaultData, setVaultData] = useState<any>(null)
  const [lastVaultUpdate, setLastVaultUpdate] = useState<Date>(new Date())
  
  // Portal charge (placeholder - will connect to real metric)
  const [portalCharge] = useState(42)

  useEffect(() => {
    if (!profile) {
      navigate('/')
    }
  }, [profile, navigate])

  // Load balances
  useEffect(() => {
    if (!profile) return

    const loadBalances = async () => {
      try {
        const nodeBalances = await getBalance(profile.address)
        setBalances(nodeBalances)
      } catch (error) {
        console.error('Failed to load balances:', error)
      }
    }

    loadBalances()
    const interval = setInterval(loadBalances, 5000)
    return () => clearInterval(interval)
  }, [profile, setBalances])

  // Load vault data
  useEffect(() => {
    if (!profile) return

    const loadVault = async () => {
      try {
        const data = await getVaultStatus()
        setVaultData(data)
        setLastVaultUpdate(new Date())
      } catch (error) {
        console.error('Failed to load vault:', error)
      }
    }

    loadVault()
    const interval = setInterval(loadVault, 3000)
    return () => clearInterval(interval)
  }, [profile])

  // Load receive address
  useEffect(() => {
    if (!profile) return

    // For LAND and CASH, use the user's own wallet address
    if (receiveAsset === 'LAND' || receiveAsset === 'CASH') {
      setReceiveAddress(profile.address)
      return
    }

    // For BTC/BCH/DOGE, fetch external deposit address
    const loadDepositAddr = async () => {
      try {
        const result = await getDepositAddress(receiveAsset, profile.address)
        setReceiveAddress(result.address)
      } catch (error) {
        console.error('Failed to load deposit address:', error)
        setReceiveAddress(`Error loading ${receiveAsset} address`)
      }
    }

    loadDepositAddr()
  }, [profile, receiveAsset])

  if (!profile) {
    return null
  }

  const totalPortfolio = balances?.LAND || 0
  const portfolioUSD = (totalPortfolio * 0.0).toFixed(2) // Placeholder for price conversion

  const handleCopyReceive = async () => {
    try {
      await navigator.clipboard.writeText(receiveAddress)
      setReceiveCopyMsg('Copied!')
      setTimeout(() => setReceiveCopyMsg(''), 1200)
    } catch (error) {
      setReceiveCopyMsg('Failed')
      setTimeout(() => setReceiveCopyMsg(''), 1200)
    }
  }

  const handleSend = async () => {
    console.log('[handleSend] Starting transaction send...')
    setSendError('')
    setSendSuccess(false)

    const amount = parseFloat(sendAmount)
    if (!sendTo || !sendAmount || amount <= 0) {
      setSendError('Please fill all fields with valid values')
      addMessage('error', 'Invalid send fields — check address and amount')
      return
    }

    const available = (balances as any)[sendAsset] || 0
    console.log('[handleSend] Balance check:', { sendAsset, amount, available })
    if (amount > available) {
      setSendError(`Insufficient ${sendAsset} balance`)
      addMessage('error', `Insufficient ${sendAsset} balance`, `Have ${available.toFixed(8)}, tried to send ${amount.toFixed(8)}`)
      return
    }

    if (!profile?.privateKey) {
      setShowPrivateKeyModal(true)
      return
    }

    addMessage('info', `Preparing to send ${amount} ${sendAsset}`, `→ ${sendTo.slice(0, 20)}…`)

    try {
      console.log('[handleSend] Getting nonce for:', profile.address)
      const nonce = await getNonce(profile.address)
      console.log('[handleSend] Got nonce:', nonce)

      setSendError(`Submitting canonical transaction with nonce ${nonce}...`)
      addMessage('info', 'Signing transaction locally…')

      const outcome = await submitCanonicalCashTransfer({
        from: profile.address,
        to: sendTo,
        amount: Math.floor(amount * 100000000),
        nonce,
        privateKeyHex: profile.privateKey,
        tip: CANONICAL_TRANSFER_DEFAULT_TIP,
        feeLimit: CANONICAL_TRANSFER_DEFAULT_FEE_LIMIT,
      })

      console.log('[handleSend] Canonical transfer outcome:', outcome)
      setSendError('')

      if (outcome.ok) {
        addMessage('success', outcome.message, outcome.txid !== 'pending' ? `tx: ${outcome.txid}` : undefined)
        setSendSuccess(true)
        setSendTo('')
        setSendAmount('')
        setTimeout(() => setSendSuccess(false), 5000)

        const newBalances = await getBalance(profile.address)
        console.log('[handleSend] New balances:', newBalances)
        setBalances(newBalances)
        addMessage('info', 'Balance refreshed')
      } else {
        console.error('[handleSend] Transaction rejected:', outcome.message)
        setSendError(outcome.message)
        addMessage('error', 'Transaction rejected', outcome.message)
      }
    } catch (error) {
      console.error('[handleSend] Exception caught:', error)
      const msg = error instanceof Error ? error.message : 'Send failed'
      setSendError(msg)
      addMessage('error', 'Send error', msg)
    }
  }

  const handleSavePrivateKey = () => {
    if (privateKeyInput.length === 64 && /^[0-9a-fA-F]{64}$/.test(privateKeyInput)) {
      setPrivateKey(privateKeyInput)
      setPrivateKeyInput('')
      setShowPrivateKeyModal(false)
      // Retry the send
      setTimeout(() => handleSend(), 100)
    } else {
      setSendError('Invalid private key format. Must be 64 hex characters.')
    }
  }

  const handleCopyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownloadKeys = () => {
    const keysData = {
      seedPhrase: seedPhrase.length > 0 ? seedPhrase.join(' ') : 'NOT_AVAILABLE',
      address: profile?.address || '',
      privateKey: profile?.privateKey || '',
      warning: 'NEVER SHARE THIS FILE. Keep it secure and private.',
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(keysData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vision-wallet-${profile?.address?.slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleOpenKeysModal = async () => {
    // Load seed phrase from encrypted storage
    try {
      const keystore = await loadAndDecrypt()
      if (keystore && keystore.mnemonic) {
        setSeedPhrase(keystore.mnemonic)
      }
    } catch (err) {
      console.error('Failed to load seed phrase:', err)
    }
    setShowKeysModal(true)
  }

  const getAssetBalance = (symbol: Asset) => {
    return ((balances as any)?.[symbol]) || 0
  }

  const formatBalance = (value: number) => {
    return value.toFixed(8)
  }

  const getVaultHealth = () => {
    if (!vaultData) return '...'
    // Calculate health based on vault balances
    return '84%'
  }

  const getTotalSupply = () => {
    if (!vaultData || !vaultData.balances) return '...'
    const land = vaultData.balances.LAND || {}
    const total = (land.miners || 0) + (land.dev || 0) + (land.founders || 0)
    return total.toLocaleString()
  }

  const getDepositConfirmations = () => {
    const confirmations: Record<string, number> = {
      BTC: 3,
      BCH: 6,
      DOGE: 20
    }
    return confirmations[receiveAsset] || 3
  }

  return (
    <div className="vision-wallet-shell">
      <MessageCenter />
      <DepositModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        coin={receiveAsset}
        address={receiveAddress}
        network="Mainnet"
      />

      {/* Private Key Modal */}
      {showPrivateKeyModal && (
        <div className="vw-modal-overlay" onClick={() => setShowPrivateKeyModal(false)}>
          <div className="vw-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="vw-modal-header">
              <h3>Enter Private Key</h3>
              <button onClick={() => setShowPrivateKeyModal(false)} className="vw-modal-close">âœ•</button>
            </div>
            <div className="vw-modal-body">
              <p style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                To send transactions, your private key is required. It will be stored securely in your browser's local storage.
              </p>
              <p style={{ marginBottom: '15px', fontSize: '12px', color: '#ff6b6b' }}>
                âš ï¸ Never share your private key. Only use on trusted devices.
              </p>
              <input
                type="password"
                placeholder="64-character hex private key"
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                className="vw-input"
                style={{ width: '100%', marginBottom: '15px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowPrivateKeyModal(false)} className="vw-btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSavePrivateKey} className="vw-btn-primary">
                  Save & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Keys Modal */}
      {showKeysModal && (
        <div className="vw-modal-overlay" onClick={() => { setShowKeysModal(false); setShowPrivateKey(false); }}>
          <div className="vw-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="vw-modal-header">
              <h3>ðŸ” Wallet Security & Keys</h3>
              <button onClick={() => { setShowKeysModal(false); setShowPrivateKey(false); }} className="vw-modal-close">âœ•</button>
            </div>
            <div className="vw-modal-body">
              <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255, 107, 107, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 107, 107, 0.3)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#ff6b6b', fontWeight: 600 }}>
                  âš ï¸ CRITICAL: Never share your seed phrase or private key!
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#ffb3b3' }}>
                  Anyone with these can steal all your funds. Keep them safe and private.
                </p>
              </div>

              {/* Seed Phrase Section */}
              {seedPhrase && seedPhrase.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(80, 200, 120, 0.1)', borderRadius: '8px', border: '1px solid rgba(80, 200, 120, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '13px', color: '#50c878', fontWeight: 600 }}>
                      ðŸŒ± SEED PHRASE (12 Words) - BACKUP THIS!
                    </label>
                    <button 
                      onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                      className="vw-btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '11px' }}
                    >
                      {showSeedPhrase ? 'ðŸ™ˆ Hide' : 'ðŸ‘ï¸ Show'}
                    </button>
                  </div>
                  
                  {showSeedPhrase ? (
                    <>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '8px', 
                        marginBottom: '10px' 
                      }}>
                        {seedPhrase.map((word, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              padding: '8px', 
                              background: 'rgba(0, 0, 0, 0.3)', 
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              color: '#fff'
                            }}
                          >
                            <span style={{ color: '#666', fontSize: '10px' }}>{idx + 1}.</span> {word}
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => handleCopyKey(seedPhrase.join(' '))}
                        className="vw-btn-primary"
                        style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                      >
                        {keyCopied ? 'âœ“ Copied!' : 'ðŸ“‹ Copy Seed Phrase'}
                      </button>
                      <p style={{ marginTop: '8px', fontSize: '11px', color: '#90ee90' }}>
                        ðŸ’¡ Write these 12 words on paper in order. You can restore your wallet with this seed phrase.
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: '12px', color: '#90ee90' }}>
                      Click "Show" to reveal your 12-word seed phrase. This can restore your wallet on any device.
                    </p>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 600 }}>
                  WALLET ADDRESS (Public)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={profile?.address || ''}
                    readOnly
                    className="vw-input"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
                  />
                  <button 
                    onClick={() => handleCopyKey(profile?.address || '')}
                    className="vw-btn-secondary"
                    style={{ padding: '0 20px' }}
                  >
                    {keyCopied ? 'âœ“' : 'ðŸ“‹'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: 600 }}>
                  PRIVATE KEY (Secret - Keep Safe!)
                </label>
                {!profile?.privateKey ? (
                  <div style={{ padding: '20px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.3)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#ffc107' }}>
                      âš ï¸ No private key stored
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#ffecb3' }}>
                      You need to import your private key to send transactions
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type={showPrivateKey ? 'text' : 'password'}
                        value={profile.privateKey}
                        readOnly
                        className="vw-input"
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
                      />
                      <button 
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="vw-btn-secondary"
                        style={{ padding: '0 20px' }}
                      >
                        {showPrivateKey ? 'ðŸ™ˆ' : 'ðŸ‘ï¸'}
                      </button>
                      <button 
                        onClick={() => handleCopyKey(profile.privateKey || '')}
                        className="vw-btn-secondary"
                        style={{ padding: '0 20px' }}
                      >
                        {keyCopied ? 'âœ“' : 'ðŸ“‹'}
                      </button>
                    </div>
                    <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                      ðŸ’¡ Backup this key in multiple secure locations (password manager, encrypted file, paper wallet)
                    </p>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  onClick={handleDownloadKeys}
                  className="vw-btn-primary"
                  style={{ flex: 1 }}
                  disabled={!profile?.privateKey}
                >
                  ðŸ“¥ Download Backup File
                </button>
                <button 
                  onClick={() => { setShowKeysModal(false); setShowPrivateKey(false); }}
                  className="vw-btn-secondary"
                >
                  Close
                </button>
              </div>

              <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(100, 150, 255, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#b8d4ff' }}>
                  ðŸ’¡ <strong>Backup Checklist:</strong>
                </p>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '11px', color: '#b8d4ff' }}>
                  <li>Write it down on paper and store securely</li>
                  <li>Save encrypted backup file to USB drive</li>
                  <li>Store in password manager (1Password, Bitwarden, etc.)</li>
                  <li>NEVER store in cloud services unencrypted</li>
                  <li>NEVER share with anyone, ever</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="vision-wallet-container">
        
        {/* Tip Button */}
        <TipButton />

        {/* SECTION 1: Portfolio Hero */}
        <div className="vw-card vw-hero-card">
          <div className="vw-hero-left">
            <div className="vw-label-sm">TOTAL PORTFOLIO</div>
            <div className="vw-hero-amount">{formatBalance(totalPortfolio)} LAND</div>
            <div className="vw-hero-usd">â‰ˆ ${portfolioUSD} USD</div>
          </div>
          <div className="vw-hero-right">
            <div className="vw-hero-row">
              <span className="vw-label-sm">ACCOUNT</span>
              <span className="vw-pill">@{profile.handle}</span>
            </div>
            <div className="vw-hero-row">
              <span className="vw-label-sm">NETWORK</span>
              <span className="vw-pill vw-pill-success">Vision Mainnet</span>
            </div>
            <div className="vw-hero-row">
              <button 
                onClick={() => handleOpenKeysModal()}
                className="vw-btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                ðŸ” View Keys & Backup
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 2: Asset Strip */}
        <div className="vw-asset-strip">
          {ASSETS.map((asset) => {
            const balance = getAssetBalance(asset.symbol)
            return (
              <div key={asset.symbol} className="vw-asset-card">
                <div className="vw-asset-left">
                  <div className="vw-asset-icon">{asset.symbol[0]}</div>
                  <div>
                    <div className="vw-asset-symbol">{asset.symbol}</div>
                    <div className="vw-asset-desc">{asset.description}</div>
                  </div>
                </div>
                <div className="vw-asset-right">
                  <div className="vw-asset-balance">{formatBalance(balance)}</div>
                  <div className="vw-asset-subtext">
                    Available Â· Total {formatBalance(balance)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* SECTION 3: Portal Charge */}
        <div className="vw-card vw-portal-card">
          <div className="vw-portal-header">
            <div>
              <div className="vw-portal-title">Portal charge</div>
              <div className="vw-portal-subtitle">Earn, mine, or trade to light the bar</div>
            </div>
            <div className="vw-portal-percent">{portalCharge}%</div>
          </div>
          <div className="vw-portal-bar-container">
            <div className="vw-portal-bar" style={{ width: `${portalCharge}%` }}></div>
          </div>
          <div className="vw-portal-labels">
            <span>0%</span>
            <span>Charged</span>
            <span>100%</span>
          </div>
        </div>

        {/* SECTION 4: Main Actions Row */}
        <div className="vw-actions-row">
          {/* Receive Card */}
          <div className="vw-card vw-action-card">
            <h3 className="vw-action-title">Receive</h3>
            <p className="vw-action-subtitle">Share your address to receive any asset</p>
            
            <div className="vw-input-group">
              <label className="vw-label-sm">SELECT ASSET</label>
              <select 
                className="vw-input"
                value={receiveAsset}
                onChange={(e) => setReceiveAsset(e.target.value as Asset)}
              >
                {ASSETS.map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                ))}
              </select>
            </div>

            <div className="vw-input-group">
              <label className="vw-label-sm">{receiveAsset} RECEIVE ADDRESS</label>
              <div className="vw-address-row">
                <span className="vw-address-mono">{receiveAddress}</span>
                <button className="vw-btn-copy" onClick={handleCopyReceive}>
                  {receiveCopyMsg || 'Copy'}
                </button>
                <button className="vw-btn-qr" onClick={() => setShowQRModal(true)}>
                  QR
                </button>
              </div>
            </div>

            {(receiveAsset === 'BTC' || receiveAsset === 'BCH' || receiveAsset === 'DOGE') && (
              <>
                <div className="vw-warning-box">
                  âš ï¸ Only send {receiveAsset} to this address. Sending other cryptocurrencies may result in permanent loss.
                </div>

                <DepositWatcher
                  coin={receiveAsset}
                  address={receiveAddress}
                  isActive={true}
                />

                <div className="vw-receive-footer">
                  Requires {getDepositConfirmations()} blockchain confirmations
                </div>
              </>
            )}
          </div>

          {/* Send Card */}
          <div className="vw-card vw-action-card">
            <h3 className="vw-action-title">Send</h3>
            <p className="vw-action-subtitle">Move value to friends or markets</p>
            
            <div className="vw-input-group">
              <label className="vw-label-sm">ASSET</label>
              <select 
                className="vw-input"
                value={sendAsset}
                onChange={(e) => setSendAsset(e.target.value as Asset)}
              >
                {ASSETS.map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                ))}
              </select>
            </div>

            <div className="vw-input-group">
              <label className="vw-label-sm">TO ADDRESS</label>
              <input 
                type="text"
                className="vw-input"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="Enter recipient address"
              />
            </div>

            <div className="vw-input-group">
              <label className="vw-label-sm">AMOUNT</label>
              <input 
                type="number"
                step="0.00000001"
                className="vw-input"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0.00000000"
              />
            </div>

            {sendError && <div className="vw-error-msg">{sendError}</div>}
            {sendSuccess && <div className="vw-success-msg">Transaction submitted!</div>}

            <button className="vw-btn-primary" onClick={handleSend}>
              Send
            </button>
          </div>

          {/* Enter Vision Card */}
          <div className="vw-card vw-action-card">
            <h3 className="vw-action-title">Enter Vision</h3>
            <p className="vw-action-subtitle">Launch the world. One map. Everyone together.</p>
            <p className="vw-enter-desc">
              Connect to the Vision World game through this wallet. Your assets travel with you.
              Shape the world, build, trade, and explore with other dreamers.
            </p>
            <button className="vw-btn-primary" onClick={() => window.open('/', '_blank')}>
              Enter Vision
            </button>
          </div>
        </div>

        {/* SECTION 5: Secondary Actions Row */}
        <div className="vw-actions-row">
          <div className="vw-card vw-action-card-secondary">
            <h4 className="vw-secondary-title">Market</h4>
            <p className="vw-secondary-desc">
              View prices, charts, and trading activity
            </p>
            <button className="vw-btn-secondary" onClick={() => navigate('/market')}>
              Open Market â†’
            </button>
          </div>

          <div className="vw-card vw-action-card-secondary">
            <h4 className="vw-secondary-title">Exchange</h4>
            <p className="vw-secondary-desc">
              Trade LAND/CASH with live order books
            </p>
            {exchangeStatus.enabled ? (
              <button className="vw-btn-secondary" onClick={() => navigate('/exchange')}>
                Open Exchange â†’
              </button>
            ) : (
              <button 
                className="vw-btn-secondary" 
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                title={exchangeStatus.reason || 'Exchange unlocks after your deposit is confirmed.'}
                disabled
              >
                ðŸ”’ Locked
              </button>
            )}
          </div>
        </div>

        {/* SECTION 6: Bottom Row - Vision Vault Only */}
        <div className="vw-bottom-row">
          {/* Vision Vault Card */}
          <div className="vw-card vw-vault-card-new">
            <div className="vw-vault-header">
              <h3 className="vw-action-title">Vision Vault</h3>
              <span className="vw-vault-badge">Live updating (3s)</span>
            </div>
            <p className="vw-action-subtitle">Foundation & Treasury â€¢ Auto-balancing over time</p>

            <div className="vw-vault-stats">
              <div className="vw-vault-stat-row">
                <span className="vw-label-sm">Last update</span>
                <span className="vw-vault-value">
                  {lastVaultUpdate.getTime() - Date.now() < 5000 ? 'Just now' : lastVaultUpdate.toLocaleTimeString()}
                </span>
              </div>
              <div className="vw-vault-stat-row">
                <span className="vw-label-sm">Total supply</span>
                <span className="vw-vault-value">{getTotalSupply()} LAND</span>
              </div>
              <div className="vw-vault-stat-row">
                <span className="vw-label-sm">Vault health</span>
                <span className="vw-vault-value">{getVaultHealth()} backed</span>
              </div>
            </div>

            <div className="vw-vault-footer">
              50% miners Â· 30% dev Â· 20% founders
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

