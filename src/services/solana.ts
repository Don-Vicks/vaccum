import {
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  createCloseAccountInstruction,
  getAccount,
} from '@solana/spl-token'
import {
  AccountInfo,
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { getConfig, loadOperatorKeypair } from '../config.js'
import type { AccountType } from '../core/types.js'
import { retry } from '../utils/helpers.js'
import { logger } from '../utils/logger.js'

let connection: Connection | null = null
let operatorKeypair: Keypair | null = null

/**
 * Get or create a Solana connection
 */
export function getConnection(): Connection {
  if (!connection) {
    const config = getConfig()
    connection = new Connection(config.rpcUrl, 'confirmed')
    logger.debug(`Connected to Solana RPC: ${config.rpcUrl}`)
  }
  return connection
}

/**
 * Get the operator keypair for signing transactions
 */
export function getOperatorKeypair(): Keypair {
  if (!operatorKeypair) {
    const config = getConfig()
    const secretKey = loadOperatorKeypair(config.operatorKeypairPath)
    operatorKeypair = Keypair.fromSecretKey(secretKey)
    logger.debug(`Operator address: ${operatorKeypair.publicKey.toBase58()}`)
  }
  return operatorKeypair
}

/**
 * Get account info with retry logic
 */
export async function getAccountInfo(
  pubkey: PublicKey,
): Promise<AccountInfo<Buffer> | null> {
  const conn = getConnection()
  return retry(async () => {
    return conn.getAccountInfo(pubkey)
  })
}

/**
 * Get multiple accounts info
 */
export async function getMultipleAccountsInfo(
  pubkeys: PublicKey[],
): Promise<(AccountInfo<Buffer> | null)[]> {
  const conn = getConnection()
  return retry(async () => {
    return conn.getMultipleAccountsInfo(pubkeys)
  })
}

/**
 * Check if an account exists (has lamports)
 */
export async function accountExists(pubkey: PublicKey): Promise<boolean> {
  const info = await getAccountInfo(pubkey)
  return info !== null && info.lamports > 0
}

/**
 * Get the type of account based on owner program
 */
export function detectAccountType(
  accountInfo: AccountInfo<Buffer>,
): AccountType {
  const owner = accountInfo.owner

  if (owner.equals(TOKEN_PROGRAM_ID)) {
    return 'token_account'
  }

  // Check for Associated Token Program
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  )
  if (owner.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
    return 'ata'
  }

  // If owned by a program (not system), it's likely a PDA
  const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111')
  if (!owner.equals(SYSTEM_PROGRAM_ID)) {
    return 'pda'
  }

  return 'unknown'
}

/**
 * Get token account data (balance, owner, mint)
 */
export async function getTokenAccountData(pubkey: PublicKey): Promise<{
  mint: PublicKey
  owner: PublicKey
  amount: bigint
  lamports: number
} | null> {
  try {
    const conn = getConnection()
    const account = await getAccount(conn, pubkey)

    const info = await getAccountInfo(pubkey)
    const lamports = info?.lamports || 0

    return {
      mint: account.mint,
      owner: account.owner,
      amount: account.amount,
      lamports,
    }
  } catch (error) {
    if (
      error instanceof TokenAccountNotFoundError ||
      error instanceof TokenInvalidAccountOwnerError
    ) {
      return null
    }
    throw error
  }
}

/**
 * Close a token account and reclaim rent
 */
export async function closeTokenAccount(
  tokenAccountPubkey: PublicKey,
  destinationPubkey: PublicKey,
  authorityKeypair: Keypair,
): Promise<string> {
  const conn = getConnection()

  // Verify the token account has zero balance
  const tokenData = await getTokenAccountData(tokenAccountPubkey)
  if (!tokenData) {
    throw new Error(`Token account not found: ${tokenAccountPubkey.toBase58()}`)
  }

  if (tokenData.amount > 0n) {
    throw new Error(
      `Cannot close token account with non-zero balance: ${tokenData.amount}`,
    )
  }

  // Verify authority matches
  if (!tokenData.owner.equals(authorityKeypair.publicKey)) {
    throw new Error(
      `Authority mismatch. Account owner: ${tokenData.owner.toBase58()}, ` +
        `provided authority: ${authorityKeypair.publicKey.toBase58()}`,
    )
  }

  // Build close instruction
  const closeInstruction = createCloseAccountInstruction(
    tokenAccountPubkey,
    destinationPubkey,
    authorityKeypair.publicKey,
  )

  const transaction = new Transaction().add(closeInstruction)

  // Send and confirm transaction
  const signature = await sendAndConfirmTransaction(conn, transaction, [
    authorityKeypair,
  ])

  logger.success(
    `Closed token account ${tokenAccountPubkey.toBase58()}, ` +
      `reclaimed ${tokenData.lamports} lamports. TX: ${signature}`,
  )

  return signature
}

/**
 * Get recent transactions for an account
 */
export async function getRecentSignatures(
  pubkey: PublicKey,
  limit = 10,
): Promise<string[]> {
  const conn = getConnection()
  const signatures = await conn.getSignaturesForAddress(pubkey, { limit })
  return signatures.map((s) => s.signature)
}

/**
 * Get all token accounts owned by operator
 */
export async function getOperatorTokenAccounts(): Promise<
  { pubkey: PublicKey; account: AccountInfo<ParsedAccountData> }[]
> {
  const conn = getConnection()
  const operator = getOperatorKeypair()

  const result = await conn.getParsedTokenAccountsByOwner(operator.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  })

  return result.value
}

/**
 * Get current slot
 */
export async function getCurrentSlot(): Promise<number> {
  const conn = getConnection()
  return conn.getSlot()
}

/**
 * Get rent exempt minimum for a given data size
 */
export async function getRentExemptMinimum(dataSize: number): Promise<number> {
  const conn = getConnection()
  return conn.getMinimumBalanceForRentExemption(dataSize)
}
