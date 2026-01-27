#!/usr/bin/env node

import { PublicKey } from '@solana/web3.js'
import chalk from 'chalk'
import { Command } from 'commander'
import { config as loadEnv } from 'dotenv'
import ora from 'ora'

// Load environment variables
loadEnv()

// Import modules
import { getConfig } from './config.js'
import { detector } from './core/detector.js'
import { monitor } from './core/monitor.js'
import { reclaimer } from './core/reclaimer.js'
import {
  addProtectedAccount,
  getAllTrackedAccounts,
  getProtectedAccounts,
  removeProtectedAccount,
} from './db/accounts.js'
import { closeDatabase, initDatabase } from './db/index.js'
import { reporter } from './services/reporter.js'
import { formatSol, isValidPubkey, shortenPubkey } from './utils/helpers.js'
import { logger, setLogLevel } from './utils/logger.js'

const program = new Command()

program
  .name('vacuum')
  .description('🧹 Vacuum - Suck up forgotten rent from Solana accounts')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().verbose) {
      setLogLevel('debug')
    }
    // Initialize database before any command
    initDatabase()
  })

// ==================== SCAN COMMAND ====================
program
  .command('scan')
  .description('Scan for sponsored accounts to track')
  .option('--operator', 'Scan all token accounts owned by operator')
  .option('--tx <signatures...>', 'Scan specific transaction signatures')
  .action(async (options) => {
    const spinner = ora('Scanning for accounts...').start()

    try {
      let accounts

      if (options.tx) {
        accounts = await monitor.scanFromSignatures(options.tx)
      } else {
        // Default: scan operator's token accounts
        accounts = await monitor.scanOperatorAccounts()
      }

      spinner.succeed(`Found ${accounts.length} accounts`)

      if (accounts.length > 0) {
        const stats = await monitor.getStats()
        logger.info(`\nTotal tracked: ${stats.totalTracked}`)
        logger.info(`Total rent locked: ${formatSol(stats.totalRentLocked)}`)
      }
    } catch (error) {
      spinner.fail('Scan failed')
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== CHECK COMMAND ====================
program
  .command('check')
  .description('Check for reclaimable accounts')
  .option('-a, --address <pubkey>', 'Check a specific account')
  .option('--all', 'Check all tracked accounts')
  .action(async (options) => {
    const spinner = ora('Checking accounts...').start()

    try {
      if (options.address) {
        if (!isValidPubkey(options.address)) {
          spinner.fail('Invalid public key')
          process.exit(1)
        }

        const pubkey = new PublicKey(options.address)
        const result = await detector.checkAccount(pubkey)

        spinner.stop()

        if (result) {
          logger.success(`Account ${shortenPubkey(pubkey)} is reclaimable!`)
          logger.info(`  Reason: ${result.reason}`)
          logger.info(`  Amount: ${formatSol(result.reclaimableLamports)}`)
          logger.info(
            `  Safe: ${result.safe ? 'Yes' : 'No - Manual review needed'}`,
          )
          logger.info(`  Details: ${result.details}`)
        } else {
          logger.info(`Account ${shortenPubkey(pubkey)} is not reclaimable.`)
        }
      } else {
        // Check all accounts
        const results = await detector.findAllReclaimable()
        spinner.succeed(`Found ${results.length} reclaimable accounts`)

        if (results.length > 0) {
          const summary = await detector.getReclaimableSummary()
          logger.newline()
          logger.info(`📊 Reclaimable Summary:`)
          logger.info(`  - Safe to reclaim: ${summary.safeToReclaim} accounts`)
          logger.info(`  - Needs review: ${summary.unsafeNeedsReview} accounts`)
          logger.info(
            `  - Total reclaimable: ${formatSol(summary.totalReclaimableLamports)}`,
          )
          logger.info(
            `  - Safe reclaimable: ${formatSol(summary.safeReclaimableLamports)}`,
          )

          logger.newline()
          logger.info('Reclaimable accounts:')
          logger.divider()

          for (const result of results) {
            const safeTag = result.safe
              ? chalk.green('[SAFE]')
              : chalk.yellow('[REVIEW]')
            logger.info(
              `${safeTag} ${result.account.pubkey.toBase58().slice(0, 20)}... | ` +
                `${formatSol(result.reclaimableLamports)} | ${result.reason}`,
            )
          }
        }
      }
    } catch (error) {
      spinner.fail('Check failed')
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== RECLAIM COMMAND ====================
program
  .command('reclaim')
  .description('Reclaim rent from eligible accounts')
  .option('-n, --dry-run', 'Preview reclaim without executing')
  .option('-m, --max <number>', 'Maximum accounts to reclaim', '10')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    const dryRun = options.dryRun !== undefined ? true : getConfig().dryRun
    const maxAccounts = parseInt(options.max, 10)

    const spinner = ora('Finding reclaimable accounts...').start()

    try {
      // Find safe reclaimable accounts
      const results = await detector.findSafeReclaimable()
      spinner.stop()

      if (results.length === 0) {
        logger.info('No accounts ready for reclaim.')
        return
      }

      const toReclaim = results.slice(0, maxAccounts)
      const preview = await reclaimer.previewReclaim(toReclaim)

      logger.newline()
      logger.info(
        `${dryRun ? '🔍 DRY RUN - ' : ''}Will reclaim from ${toReclaim.length} accounts:`,
      )
      logger.divider()

      for (const account of preview.accounts) {
        logger.info(
          `  ${account.pubkey.slice(0, 16)}... | ${account.amount} | ${account.reason}`,
        )
      }

      logger.divider()
      logger.info(`Total to reclaim: ${preview.totalSol}`)
      logger.newline()

      if (!options.yes && !dryRun) {
        // In a real CLI, we'd prompt for confirmation here
        logger.warn('Use --yes to skip confirmation, or --dry-run to preview')
        return
      }

      // Execute reclaim
      const reclaimResults = await reclaimer.batchReclaim(toReclaim, {
        dryRun,
        maxAccounts,
      })

      const successful = reclaimResults.filter((r) => r.success)
      const totalReclaimed = successful.reduce(
        (sum, r) => sum + r.amountReclaimed,
        0,
      )

      logger.newline()
      if (dryRun) {
        logger.success(
          `[DRY RUN] Would reclaim ${formatSol(totalReclaimed)} from ${successful.length} accounts`,
        )
      } else {
        logger.success(
          `Reclaimed ${formatSol(totalReclaimed)} from ${successful.length} accounts`,
        )
      }
    } catch (error) {
      spinner.fail('Reclaim failed')
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== REPORT COMMAND ====================
program
  .command('report')
  .description('Generate rent status report')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('--history', 'Show reclaim history')
  .action(async (options) => {
    try {
      if (options.format === 'json') {
        const json = await reporter.exportJson()
        console.log(json)
      } else {
        reporter.printSummary()
      }

      if (options.history) {
        reporter.printHistory()
      }
    } catch (error) {
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== PROTECT COMMAND ====================
program
  .command('protect')
  .description('Manage protected accounts (whitelist)')
  .option('-a, --add <pubkey>', 'Add account to protection list')
  .option('-r, --remove <pubkey>', 'Remove account from protection list')
  .option('-l, --list', 'List all protected accounts')
  .option('--reason <reason>', 'Reason for protection', 'Manual protection')
  .action(async (options) => {
    try {
      if (options.add) {
        if (!isValidPubkey(options.add)) {
          logger.error('Invalid public key')
          process.exit(1)
        }
        addProtectedAccount(new PublicKey(options.add), options.reason)
        logger.success(`Protected: ${options.add}`)
      } else if (options.remove) {
        if (!isValidPubkey(options.remove)) {
          logger.error('Invalid public key')
          process.exit(1)
        }
        removeProtectedAccount(new PublicKey(options.remove))
        logger.success(`Removed protection: ${options.remove}`)
      } else if (options.list) {
        const protected_ = getProtectedAccounts()
        if (protected_.length === 0) {
          logger.info('No protected accounts.')
        } else {
          logger.info(`\n🛡️ Protected Accounts (${protected_.length}):`)
          logger.divider()
          for (const entry of protected_) {
            logger.info(`  ${entry.pubkey.toBase58()} | ${entry.reason}`)
          }
        }
      } else {
        logger.info('Use --add, --remove, or --list')
      }
    } catch (error) {
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== CONFIG COMMAND ====================
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      const config = getConfig()
      logger.newline()
      logger.info('⚙️ Current Configuration:')
      logger.divider()
      logger.info(`  RPC URL:        ${config.rpcUrl}`)
      logger.info(`  Treasury:       ${config.treasuryAddress.toBase58()}`)
      logger.info(`  Keypair Path:   ${config.operatorKeypairPath}`)
      logger.info(`  Dry Run:        ${config.dryRun}`)
      logger.info(`  Cooldown:       ${config.cooldownHours} hours`)
      logger.info(`  Min Inactive:   ${config.minInactiveDays} days`)
      logger.info(`  Database:       ${config.dbPath}`)
      logger.divider()
    } catch (error) {
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== TRACK COMMAND ====================
program
  .command('track <pubkey>')
  .description('Manually track a specific account')
  .option('--tx <signature>', 'Sponsor transaction signature')
  .action(async (pubkey, options) => {
    try {
      if (!isValidPubkey(pubkey)) {
        logger.error('Invalid public key')
        process.exit(1)
      }

      const account = await monitor.trackAccount(
        new PublicKey(pubkey),
        options.tx,
      )

      if (account) {
        logger.success(`Now tracking: ${pubkey}`)
        logger.info(`  Type: ${account.accountType}`)
        logger.info(`  Rent: ${formatSol(account.rentLamports)}`)
      }
    } catch (error) {
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== LIST COMMAND ====================
program
  .command('list')
  .description('List all tracked accounts')
  .option(
    '--status <status>',
    'Filter by status (active, reclaimable, reclaimed, protected)',
  )
  .action((options) => {
    try {
      const accounts = getAllTrackedAccounts()

      const filtered = options.status
        ? accounts.filter((a) => a.status === options.status)
        : accounts

      if (filtered.length === 0) {
        logger.info('No accounts found.')
        return
      }

      logger.newline()
      logger.info(`📋 Tracked Accounts (${filtered.length}):`)
      logger.divider()

      for (const account of filtered) {
        const statusColors: Record<string, (s: string) => string> = {
          active: chalk.blue,
          reclaimable: chalk.yellow,
          reclaimed: chalk.green,
          protected: chalk.magenta,
        }
        const colorFn = statusColors[account.status] || chalk.white

        logger.info(
          `${colorFn(`[${account.status.toUpperCase().padEnd(11)}]`)} ` +
            `${account.pubkey.toBase58().slice(0, 24)}... | ` +
            `${formatSol(account.rentLamports).padEnd(12)} | ` +
            `${account.accountType}`,
        )
      }

      logger.newline()
    } catch (error) {
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== OPERATOR COMMAND ====================
program
  .command('operator')
  .description('Manage multiple operator accounts')
  .argument('<action>', 'Action: add, list, use, remove')
  .argument('[name]', 'Operator name')
  .option('--keypair <path>', 'Path to keypair file')
  .option('--treasury <address>', 'Treasury address')
  .option('--default', 'Set as default operator')
  .action(async (action, name, options) => {
    try {
      const {
        getAllOperators,
        addOperator,
        getOperatorByName,
        setDefaultOperator,
        removeOperator,
      } = await import('./db/operators.js')

      if (action === 'list') {
        const operators = getAllOperators()
        if (operators.length === 0) {
          logger.info('No operators configured.')
          logger.info(
            'Add an operator with: vacuum operator add <name> --keypair <path> --treasury <address>',
          )
          return
        }

        logger.newline()
        logger.info(`👥 Operators (${operators.length}):`)
        logger.divider()
        for (const op of operators) {
          const defaultTag = op.is_default ? chalk.green(' [DEFAULT]') : ''
          logger.info(`  ${op.name}${defaultTag}`)
          logger.info(`    ID: ${op.id}`)
          logger.info(`    Treasury: ${op.treasury_address.toBase58()}`)
          logger.info(`    Keypair: ${op.keypair_path}`)
          logger.info('')
        }
      } else if (action === 'add') {
        if (!name) {
          logger.error('Operator name required')
          process.exit(1)
        }
        if (!options.keypair || !options.treasury) {
          logger.error('Both --keypair and --treasury are required')
          process.exit(1)
        }

        addOperator(
          name,
          options.keypair,
          new PublicKey(options.treasury),
          options.default,
        )
        logger.success(`Added operator: ${name}`)
      } else if (action === 'use') {
        if (!name) {
          logger.error('Operator name required')
          process.exit(1)
        }

        const op = getOperatorByName(name)
        if (!op) {
          logger.error(`Operator not found: ${name}`)
          process.exit(1)
        }

        setDefaultOperator(op.id)
      } else if (action === 'remove') {
        if (!name) {
          logger.error('Operator name required')
          process.exit(1)
        }

        const op = getOperatorByName(name)
        if (!op) {
          logger.error(`Operator not found: ${name}`)
          process.exit(1)
        }

        removeOperator(op.id)
      } else {
        logger.error(`Unknown action: ${action}`)
        logger.info('Available actions: add, list, use, remove')
        process.exit(1)
      }
    } catch (error) {
      logger.error(String(error))
      process.exit(1)
    }
  })

// ==================== DASHBOARD COMMAND ====================
program
  .command('dashboard')
  .description('Start the web dashboard server')
  .option('-p, --port <port>', 'Port to run on', '3333')
  .action(async (options) => {
    try {
      process.env.DASHBOARD_PORT = options.port
      const { startDashboardServer } = await import('./server/index.js')
      startDashboardServer()
    } catch (error) {
      logger.error('Failed to start dashboard:', String(error))
      process.exit(1)
    }
  })

// ==================== BOT COMMAND ====================
program
  .command('bot')
  .description('Start the Telegram bot for remote control')
  .option(
    '-t, --token <token>',
    'Telegram bot token (or set TELEGRAM_BOT_TOKEN env)',
  )
  .option(
    '-c, --chat <chatId>',
    'Authorized chat ID (or set TELEGRAM_CHAT_ID env)',
  )
  .action(async (options) => {
    const token = options.token || process.env.TELEGRAM_BOT_TOKEN
    const chatId = options.chat || process.env.TELEGRAM_CHAT_ID

    if (!token) {
      logger.error('Telegram bot token required.')
      logger.info('Set TELEGRAM_BOT_TOKEN env or use --token')
      logger.info('')
      logger.info('To create a bot:')
      logger.info('  1. Message @BotFather on Telegram')
      logger.info('  2. Send /newbot and follow prompts')
      logger.info('  3. Copy the token')
      process.exit(1)
    }

    try {
      const { startBot } = await import('./services/telegram.js')
      logger.info('🤖 Starting Telegram bot...')
      if (chatId) {
        logger.info(`Authorized chat: ${chatId}`)
      } else {
        logger.warn('No chat ID set - bot will respond to anyone!')
      }
      await startBot(token, chatId)
    } catch (error) {
      logger.error('Failed to start Telegram bot:', String(error))
      process.exit(1)
    }
  })

// Handle cleanup on exit
process.on('exit', () => {
  closeDatabase()
})

process.on('SIGINT', () => {
  closeDatabase()
  process.exit(0)
})

// Parse and run
program.parse()
