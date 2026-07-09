import { useState, useEffect } from 'react'
import { useWalletStore } from '../state/wallet'
import { getBaseUrl, setBaseUrl, pingStatus } from '../lib/api'
import { loadAndDecrypt } from '../lib/keystore'
import { del } from 'idb-keyval'

export default function Settings() {
  const { reset: resetWallet, profile } = useWalletStore()
  const [nodeUrl, setNodeUrl] = useState('')
  const [nodeTestStatus, setNodeTestStatus] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [mnemonic, setMnemonic] = useState<string[]>([])
  const [privateKey, setPrivateKey] = useState('')
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [wipeConfirm, setWipeConfirm] = useState('')
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    getBaseUrl().then(url => setNodeUrl(url));
    
    // Load theme preference
    const savedTheme = localStorage.getItem('vision.theme')
    if (savedTheme === 'light') {
      setDarkMode(false)
      document.documentElement.classList.remove('dark')
    } else {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const handleTestNode = async () => {
    setNodeTestStatus('Testing...')
    
    try {
      // Temporarily update base URL for test
      const originalUrl = await getBaseUrl()
      setBaseUrl(nodeUrl)
      
      const result = await pingStatus()
      
      if (result.up) {
        setNodeTestStatus('✓ Connected successfully')
        // Keep the new URL
      } else {
        setNodeTestStatus('✗ Connection failed')
        // Restore original URL
        setBaseUrl(originalUrl)
        setNodeUrl(originalUrl)
      }
    } catch (error) {
      setNodeTestStatus('✗ Network error')
      // Restore original URL on error
      const originalUrl = await getBaseUrl()
      setBaseUrl(originalUrl)
      setNodeUrl(originalUrl)
    }
    
    setTimeout(() => setNodeTestStatus(''), 3000)
  }

  const handleExportBackup = async () => {
    if (!confirm('This will display your recovery words and private key. Make sure no one is watching your screen.')) {
      return
    }

    try {
      const keystore = await loadAndDecrypt()
      if (!keystore) {
        window.pushToast?.('Could not decrypt keystore. You may need to re-create your wallet.', 'error')
        return
      }
      
      setMnemonic(keystore.mnemonic)
      setPrivateKey(keystore.privateKeyHex)
      setShowMnemonic(true)
      setShowPrivateKey(false) // Hide by default for security
    } catch (error) {
      console.error('Export failed:', error)
      window.pushToast?.('Failed to export backup. Please try again.', 'error')
    }
  }

  const handleDownloadKeysFile = async () => {
    if (!confirm('This will download a JSON file containing your private keys. Keep it safe and never share it!')) {
      return
    }

    try {
      const keystore = await loadAndDecrypt()
      if (!keystore) {
        window.pushToast?.('Could not decrypt keystore.', 'error')
        return
      }

      // Derive public key if not stored (backward compatibility)
      let publicKeyHex = keystore.publicKeyHex
      if (!publicKeyHex) {
        const { deriveKeys } = await import('../lib/keystore')
        const keys = await deriveKeys(keystore.mnemonic)
        publicKeyHex = keys.publicKeyHex
      }

      // Create keys.json format matching the node's expected format
      const keysData = {
        address: profile?.address || '',
        privateKey: keystore.privateKeyHex,
        publicKey: publicKeyHex,
        mnemonic: keystore.mnemonic,
        createdAt: new Date().toISOString()
      }

      // Create blob and download
      const blob = new Blob([JSON.stringify(keysData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vision-keys-${profile?.address?.slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      window.pushToast?.('Keys file downloaded successfully!', 'success')
    } catch (error) {
      console.error('Download failed:', error)
      window.pushToast?.('Failed to download keys file.', 'error')
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    window.pushToast?.(`${label} copied to clipboard!`, 'success')
  }

  const handleWipeWallet = async () => {
    if (wipeConfirm !== 'VISION') {
      window.pushToast?.('Type "VISION" to confirm wallet wipe.', 'info')
      return
    }

    if (!confirm('This will permanently delete your wallet. Are you absolutely sure?')) {
      return
    }

    try {
      // Clear IndexedDB
      await del('vision.keystore')
      await del('vision.device.secret')
      
      // Clear localStorage
      localStorage.removeItem('vision-wallet')
      localStorage.removeItem('vision.node.url')
      localStorage.removeItem('vision.theme')
      
      // Reset wallet state
      resetWallet()
      
  window.pushToast?.('Wallet wiped successfully. Redirecting...', 'success')
  window.location.href = '/'
    } catch (error) {
      console.error('Wipe failed:', error)
      window.pushToast?.('Failed to wipe wallet. Please try again.', 'error')
    }
  }

  const handleThemeToggle = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('vision.theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('vision.theme', 'light')
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-3xl font-bold">Settings</h2>

        {/* Node Configuration */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold">Node Configuration</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-slate-400 mb-1 block">Node URL</span>
              <div className="flex gap-2">
                <input 
                  value={nodeUrl}
                  onChange={(e) => setNodeUrl(e.target.value)}
                  className="flex-1 bg-black/60 border border-white/20 rounded p-2 text-white"
                  placeholder="http://127.0.0.1:7070"
                />
                <button 
                  onClick={handleTestNode}
                  className="px-4 py-2 bg-accent/20 text-accent border border-accent/30 rounded hover:bg-accent/30 transition-colors"
                >
                  Test & Save
                </button>
              </div>
            </label>
            {nodeTestStatus && (
              <div className={`text-sm ${nodeTestStatus.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {nodeTestStatus}
              </div>
            )}
          </div>
        </div>

        {/* Security */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold">Security & Backup</h3>
          <div className="space-y-3">
            <button 
              onClick={handleExportBackup}
              className="w-full py-3 bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded font-semibold hover:bg-yellow-600/30 transition-colors"
            >
              View Backup Details
            </button>
            <p className="text-sm text-slate-400">
              Display recovery words and private key after confirmation
            </p>

            <button 
              onClick={handleDownloadKeysFile}
              className="w-full py-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded font-semibold hover:bg-blue-600/30 transition-colors"
            >
              Download Keys File (keys.json)
            </button>
            <p className="text-sm text-slate-400">
              Download a JSON file with your private keys for backup or node usage
            </p>
            
            {showMnemonic && (
              <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-yellow-400">Recovery Words (Mnemonic)</h4>
                    <button 
                      onClick={() => copyToClipboard(mnemonic.join(' '), 'Mnemonic')}
                      className="text-xs px-3 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded transition-colors"
                    >
                      Copy All
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {mnemonic.map((word, index) => (
                      <div key={index} className="bg-black/40 p-2 rounded text-center text-sm">
                        <span className="text-slate-400">{index + 1}.</span> {word}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-yellow-400">Private Key (Hex)</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="text-xs px-3 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded transition-colors"
                      >
                        {showPrivateKey ? 'Hide' : 'Show'}
                      </button>
                      {showPrivateKey && (
                        <button 
                          onClick={() => copyToClipboard(privateKey, 'Private key')}
                          className="text-xs px-3 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded transition-colors"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-black/40 p-3 rounded font-mono text-xs break-all">
                    {showPrivateKey ? privateKey : '•'.repeat(64)}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    ⚠️ Never share this key! Anyone with it can control your funds.
                  </p>
                </div>

                <div className="pt-2 border-t border-yellow-500/20">
                  <h4 className="font-semibold text-yellow-400 mb-2">Your Address</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/40 p-2 rounded font-mono text-xs break-all">
                      {profile?.address}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(profile?.address || '', 'Address')}
                      className="text-xs px-3 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded transition-colors whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setShowMnemonic(false)
                    setShowPrivateKey(false)
                    setPrivateKey('')
                  }}
                  className="w-full text-sm text-slate-400 hover:text-white py-2 border border-slate-600 hover:border-slate-400 rounded transition-colors"
                >
                  Hide All Sensitive Data
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold text-red-400">Danger Zone</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Type VISION to confirm"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
              className="w-full bg-black/60 border border-red-500/30 rounded p-2 text-white placeholder-slate-500"
            />
            <button 
              onClick={handleWipeWallet}
              disabled={wipeConfirm !== 'VISION'}
              className="w-full py-3 bg-red-600/20 text-red-400 border border-red-500/30 rounded font-semibold hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Wipe Local Wallet
            </button>
            <p className="text-sm text-slate-400">
              Clears all local data. Type 'VISION' to confirm.
            </p>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-semibold">Appearance</h3>
          <div className="flex items-center justify-between">
            <span>Dark mode</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={darkMode}
                onChange={handleThemeToggle}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}