import { Telegraf } from 'telegraf'
import { detector } from '../core/detector.js'
import { monitor } from '../core/monitor.js'
import { reclaimer } from '../core/reclaimer.js'
import { getAccountStats, getReclaimHistory } from '../db/accounts.js'
import { initDatabase } from '../db/index.js'
import { formatSol, shortenPubkey } from '../utils/helpers.js'
import { logger } from '../utils/logger.js'

let bot: Telegraf | null = null
let authorizedChatId: string | null = null

/**
 * Initialize the Telegram bot
 */
export function initTelegramBot(token: string, chatId?: string): Telegraf {
  if (bot) return bot

  bot = new Telegraf(token)
  authorizedChatId = chatId || null

  // Initialize database
  initDatabase()

  // Middleware to check authorization
  bot.use(async (ctx, next) => {
    if (authorizedChatId && ctx.chat?.id.toString() !== authorizedChatId) {
      await ctx.reply('⛔ Unauthorized. This bot is private.')
      return
    }
    return next()
  })

  // Start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `🧹 *Vacuum - Solana Rent Reclaim Bot*\n\n` +
        `Available commands:\n` +
        `/status - Show rent summary\n` +
        `/scan - Scan for new accounts\n` +
        `/check - Find reclaimable accounts\n` +
        `/reclaim - Reclaim rent (dry-run)\n` +
        `/reclaim\\_execute - Actually reclaim\n` +
        `/history - Show reclaim history\n` +
        `/help - Show this message`,
      { parse_mode: 'Markdown' },
    )
  })

  // Help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🔧 *Commands*\n\n` +
        `/status - Current rent status\n` +
        `/scan - Scan operator token accounts\n` +
        `/check - Check for reclaimable\n` +
        `/reclaim - Preview reclaim (safe)\n` +
        `/reclaim\\_execute - Execute reclaim\n` +
        `/history - Recent reclaims`,
      { parse_mode: 'Markdown' },
    )
  })

  // Status command
  bot.command('status', async (ctx) => {
    try {
      const stats = getAccountStats()
      await ctx.reply(
        `📊 *Rent Status*\n\n` +
          `Total Tracked: ${stats.total}\n` +
          `├ Active: ${stats.active}\n` +
          `├ Reclaimable: ${stats.reclaimable}\n` +
          `├ Reclaimed: ${stats.reclaimed}\n` +
          `└ Protected: ${stats.protected}\n\n` +
          `💰 *Rent*\n` +
          `├ Locked: ${formatSol(stats.totalRentLocked)}\n` +
          `└ Reclaimed: ${formatSol(stats.totalRentReclaimed)}`,
        { parse_mode: 'Markdown' },
      )
    } catch (error) {
      await ctx.reply(`❌ Error: ${error}`)
    }
  })

  // Scan command
  bot.command('scan', async (ctx) => {
    try {
      await ctx.reply('🔍 Scanning for accounts...')
      const accounts = await monitor.scanOperatorAccounts()
      await ctx.reply(
        `✅ Found ${accounts.length} token accounts\n` +
          `Total rent: ${formatSol(accounts.reduce((s, a) => s + a.rentLamports, 0))}`,
      )
    } catch (error) {
      await ctx.reply(`❌ Scan failed: ${error}`)
    }
  })

  // Check command
  bot.command('check', async (ctx) => {
    try {
      await ctx.reply('🔍 Checking for reclaimable accounts...')
      const results = await detector.findSafeReclaimable()

      if (results.length === 0) {
        await ctx.reply('✅ No accounts ready for reclaim.')
        return
      }

      const totalLamports = results.reduce(
        (s, r) => s + r.reclaimableLamports,
        0,
      )
      let message = `💰 *${results.length} accounts reclaimable*\n\n`

      for (const r of results.slice(0, 10)) {
        message += `• ${shortenPubkey(r.account.pubkey)} - ${formatSol(r.reclaimableLamports)}\n`
      }

      if (results.length > 10) {
        message += `\n... and ${results.length - 10} more\n`
      }

      message += `\n*Total: ${formatSol(totalLamports)}*`
      message += `\n\nUse /reclaim to preview or /reclaim\\_execute to reclaim.`

      await ctx.reply(message, { parse_mode: 'Markdown' })
    } catch (error) {
      await ctx.reply(`❌ Check failed: ${error}`)
    }
  })

  // Reclaim dry-run
  bot.command('reclaim', async (ctx) => {
    try {
      await ctx.reply('🔍 Finding reclaimable accounts...')
      const results = await detector.findSafeReclaimable()

      if (results.length === 0) {
        await ctx.reply('✅ Nothing to reclaim.')
        return
      }

      const preview = await reclaimer.previewReclaim(results)
      await ctx.reply(
        `🔍 *DRY RUN Preview*\n\n` +
          `Accounts: ${preview.accounts.length}\n` +
          `Total: ${preview.totalSol}\n\n` +
          `Use /reclaim\\_execute to actually reclaim.`,
        { parse_mode: 'Markdown' },
      )
    } catch (error) {
      await ctx.reply(`❌ Error: ${error}`)
    }
  })

  // Reclaim execute (actual)
  bot.command('reclaim_execute', async (ctx) => {
    try {
      await ctx.reply('⏳ Finding and reclaiming accounts...')
      const results = await detector.findSafeReclaimable()

      if (results.length === 0) {
        await ctx.reply('✅ Nothing to reclaim.')
        return
      }

      const reclaimResults = await reclaimer.batchReclaim(results, {
        dryRun: false,
        maxAccounts: 10,
      })

      const successful = reclaimResults.filter((r) => r.success)
      const totalReclaimed = successful.reduce(
        (s, r) => s + r.amountReclaimed,
        0,
      )

      await ctx.reply(
        `✅ *Reclaim Complete*\n\n` +
          `Successful: ${successful.length}/${reclaimResults.length}\n` +
          `Total Reclaimed: ${formatSol(totalReclaimed)}`,
        { parse_mode: 'Markdown' },
      )
    } catch (error) {
      await ctx.reply(`❌ Reclaim failed: ${error}`)
    }
  })

  // History command
  bot.command('history', async (ctx) => {
    try {
      const history = getReclaimHistory(5)

      if (history.length === 0) {
        await ctx.reply('📜 No reclaim history yet.')
        return
      }

      let message = '📜 *Recent Reclaims*\n\n'
      for (const h of history) {
        message += `• ${formatSol(h.amount_reclaimed)} - ${h.reason}\n`
        message += `  ${h.reclaimed_at.slice(0, 16)}\n\n`
      }

      await ctx.reply(message, { parse_mode: 'Markdown' })
    } catch (error) {
      await ctx.reply(`❌ Error: ${error}`)
    }
  })

  logger.info('Telegram bot initialized')
  return bot
}

