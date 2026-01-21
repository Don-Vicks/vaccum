import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

/**
 * Convert lamports to SOL with fixed decimal places
 */
export function lamportsToSol(lamports: number, decimals = 6): number {
  return Number((lamports / LAMPORTS_PER_SOL).toFixed(decimals))
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

/**
 * Format lamports as SOL string with symbol
 */
export function formatSol(lamports: number): string {
  return `${lamportsToSol(lamports)} SOL`
}

/**
 * Shorten a public key for display
 */
export function shortenPubkey(pubkey: PublicKey | string, chars = 4): string {
  const str = typeof pubkey === 'string' ? pubkey : pubkey.toBase58()
  return `${str.slice(0, chars)}...${str.slice(-chars)}`
}

/**
 * Validate a public key string
 */
export function isValidPubkey(str: string): boolean {
  try {
    new PublicKey(str)
    return true
  } catch {
    return false
  }
}

/**
 * Parse a public key string safely
 */
export function parsePubkey(str: string): PublicKey | null {
  try {
    return new PublicKey(str)
  } catch {
    return null
  }
}

/**
 * Calculate rent for a given account size
 * Based on Solana's rent calculation (approx 0.00089 SOL per byte per year for 2 years)
 */
export function calculateMinimumRent(dataSize: number): number {
  // Solana rent: 19.055441478439427 lamports per byte per epoch (2 days)
  // Rent-exempt = 2 years = 365 epochs
  // ~6.96 lamports per byte for rent-exempt
  const LAMPORTS_PER_BYTE_YEAR = 3480
  const YEARS_FOR_EXEMPT = 2
  const ACCOUNT_HEADER_SIZE = 128 // Account metadata overhead

  return (
    (dataSize + ACCOUNT_HEADER_SIZE) * LAMPORTS_PER_BYTE_YEAR * YEARS_FOR_EXEMPT
  )
}

/**
 * Token Account size (165 bytes) minimum rent
 */
export const TOKEN_ACCOUNT_RENT = 2039280 // ~0.00204 SOL

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * Calculate days since a date
 */
export function daysSince(date: Date): number {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
