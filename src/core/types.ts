import { PublicKey } from '@solana/web3.js'

/**
 * Types of accounts that can be sponsored and tracked
 */
export type AccountType = 'token_account' | 'ata' | 'pda' | 'unknown'

/**
 * Status of a tracked account
 */
export type AccountStatus = 'active' | 'reclaimable' | 'reclaimed' | 'protected'

/**
 * Reason why an account is reclaimable
 */
export type ReclaimReason = 'closed' | 'zero_balance' | 'inactive'

/**
 * A sponsored account being tracked by the bot
 */
export interface TrackedAccount {
  id?: number
  pubkey: PublicKey
  accountType: AccountType
  sponsorTx?: string
  rentLamports: number
  owner?: PublicKey
  mint?: PublicKey // For token accounts
  createdAt: Date
  lastCheckedAt: Date
  lastActivityAt?: Date
  status: AccountStatus
}

/**
 * Database row representation of a tracked account
 */
export interface TrackedAccountRow {
  id: number
  pubkey: string
  account_type: string
  sponsor_tx: string | null
  rent_lamports: number
  owner: string | null
  mint: string | null
  created_at: string
  last_checked_at: string
  last_activity_at: string | null
  status: string
}

/**
 * Result of checking if an account is reclaimable
 */
export interface DetectionResult {
  account: TrackedAccount
  reason: ReclaimReason
  reclaimableLamports: number
  safe: boolean
  details: string
}

/**
 * Result of a rent reclaim operation
 */
export interface ReclaimResult {
  accountPubkey: PublicKey
  amountReclaimed: number // in lamports
  txSignature: string
  timestamp: Date
  success: boolean
  error?: string
}

/**
 * Database row for reclaim history
 */
export interface ReclaimHistoryRow {
  id: number
  account_pubkey: string
  amount_reclaimed: number
  tx_signature: string
  reclaimed_at: string
  reason: string
}

/**
 * Summary report of rent status
 */
export interface RentReport {
  totalTrackedAccounts: number
  activeAccounts: number
  reclaimableAccounts: number
  reclaimedAccounts: number
  protectedAccounts: number
  totalRentLockedLamports: number
  totalRentReclaimedLamports: number
  reclaimableNowLamports: number
  accountsByType: Record<AccountType, number>
  generatedAt: Date
}

/**
 * Options for scanning accounts
 */
export interface ScanOptions {
  fromSignature?: string
  limit?: number
  accountType?: AccountType
}

/**
 * Options for checking reclaimable accounts
 */
export interface CheckOptions {
  address?: PublicKey
  includeProtected?: boolean
  force?: boolean
}

/**
 * Options for reclaiming rent
 */
export interface ReclaimOptions {
  dryRun?: boolean
  maxAccounts?: number
  skipConfirmation?: boolean
}

/**
 * Whitelist/blacklist entry
 */
export interface ProtectionEntry {
  pubkey: PublicKey
  reason: string
  addedAt: Date
}
