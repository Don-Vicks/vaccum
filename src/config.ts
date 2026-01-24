import { PublicKey } from '@solana/web3.js'
import { config as loadEnv } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

// Load environment variables
loadEnv()

export interface Config {
  // Solana RPC
  rpcUrl: string

  // Operator settings
  treasuryAddress: PublicKey
  operatorKeypairPath: string

  // Kora integration
  koraNodeUrl?: string

  // Safety settings
  dryRun: boolean
  cooldownHours: number
  minInactiveDays: number

  // Database
  dbPath: string
}

// Helper to getenv or default
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    // Return empty string if no default (optional vars)
    return ''
  }
  return value
}

export function loadConfig(): Config {
  const treasuryAddressStr = process.env.TREASURY_ADDRESS

  if (!treasuryAddressStr) {
    throw new Error('TREASURY_ADDRESS is required. Set it in your .env file.')
  }

  let treasuryAddress: PublicKey
  try {
    treasuryAddress = new PublicKey(treasuryAddressStr)
  } catch {
    throw new Error(
      `Invalid TREASURY_ADDRESS: ${treasuryAddressStr}. Must be a valid Solana public key.`,
    )
  }

  const operatorKeypairPath = getEnv(
    'OPERATOR_KEYPAIR_PATH',
    './operator-keypair.json',
  )

  return {
    rpcUrl: getEnv('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
    treasuryAddress,
    operatorKeypairPath,
    koraNodeUrl: process.env.KORA_NODE_URL,
    dryRun: getEnv('DRY_RUN', 'true') === 'true',
    cooldownHours: parseInt(getEnv('COOLDOWN_HOURS', '24'), 10),
    minInactiveDays: parseInt(getEnv('MIN_INACTIVE_DAYS', '7'), 10),
    dbPath: getEnv('DB_PATH', './data/accounts.db'),
  }
}

export function loadOperatorKeypair(keypairPath: string): Uint8Array {
  const resolvedPath = path.resolve(keypairPath)

  if (!existsSync(resolvedPath)) {
    throw new Error(
      `Operator keypair not found at: ${resolvedPath}\n` +
        'Generate one with: solana-keygen new -o operator-keypair.json',
    )
  }

  const keypairData = JSON.parse(readFileSync(resolvedPath, 'utf-8'))
  return Uint8Array.from(keypairData)
}

// Export a singleton config (lazy loaded)
let _config: Config | null = null

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig()
  }
  return _config
}
