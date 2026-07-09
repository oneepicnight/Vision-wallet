// ED25519 SHA-512 Setup - Must be imported before any ed25519 operations
import { ed25519 } from '@noble/curves/ed25519.js'

// @noble/curves/ed25519 uses sha512 from @noble/hashes automatically
// No manual configuration needed for v2.x of @noble/curves

console.log('[ed25519-setup] Using @noble/curves/ed25519 with automatic SHA-512')

export { ed25519 }