/**
 * Send a notification message
 */
export async function sendNotification(message: string): Promise<void> {
  if (!bot || !authorizedChatId) {
    logger.warn('Telegram bot not configured, skipping notification')
    return
  }

  try {
    await bot.telegram.sendMessage(authorizedChatId, message, {
      parse_mode: 'Markdown',
    })
  } catch (error) {
    logger.error('Failed to send Telegram notification:', error)
  }
}

/**
 * Send reclaim alert
 */
export async function sendReclaimAlert(
  amount: number,
  accounts: number,
  txSignatures: string[],
): Promise<void> {
  const message =
    `✅ *Rent Reclaimed*\n\n` +
    `Amount: ${formatSol(amount)}\n` +
    `Accounts: ${accounts}\n\n` +
    `Transactions:\n` +
    txSignatures
      .slice(0, 3)
      .map((tx) => `• ${shortenPubkey(tx)}`)
      .join('\n')

  await sendNotification(message)
}

/**
 * Start the Telegram bot (polling mode)
 */
export async function startBot(token: string, chatId?: string): Promise<void> {
  const telegramBot = initTelegramBot(token, chatId)

  logger.info('Starting Telegram bot...')
  await telegramBot.launch()

  // Graceful shutdown
  process.once('SIGINT', () => telegramBot.stop('SIGINT'))
  process.once('SIGTERM', () => telegramBot.stop('SIGTERM'))
}

export { bot }
