import { PublicKey } from '@solana/web3.js'
import type {
  AccountStatus,
  AccountType,
  ProtectionEntry,
  ReclaimHistoryRow,
  TrackedAccount,
  TrackedAccountRow,
} from '../core/types.js'
import { getDatabase } from './index.js'

/**
 * Convert database row to TrackedAccount
 */
function rowToAccount(row: TrackedAccountRow): TrackedAccount {
  return {
    id: row.id,
    pubkey: new PublicKey(row.pubkey),
    accountType: row.account_type as AccountType,
    sponsorTx: row.sponsor_tx || undefined,
    rentLamports: row.rent_lamports,
    owner: row.owner ? new PublicKey(row.owner) : undefined,
    mint: row.mint ? new PublicKey(row.mint) : undefined,
    createdAt: new Date(row.created_at),
    lastCheckedAt: new Date(row.last_checked_at),
    lastActivityAt: row.last_activity_at
      ? new Date(row.last_activity_at)
      : undefined,
    status: row.status as AccountStatus,
  }
}

// ==================== TRACKED ACCOUNTS ====================

/**
 * Add a new account to track
 */
export function addTrackedAccount(account: Omit<TrackedAccount, 'id'>): number {
  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT INTO tracked_accounts (pubkey, account_type, sponsor_tx, rent_lamports, owner, mint, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pubkey) DO UPDATE SET
      account_type = excluded.account_type,
      rent_lamports = excluded.rent_lamports,
      owner = excluded.owner,
      mint = excluded.mint,
      last_checked_at = datetime('now')
  `)

  const result = stmt.run(
    account.pubkey.toBase58(),
    account.accountType,
    account.sponsorTx || null,
    account.rentLamports,
    account.owner?.toBase58() || null,
    account.mint?.toBase58() || null,
    account.status,
  )

  return result.lastInsertRowid as number
}

/**
 * Get all tracked accounts
 */
export function getAllTrackedAccounts(): TrackedAccount[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM tracked_accounts ORDER BY created_at DESC')
    .all() as TrackedAccountRow[]
  return rows.map(rowToAccount)
}

/**
 * Get tracked accounts by status
 */
export function getAccountsByStatus(status: AccountStatus): TrackedAccount[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      'SELECT * FROM tracked_accounts WHERE status = ? ORDER BY created_at DESC',
    )
    .all(status) as TrackedAccountRow[]
  return rows.map(rowToAccount)
}

/**
 * Get a specific tracked account by pubkey
 */
export function getTrackedAccount(pubkey: PublicKey): TrackedAccount | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM tracked_accounts WHERE pubkey = ?')
    .get(pubkey.toBase58()) as TrackedAccountRow | undefined
  return row ? rowToAccount(row) : null
}

/**
 * Update account status
 */
export function updateAccountStatus(
  pubkey: PublicKey,
  status: AccountStatus,
): void {
  const db = getDatabase()
  db.prepare(
    "UPDATE tracked_accounts SET status = ?, last_checked_at = datetime('now') WHERE pubkey = ?",
  ).run(status, pubkey.toBase58())
}

/**
 * Update account after checking state
 */
export function updateAccountState(
  pubkey: PublicKey,
  updates: {
    status?: AccountStatus
    rentLamports?: number
    lastActivityAt?: Date
  },
): void {
  const db = getDatabase()

  const setClauses: string[] = ["last_checked_at = datetime('now')"]
  const params: (string | number)[] = []

  if (updates.status !== undefined) {
    setClauses.push('status = ?')
    params.push(updates.status)
  }
  if (updates.rentLamports !== undefined) {
    setClauses.push('rent_lamports = ?')
    params.push(updates.rentLamports)
  }
  if (updates.lastActivityAt !== undefined) {
    setClauses.push('last_activity_at = ?')
    params.push(updates.lastActivityAt.toISOString())
  }

  params.push(pubkey.toBase58())

  db.prepare(
    `UPDATE tracked_accounts SET ${setClauses.join(', ')} WHERE pubkey = ?`,
  ).run(...params)
}

/**
 * Delete a tracked account
 */
export function deleteTrackedAccount(pubkey: PublicKey): void {
  const db = getDatabase()
  db.prepare('DELETE FROM tracked_accounts WHERE pubkey = ?').run(
    pubkey.toBase58(),
  )
}

/**
 * Get account statistics
 */
export function getAccountStats(): {
  total: number
  active: number
  reclaimable: number
  reclaimed: number
  protected: number
  totalRentLocked: number
  totalRentReclaimed: number
} {
  const db = getDatabase()

  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'reclaimable' THEN 1 ELSE 0 END) as reclaimable,
      SUM(CASE WHEN status = 'reclaimed' THEN 1 ELSE 0 END) as reclaimed,
      SUM(CASE WHEN status = 'protected' THEN 1 ELSE 0 END) as protected,
      SUM(CASE WHEN status IN ('active', 'reclaimable') THEN rent_lamports ELSE 0 END) as total_rent_locked
    FROM tracked_accounts
  `,
    )
    .get() as {
    total: number
    active: number
    reclaimable: number
    reclaimed: number
    protected: number
    total_rent_locked: number
  }

  const reclaimStats = db
    .prepare(
      'SELECT COALESCE(SUM(amount_reclaimed), 0) as total FROM reclaim_history',
    )
    .get() as { total: number }

  return {
    total: stats.total || 0,
    active: stats.active || 0,
    reclaimable: stats.reclaimable || 0,
    reclaimed: stats.reclaimed || 0,
    protected: stats.protected || 0,
    totalRentLocked: stats.total_rent_locked || 0,
    totalRentReclaimed: reclaimStats.total || 0,
  }
}

