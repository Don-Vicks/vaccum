import { PublicKey } from '@solana/web3.js'
import { getConfig } from '../config.js'
import {
  getAllTrackedAccounts,
  getTrackedAccount,
  isAccountProtected,
  updateAccountState,
} from '../db/accounts.js'
import { getAccountInfo, getTokenAccountData } from '../services/solana.js'
import { daysSince, formatSol } from '../utils/helpers.js'
import { logger } from '../utils/logger.js'
import type { DetectionResult } from './types.js'

/**
 * Detector for identifying reclaimable accounts
 */
export class ReclaimableDetector {
  private get minInactiveDays(): number {
    return getConfig().minInactiveDays
  }

  /**
   * Check if a single account is reclaimable
   */
  async checkAccount(pubkey: PublicKey): Promise<DetectionResult | null> {
    const trackedAccount = getTrackedAccount(pubkey)

    if (!trackedAccount) {
      logger.warn(`Account not tracked: ${pubkey.toBase58()}`)
      return null
    }

    // Skip protected accounts
    if (isAccountProtected(pubkey)) {
      logger.debug(`Account is protected: ${pubkey.toBase58()}`)
      return null
    }

    // Get current account state from chain
    const accountInfo = await getAccountInfo(pubkey)

    // Account is closed (no longer exists on chain)
    if (!accountInfo) {
      const result: DetectionResult = {
        account: trackedAccount,
        reason: 'closed',
        reclaimableLamports: trackedAccount.rentLamports,
        safe: true,
        details:
          'Account no longer exists on-chain. Rent was already returned to original payer.',
      }

      // Update status in DB
      updateAccountState(pubkey, { status: 'reclaimed', rentLamports: 0 })

      return result
    }

    // Check if it's a token account with zero balance
    if (
      trackedAccount.accountType === 'token_account' ||
      trackedAccount.accountType === 'ata'
    ) {
      const tokenData = await getTokenAccountData(pubkey)

      if (tokenData && tokenData.amount === 0n) {
        const result: DetectionResult = {
          account: {
            ...trackedAccount,
            rentLamports: tokenData.lamports,
          },
          reason: 'zero_balance',
          reclaimableLamports: tokenData.lamports,
          safe: true,
          details: `Token account has 0 balance. Can close and reclaim ${formatSol(tokenData.lamports)}.`,
        }

        // Update status in DB
        updateAccountState(pubkey, {
          status: 'reclaimable',
          rentLamports: tokenData.lamports,
        })

        return result
      }
    }

    // Check for inactivity
    if (trackedAccount.lastActivityAt) {
      const inactiveDays = daysSince(trackedAccount.lastActivityAt)

      if (inactiveDays >= this.minInactiveDays) {
        const result: DetectionResult = {
          account: trackedAccount,
          reason: 'inactive',
          reclaimableLamports: accountInfo.lamports,
          safe: false, // Mark as unsafe since we can't automatically close non-empty accounts
          details: `Account inactive for ${inactiveDays} days. Manual review recommended.`,
        }

        return result
      }
    }

    // Account is active/not reclaimable
    updateAccountState(pubkey, {
      status: 'active',
      rentLamports: accountInfo.lamports,
    })
    return null
  }

  /**
   * Find all reclaimable accounts
   */
  async findAllReclaimable(): Promise<DetectionResult[]> {
    const accounts = getAllTrackedAccounts()
    const results: DetectionResult[] = []

    logger.info(`Checking ${accounts.length} tracked accounts...`)

    for (const account of accounts) {
      if (account.status === 'reclaimed' || account.status === 'protected') {
        continue
      }

      try {
        const result = await this.checkAccount(account.pubkey)
        if (result) {
          results.push(result)
        }
      } catch (error) {
        logger.error(
          `Error checking account ${account.pubkey.toBase58()}:`,
          error,
        )
      }
    }

    logger.info(
      `Found ${results.length} reclaimable accounts out of ${accounts.length} total`,
    )

    return results
  }

  /**
   * Find only safe-to-reclaim accounts (zero balance token accounts)
   */
  async findSafeReclaimable(): Promise<DetectionResult[]> {
    const all = await this.findAllReclaimable()
    return all.filter((r) => r.safe)
  }

  /**
   * Quick check if an account is closed
   */
  async isAccountClosed(pubkey: PublicKey): Promise<boolean> {
    const info = await getAccountInfo(pubkey)
    return info === null
  }

  /**
   * Get summary of reclaimable rent
   */
  async getReclaimableSummary(): Promise<{
    totalAccounts: number
    safeToReclaim: number
    unsafeNeedsReview: number
    totalReclaimableLamports: number
    safeReclaimableLamports: number
  }> {
    const results = await this.findAllReclaimable()

    const safeResults = results.filter((r) => r.safe)
    const unsafeResults = results.filter((r) => !r.safe)

    return {
      totalAccounts: results.length,
      safeToReclaim: safeResults.length,
      unsafeNeedsReview: unsafeResults.length,
      totalReclaimableLamports: results.reduce(
        (sum, r) => sum + r.reclaimableLamports,
        0,
      ),
      safeReclaimableLamports: safeResults.reduce(
        (sum, r) => sum + r.reclaimableLamports,
        0,
      ),
    }
  }
}

// Export singleton instance
export const detector = new ReclaimableDetector()
