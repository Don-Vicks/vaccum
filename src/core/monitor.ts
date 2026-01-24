import { PublicKey } from '@solana/web3.js'
import {
  addTrackedAccount,
  getAllTrackedAccounts,
  getTrackedAccount,
} from '../db/accounts.js'
import {
  detectAccountType,
  getAccountInfo,
  getConnection,
  getOperatorTokenAccounts,
} from '../services/solana.js'
import { formatSol, shortenPubkey } from '../utils/helpers.js'
import { logger } from '../utils/logger.js'
import type { AccountType, ScanOptions, TrackedAccount } from './types.js'

/**
 * Monitor for tracking sponsored accounts
 */
export class AccountMonitor {
  /**
   * Scan all token accounts owned by the operator and add them to tracking
   */
  async scanOperatorAccounts(
    _options = { fullScan: false },
  ): Promise<TrackedAccount[]> {
    logger.info('Scanning operator token accounts...')

    const tokenAccounts = await getOperatorTokenAccounts()
    const tracked: TrackedAccount[] = []

    for (const { pubkey, account } of tokenAccounts) {
      const parsed = account.data.parsed
      if (!parsed || parsed.type !== 'account') continue

      const info = parsed.info
      const amount = BigInt(info.tokenAmount.amount)

      // Get current lamports (rent)
      const accountInfo = await getAccountInfo(pubkey)
      const lamports = accountInfo?.lamports || 0

      const trackedAccount: Omit<TrackedAccount, 'id'> = {
        pubkey,
        accountType: 'token_account',
        rentLamports: lamports,
        owner: new PublicKey(info.owner),
        mint: new PublicKey(info.mint),
        createdAt: new Date(),
        lastCheckedAt: new Date(),
        status: amount === 0n ? 'reclaimable' : 'active',
      }

      addTrackedAccount(trackedAccount)
      tracked.push(trackedAccount as TrackedAccount)

      logger.debug(
        `Tracked: ${shortenPubkey(pubkey)} | ` +
          `Balance: ${info.tokenAmount.uiAmount} | ` +
          `Rent: ${formatSol(lamports)}`,
      )
    }

    logger.success(`Scanned ${tracked.length} token accounts`)
    return tracked
  }

  /**
   * Scan accounts from transaction signatures (for Kora-sponsored accounts)
   * This would parse transaction logs to find sponsored account creations
   */
  async scanFromSignatures(
    signatures: string[],
    _options: ScanOptions = {},
  ): Promise<TrackedAccount[]> {
    const conn = getConnection()
    const tracked: TrackedAccount[] = []

    logger.info(
      `Scanning ${signatures.length} transactions for sponsored accounts...`,
    )

    for (const signature of signatures) {
      try {
        const tx = await conn.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        })

        if (!tx || !tx.meta) continue

        // Look for account creation in inner instructions
        // This is where Kora would create sponsored accounts
        const innerInstructions = tx.meta.innerInstructions || []

        for (const inner of innerInstructions) {
          for (const instruction of inner.instructions) {
            // Check for createAccount or initializeAccount instructions
            if ('parsed' in instruction) {
              const parsed = instruction.parsed

              if (
                parsed.type === 'createAccount' ||
                parsed.type === 'initializeAccount' ||
                parsed.type === 'initializeAccount3'
              ) {
                const info = parsed.info
                const accountPubkey = new PublicKey(
                  info.account || info.newAccount,
                )

                // Check if account exists and get its info
                const accountInfo = await getAccountInfo(accountPubkey)
                if (!accountInfo) continue

                const accountType = detectAccountType(accountInfo)

                const trackedAccount: Omit<TrackedAccount, 'id'> = {
                  pubkey: accountPubkey,
                  accountType,
                  sponsorTx: signature,
                  rentLamports: accountInfo.lamports,
                  createdAt: new Date(),
                  lastCheckedAt: new Date(),
                  status: 'active',
                }

                // Avoid duplicates
                if (!getTrackedAccount(accountPubkey)) {
                  addTrackedAccount(trackedAccount)
                  tracked.push(trackedAccount as TrackedAccount)

                  logger.debug(
                    `Found sponsored account: ${shortenPubkey(accountPubkey)} | ` +
                      `Type: ${accountType} | Rent: ${formatSol(accountInfo.lamports)}`,
                  )
                }
              }
            }
          }
        }
      } catch (error) {
        logger.debug(
          `Error parsing transaction ${shortenPubkey(signature)}:`,
          error,
        )
      }
    }

    logger.success(`Found ${tracked.length} new sponsored accounts`)
    return tracked
  }

  /**
   * Add a single account to tracking
   */
  async trackAccount(
    pubkey: PublicKey,
    sponsorTx?: string,
  ): Promise<TrackedAccount | null> {
    // Check if already tracked
    const existing = getTrackedAccount(pubkey)
    if (existing) {
      logger.debug(`Account already tracked: ${pubkey.toBase58()}`)
      return existing
    }

    // Get account info
    const accountInfo = await getAccountInfo(pubkey)
    if (!accountInfo) {
      logger.warn(`Account not found on chain: ${pubkey.toBase58()}`)
      return null
    }

    const accountType = detectAccountType(accountInfo)

    const trackedAccount: Omit<TrackedAccount, 'id'> = {
      pubkey,
      accountType,
      sponsorTx,
      rentLamports: accountInfo.lamports,
      createdAt: new Date(),
      lastCheckedAt: new Date(),
      status: 'active',
    }

    const id = addTrackedAccount(trackedAccount)

    logger.success(
      `Now tracking: ${pubkey.toBase58()} | Type: ${accountType} | ` +
        `Rent: ${formatSol(accountInfo.lamports)}`,
    )

    return { ...trackedAccount, id } as TrackedAccount
  }

  /**
   * Get tracking statistics
   */
  async getStats(): Promise<{
    totalTracked: number
    byType: Record<AccountType, number>
    byStatus: Record<string, number>
    totalRentLocked: number
  }> {
    const accounts = getAllTrackedAccounts()

    const byType: Record<AccountType, number> = {
      token_account: 0,
      ata: 0,
      pda: 0,
      unknown: 0,
    }

    const byStatus: Record<string, number> = {
      active: 0,
      reclaimable: 0,
      reclaimed: 0,
      protected: 0,
    }

    let totalRentLocked = 0

    for (const account of accounts) {
      byType[account.accountType] = (byType[account.accountType] || 0) + 1
      byStatus[account.status] = (byStatus[account.status] || 0) + 1

      if (account.status !== 'reclaimed') {
        totalRentLocked += account.rentLamports
      }
    }

    return {
      totalTracked: accounts.length,
      byType,
      byStatus,
      totalRentLocked,
    }
  }
}

// Export singleton instance
export const monitor = new AccountMonitor()
