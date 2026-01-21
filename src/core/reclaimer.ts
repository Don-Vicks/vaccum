import { PublicKey } from '@solana/web3.js'
import { getConfig } from '../config.js'
import {
  addReclaimHistory,
  isAccountProtected,
  updateAccountStatus,
} from '../db/accounts.js'
import {
  closeTokenAccount,
  getOperatorKeypair,
  getTokenAccountData,
} from '../services/solana.js'
import { formatSol, shortenPubkey } from '../utils/helpers.js'
import { logger } from '../utils/logger.js'
import type { DetectionResult, ReclaimOptions, ReclaimResult } from './types.js'

/**
 * Reclaimer for executing rent reclaim transactions
 */
export class RentReclaimer {
  private get treasuryAddress(): PublicKey {
    return getConfig().treasuryAddress
  }

  private get dryRunDefault(): boolean {
    return getConfig().dryRun
  }

  /**
   * Reclaim rent from a single token account
   */
  async reclaimTokenAccount(
    detection: DetectionResult,
    options: ReclaimOptions = {},
  ): Promise<ReclaimResult> {
    const dryRun = options.dryRun ?? this.dryRunDefault
    const accountPubkey = detection.account.pubkey

    // Safety checks
    if (!detection.safe) {
      logger.warn(
        `Account ${shortenPubkey(accountPubkey)} is not safe to reclaim. Reason: ${detection.details}`,
      )
      return {
        accountPubkey,
        amountReclaimed: 0,
        txSignature: '',
        timestamp: new Date(),
        success: false,
        error: 'Account marked as unsafe for automatic reclaim',
      }
    }

    if (isAccountProtected(accountPubkey)) {
      return {
        accountPubkey,
        amountReclaimed: 0,
        txSignature: '',
        timestamp: new Date(),
        success: false,
        error: 'Account is protected',
      }
    }

    // Only token accounts can be closed via this method
    if (
      detection.account.accountType !== 'token_account' &&
      detection.account.accountType !== 'ata'
    ) {
      return {
        accountPubkey,
        amountReclaimed: 0,
        txSignature: '',
        timestamp: new Date(),
        success: false,
        error: `Cannot reclaim non-token account type: ${detection.account.accountType}`,
      }
    }

    // Verify token balance is still 0
    const tokenData = await getTokenAccountData(accountPubkey)
    if (!tokenData) {
      // Account already closed
      updateAccountStatus(accountPubkey, 'reclaimed')
      return {
        accountPubkey,
        amountReclaimed: 0,
        txSignature: '',
        timestamp: new Date(),
        success: true,
        error: 'Account already closed',
      }
    }

    if (tokenData.amount > 0n) {
      return {
        accountPubkey,
        amountReclaimed: 0,
        txSignature: '',
        timestamp: new Date(),
        success: false,
        error: `Token account has non-zero balance: ${tokenData.amount}`,
      }
    }

    // Dry run mode - just log what would happen
    if (dryRun) {
      logger.info(
        `[DRY RUN] Would close ${shortenPubkey(accountPubkey)} and reclaim ${formatSol(tokenData.lamports)} to treasury`,
      )
      return {
        accountPubkey,
        amountReclaimed: tokenData.lamports,
        txSignature: 'DRY_RUN',
        timestamp: new Date(),
        success: true,
      }
    }

    // Execute the close transaction
    try {
      const operator = getOperatorKeypair()

      // Verify operator is the token account owner
      if (!tokenData.owner.equals(operator.publicKey)) {
        return {
          accountPubkey,
          amountReclaimed: 0,
          txSignature: '',
          timestamp: new Date(),
          success: false,
          error: `Operator is not the account owner. Owner: ${tokenData.owner.toBase58()}`,
        }
      }

      const txSignature = await closeTokenAccount(
        accountPubkey,
        this.treasuryAddress,
        operator,
      )

      // Update database
      updateAccountStatus(accountPubkey, 'reclaimed')
      addReclaimHistory(
        accountPubkey,
        tokenData.lamports,
        txSignature,
        detection.reason,
      )

      logger.success(
        `Reclaimed ${formatSol(tokenData.lamports)} from ${shortenPubkey(accountPubkey)}`,
      )

      return {
        accountPubkey,
        amountReclaimed: tokenData.lamports,
        txSignature,
        timestamp: new Date(),
        success: true,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        `Failed to reclaim ${shortenPubkey(accountPubkey)}:`,
        errorMsg,
      )

      return {
        accountPubkey,
        amountReclaimed: 0,
        txSignature: '',
        timestamp: new Date(),
        success: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Batch reclaim from multiple accounts
   */
  async batchReclaim(
    detections: DetectionResult[],
    options: ReclaimOptions = {},
  ): Promise<ReclaimResult[]> {
    const maxAccounts = options.maxAccounts ?? detections.length
    const toProcess = detections.slice(0, maxAccounts)
    const results: ReclaimResult[] = []

    logger.info(`Processing ${toProcess.length} accounts for reclaim...`)
    logger.divider()

    for (let i = 0; i < toProcess.length; i++) {
      const detection = toProcess[i]
      logger.info(
        `[${i + 1}/${toProcess.length}] Processing ${shortenPubkey(detection.account.pubkey)}...`,
      )

      const result = await this.reclaimTokenAccount(detection, options)
      results.push(result)

      // Small delay between transactions to avoid rate limiting
      if (i < toProcess.length - 1 && result.success && !options.dryRun) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    // Summary
    const successful = results.filter((r) => r.success)
    const totalReclaimed = successful.reduce(
      (sum, r) => sum + r.amountReclaimed,
      0,
    )

    logger.divider()
    logger.info(`Reclaim complete:`)
    logger.info(`  - Successful: ${successful.length}/${results.length}`)
    logger.info(`  - Total reclaimed: ${formatSol(totalReclaimed)}`)

    return results
  }

  /**
   * Preview what would be reclaimed (always dry run)
   */
  async previewReclaim(detections: DetectionResult[]): Promise<{
    accounts: { pubkey: string; amount: string; reason: string }[]
    totalLamports: number
    totalSol: string
  }> {
    const accounts = detections
      .filter((d) => d.safe)
      .map((d) => ({
        pubkey: d.account.pubkey.toBase58(),
        amount: formatSol(d.reclaimableLamports),
        reason: d.reason,
      }))

    const totalLamports = detections
      .filter((d) => d.safe)
      .reduce((sum, d) => sum + d.reclaimableLamports, 0)

    return {
      accounts,
      totalLamports,
      totalSol: formatSol(totalLamports),
    }
  }
}

// Export singleton instance
export const reclaimer = new RentReclaimer()