// ==================== RECLAIM HISTORY ====================

/**
 * Add reclaim history entry
 */
export function addReclaimHistory(
  accountPubkey: PublicKey,
  amountReclaimed: number,
  txSignature: string,
  reason: string,
): void {
  const db = getDatabase()
  db.prepare(
    `
    INSERT INTO reclaim_history (account_pubkey, amount_reclaimed, tx_signature, reason)
    VALUES (?, ?, ?, ?)
  `,
  ).run(accountPubkey.toBase58(), amountReclaimed, txSignature, reason)
}

/**
 * Get reclaim history
 */
export function getReclaimHistory(limit = 100): ReclaimHistoryRow[] {
  const db = getDatabase()
  return db
    .prepare('SELECT * FROM reclaim_history ORDER BY reclaimed_at DESC LIMIT ?')
    .all(limit) as ReclaimHistoryRow[]
}

// ==================== PROTECTED ACCOUNTS ====================

/**
 * Add account to protection list
 */
export function addProtectedAccount(pubkey: PublicKey, reason: string): void {
  const db = getDatabase()
  db.prepare(
    `
    INSERT OR REPLACE INTO protected_accounts (pubkey, reason)
    VALUES (?, ?)
  `,
  ).run(pubkey.toBase58(), reason)

  // Update status in tracked accounts
  db.prepare(
    "UPDATE tracked_accounts SET status = 'protected' WHERE pubkey = ?",
  ).run(pubkey.toBase58())
}

/**
 * Remove account from protection list
 */
export function removeProtectedAccount(pubkey: PublicKey): void {
  const db = getDatabase()
  db.prepare('DELETE FROM protected_accounts WHERE pubkey = ?').run(
    pubkey.toBase58(),
  )

  // Reset status to active
  db.prepare(
    "UPDATE tracked_accounts SET status = 'active' WHERE pubkey = ?",
  ).run(pubkey.toBase58())
}

/**
 * Check if account is protected
 */
export function isAccountProtected(pubkey: PublicKey): boolean {
  const db = getDatabase()
  const row = db
    .prepare('SELECT 1 FROM protected_accounts WHERE pubkey = ?')
    .get(pubkey.toBase58())
  return row !== undefined
}

/**
 * Get all protected accounts
 */
export function getProtectedAccounts(): ProtectionEntry[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM protected_accounts').all() as {
    pubkey: string
    reason: string
    added_at: string
  }[]

  return rows.map((row) => ({
    pubkey: new PublicKey(row.pubkey),
    reason: row.reason,
    addedAt: new Date(row.added_at),
  }))
}
