import type { RentReport } from '../core/types.js'
import { getAccountStats, getReclaimHistory } from '../db/accounts.js'
import { formatDate, formatSol, lamportsToSol } from '../utils/helpers.js'
import { logger } from '../utils/logger.js'

/**
 * Generate comprehensive rent reports
 */
export class Reporter {
  /**
   * Generate a full rent report
   */
  async generateReport(): Promise<RentReport> {
    const stats = getAccountStats()

    return {
      totalTrackedAccounts: stats.total,
      activeAccounts: stats.active,
      reclaimableAccounts: stats.reclaimable,
      reclaimedAccounts: stats.reclaimed,
      protectedAccounts: stats.protected,
      totalRentLockedLamports: stats.totalRentLocked,
      totalRentReclaimedLamports: stats.totalRentReclaimed,
      reclaimableNowLamports: 0, // Will be calculated by detector
      accountsByType: {
        token_account: 0,
        ata: 0,
        pda: 0,
        unknown: 0,
      },
      generatedAt: new Date(),
    }
  }

  /**
   * Print a summary report to console
   */
  printSummary(): void {
    const stats = getAccountStats()

    logger.newline()
    logger.box(
      '📊 Rent Reclaim Summary',
      `Total Accounts Tracked: ${stats.total}
├─ Active:      ${stats.active}
├─ Reclaimable: ${stats.reclaimable}
├─ Reclaimed:   ${stats.reclaimed}
└─ Protected:   ${stats.protected}

💰 Rent Status
├─ Locked:    ${formatSol(stats.totalRentLocked)}
└─ Reclaimed: ${formatSol(stats.totalRentReclaimed)}`,
    )
    logger.newline()
  }

  /**
   * Print recent reclaim history
   */
  printHistory(limit = 10): void {
    const history = getReclaimHistory(limit)

    if (history.length === 0) {
      logger.info('No reclaim history yet.')
      return
    }

    logger.newline()
    logger.info('📜 Recent Reclaim History:')
    logger.divider()

    const tableData = history.map((entry) => ({
      Account: entry.account_pubkey.slice(0, 8) + '...',
      Amount: formatSol(entry.amount_reclaimed),
      Reason: entry.reason,
      Date: formatDate(new Date(entry.reclaimed_at)),
      TX: entry.tx_signature.slice(0, 8) + '...',
    }))

    logger.table(tableData)
    logger.newline()
  }

  /**
   * Export report as JSON
   */
  async exportJson(): Promise<string> {
    const report = await this.generateReport()
    const history = getReclaimHistory()

    return JSON.stringify(
      {
        report: {
          ...report,
          totalRentLockedSol: lamportsToSol(report.totalRentLockedLamports),
          totalRentReclaimedSol: lamportsToSol(
            report.totalRentReclaimedLamports,
          ),
        },
        history: history.map((h) => ({
          ...h,
          amount_sol: lamportsToSol(h.amount_reclaimed),
        })),
      },
      null,
      2,
    )
  }

  /**
   * Print alert-style message for significant findings
   */
  printAlert(type: 'warning' | 'success' | 'info', message: string): void {
    const icons = {
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️',
    }

    const colors = {
      warning: logger.warn,
      success: logger.success,
      info: logger.info,
    }

    colors[type](`${icons[type]} ${message}`)
  }
}

// Export singleton instance
export const reporter = new Reporter()
