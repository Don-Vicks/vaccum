import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { getConfig } from '../config.js'
import { logger } from '../utils/logger.js'

let db: Database.Database | null = null

/**
 * Initialize the database with required tables
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const config = getConfig()
  const dbPath = path.resolve(config.dbPath)
  const dbDir = path.dirname(dbPath)

  // Create data directory if it doesn't exist
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
    logger.debug(`Created database directory: ${dbDir}`)
  }

  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  db.pragma('user_version', { simple: true })

  // Create tables
  db.exec(`
    -- Tracked accounts sponsored by Kora
    CREATE TABLE IF NOT EXISTS tracked_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pubkey TEXT UNIQUE NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'unknown',
      sponsor_tx TEXT,
      rent_lamports INTEGER NOT NULL DEFAULT 0,
      owner TEXT,
      mint TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity_at TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );

    -- Index for faster status queries
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON tracked_accounts(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_type ON tracked_accounts(account_type);

    -- Reclaim history for audit trail
    CREATE TABLE IF NOT EXISTS reclaim_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_pubkey TEXT NOT NULL,
      amount_reclaimed INTEGER NOT NULL,
      tx_signature TEXT NOT NULL,
      reason TEXT,
      reclaimed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Protected accounts (whitelist)
    CREATE TABLE IF NOT EXISTS protected_accounts (
      pubkey TEXT PRIMARY KEY,
      reason TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Initialize operators table
  db.exec(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      keypair_path TEXT NOT NULL,
      treasury_address TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_default BOOLEAN DEFAULT 0
    );
  `)

  // Add operator_id column to tracked_accounts if it doesn't exist
  const columns = db
    .prepare('PRAGMA table_info(tracked_accounts)')
    .all() as any[]
  const hasOperatorId = columns.some((col) => col.name === 'operator_id')

  if (!hasOperatorId) {
    db.exec(
      'ALTER TABLE tracked_accounts ADD COLUMN operator_id INTEGER REFERENCES operators(id);',
    )
    db.exec(
      'ALTER TABLE reclaim_history ADD COLUMN operator_id INTEGER REFERENCES operators(id);',
    )
  }

  logger.info(`Database initialized at: ${dbPath}`)
  return db
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    logger.debug('Database connection closed')
  }
}
