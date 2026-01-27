import { Keypair, PublicKey } from '@solana/web3.js'
import { setConfig } from './config.js'
import { detector } from './core/detector.js'
import { monitor } from './core/monitor.js'
import { reclaimer } from './core/reclaimer.js'
import type {
  DetectionResult,
  ReclaimOptions,
  ReclaimResult,
  TrackedAccount,
} from './core/types.js'
import { initDatabase } from './db/index.js'
import { setLogLevel } from './utils/logger.js'

export interface VacuumConfig {
  rpcUrl?: string
  treasury: string
  keypairPath?: string
  keypair?: Keypair
  dryRun?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  dbPath?: string
}

export class VacuumClient {
  constructor(config: VacuumConfig) {
    // initialize logging
    setLogLevel(config.logLevel || 'info')

    // Prepare internal config object
    const internalConfig: any = {}

    if (config.rpcUrl) internalConfig.rpcUrl = config.rpcUrl
    if (config.treasury)
      internalConfig.treasuryAddress = new PublicKey(config.treasury)
    if (config.keypairPath)
      internalConfig.operatorKeypairPath = config.keypairPath
    if (config.dryRun !== undefined) internalConfig.dryRun = config.dryRun
    if (config.dbPath) internalConfig.dbPath = config.dbPath

    // Update global config singleton
    setConfig(internalConfig)

    // Initialize DB if not already done
    initDatabase()
  }

  /**
   * Scan for accounts owned by the configured operator
   */
  async scan(): Promise<TrackedAccount[]> {
    // Scan operator accounts
    return monitor.scanOperatorAccounts()
  }

  /**
   * Check which tracked accounts are reclaimable
   * If accounts list is provided, checks those specific accounts.
   * Otherwise checks all tracked accounts in DB.
   */
  async check(accounts?: TrackedAccount[]): Promise<DetectionResult[]> {
    if (accounts) {
      const results: DetectionResult[] = []
      for (const account of accounts) {
        const result = await detector.checkAccount(account.pubkey)
        if (result) results.push(result)
      }
      return results
    }
    return detector.findAllReclaimable()
  }

  /**
   * Execute reclaim on reclaimable accounts
   */
  async reclaim(
    reclaimables: DetectionResult[],
    options?: ReclaimOptions,
  ): Promise<ReclaimResult[]> {
    return reclaimer.batchReclaim(reclaimables, options)
  }

  /**
   * Get summary report
   */
  async getReport() {
    return detector.getReclaimableSummary()
  }
}
