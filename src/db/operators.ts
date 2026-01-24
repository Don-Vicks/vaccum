import { PublicKey } from '@solana/web3.js'
import Database from 'better-sqlite3'
import path from 'path'
import { getConfig } from '../config.js'
import { logger } from '../utils/logger.js'

export interface Operator {
  id: number
  name: string
  keypair_path: string
  treasury_address: PublicKey
  created_at: Date
  is_default: boolean
}

let operatorsDb: Database.Database | null = null

export function getOperatorsDb(): Database.Database {
  if (!operatorsDb) {
    const config = getConfig()
    const dbPath = path.resolve(config.dbPath)
    operatorsDb = new Database(dbPath)
  }
  return operatorsDb
}

/**
 * Initialize operators table
 */
export function initOperatorsTable(): void {
  const db = getOperatorsDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      keypair_path TEXT NOT NULL,
      treasury_address TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_default BOOLEAN DEFAULT 0
    )
  `)

  // Add operator_id to tracked_accounts if it doesn't exist
  const columns = db
    .prepare('PRAGMA table_info(tracked_accounts)')
    .all() as any[]
  const hasOperatorId = columns.some((col) => col.name === 'operator_id')

  if (!hasOperatorId) {
    db.exec(`
      ALTER TABLE tracked_accounts ADD COLUMN operator_id INTEGER REFERENCES operators(id);
    `)
    logger.debug('Added operator_id column to tracked_accounts')
  }

  logger.debug('Operators table initialized')
}

/**
 * Add a new operator
 */
export function addOperator(
  name: string,
  keypairPath: string,
  treasuryAddress: PublicKey,
  setAsDefault = false,
): Operator {
  const db = getOperatorsDb()

  if (setAsDefault) {
    // Unset all current defaults
    db.prepare('UPDATE operators SET is_default = 0').run()
  }

  const result = db
    .prepare(
      `INSERT INTO operators (name, keypair_path, treasury_address, is_default)
       VALUES (?, ?, ?, ?)`,
    )
    .run(name, keypairPath, treasuryAddress.toBase58(), setAsDefault ? 1 : 0)

  logger.success(`Added operator: ${name}`)

  return {
    id: result.lastInsertRowid as number,
    name,
    keypair_path: keypairPath,
    treasury_address: treasuryAddress,
    created_at: new Date(),
    is_default: setAsDefault,
  }
}

/**
 * Get all operators
 */
export function getAllOperators(): Operator[] {
  const db = getOperatorsDb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = db
    .prepare('SELECT * FROM operators ORDER BY created_at DESC')
    .all()

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keypair_path: row.keypair_path,
    treasury_address: new PublicKey(row.treasury_address),
    created_at: new Date(row.created_at),
    is_default: Boolean(row.is_default),
  }))
}

/**
 * Get operator by ID
 */
export function getOperatorById(id: number): Operator | undefined {
  const db = getOperatorsDb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = db.prepare('SELECT * FROM operators WHERE id = ?').get(id)

  if (!row) return undefined

  return {
    id: row.id,
    name: row.name,
    keypair_path: row.keypair_path,
    treasury_address: new PublicKey(row.treasury_address),
    created_at: new Date(row.created_at),
    is_default: Boolean(row.is_default),
  }
}

/**
 * Get operator by name
 */
export function getOperatorByName(name: string): Operator | undefined {
  const db = getOperatorsDb()
  const row = db.prepare('SELECT * FROM operators WHERE name = ?').get(name) as
    | {
        id: number
        name: string
        keypair_path: string
        treasury_address: string
        created_at: string
        is_default: number
      }
    | undefined

  if (!row) return undefined

  return {
    id: row.id,
    name: row.name,
    keypair_path: row.keypair_path,
    treasury_address: new PublicKey(row.treasury_address),
    created_at: new Date(row.created_at),
    is_default: Boolean(row.is_default),
  }
}

/**
 * Get default operator
 */
export function getDefaultOperator(): Operator | undefined {
  const db = getOperatorsDb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = db
    .prepare('SELECT * FROM operators WHERE is_default = 1')
    .get()

  if (!row) {
    // Return first operator if no default set
    const first = db
      .prepare('SELECT * FROM operators ORDER BY created_at ASC LIMIT 1')
      .get() as any
    if (!first) return undefined
    return {
      id: first.id,
      name: first.name,
      keypair_path: first.keypair_path,
      treasury_address: new PublicKey(first.treasury_address),
      created_at: new Date(first.created_at),
      is_default: Boolean(first.is_default),
    }
  }

  return {
    id: row.id,
    name: row.name,
    keypair_path: row.keypair_path,
    treasury_address: new PublicKey(row.treasury_address),
    created_at: new Date(row.created_at),
    is_default: Boolean(row.is_default),
  }
}

/**
 * Set default operator
 */
export function setDefaultOperator(id: number): void {
  const db = getOperatorsDb()

  // Unset all defaults
  db.prepare('UPDATE operators SET is_default = 0').run()

  // Set new default
  db.prepare('UPDATE operators SET is_default = 1 WHERE id = ?').run(id)

  logger.success(`Set default operator: ID ${id}`)
}

/**
 * Remove operator
 */
export function removeOperator(id: number): void {
  const db = getOperatorsDb()

  // Check if operator has tracked accounts
  const count = db
    .prepare(
      'SELECT COUNT(*) as count FROM tracked_accounts WHERE operator_id = ?',
    )
    .get(id) as any

  if (count.count > 0) {
    throw new Error(
      `Cannot remove operator: ${count.count} accounts are tracked. Delete accounts first.`,
    )
  }

  db.prepare('DELETE FROM operators WHERE id = ?').run(id)
  logger.success(`Removed operator: ID ${id}`)
}

/**
 * Update operator
 */
export function updateOperator(
  id: number,
  updates: Partial<
    Pick<Operator, 'name' | 'keypair_path' | 'treasury_address'>
  >,
): void {
  const db = getOperatorsDb()

  const fields: string[] = []
  const values: any[] = []

  if (updates.name) {
    fields.push('name = ?')
    values.push(updates.name)
  }

  if (updates.keypair_path) {
    fields.push('keypair_path = ?')
    values.push(updates.keypair_path)
  }

  if (updates.treasury_address) {
    fields.push('treasury_address = ?')
    values.push(updates.treasury_address.toBase58())
  }

  if (fields.length === 0) return

  values.push(id)

  db.prepare(`UPDATE operators SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values,
  )

  logger.success(`Updated operator: ID ${id}`)
}
