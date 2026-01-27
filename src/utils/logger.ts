import chalk from 'chalk'

export type LogLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'success'
  | 'silent'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  success: 1,
  silent: 99,
}

let currentLogLevel: LogLevel = 'info'

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]
}

function formatTimestamp(): string {
  return new Date().toISOString().slice(11, 19)
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.log(
        chalk.gray(`[${formatTimestamp()}] [DEBUG]`),
        message,
        ...args,
      )
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.log(chalk.blue(`[${formatTimestamp()}] [INFO]`), message, ...args)
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.log(
        chalk.yellow(`[${formatTimestamp()}] [WARN]`),
        message,
        ...args,
      )
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(
        chalk.red(`[${formatTimestamp()}] [ERROR]`),
        message,
        ...args,
      )
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (shouldLog('success')) {
      console.log(
        chalk.green(`[${formatTimestamp()}] [SUCCESS]`),
        message,
        ...args,
      )
    }
  },

  // Special formatting for tables and reports
  table(data: Record<string, unknown>[]): void {
    console.table(data)
  },

  // Box for important messages
  box(title: string, content: string): void {
    const width =
      Math.max(title.length, ...content.split('\n').map((l) => l.length)) + 4
    const border = '─'.repeat(width)

    console.log(chalk.cyan(`┌${border}┐`))
    console.log(chalk.cyan(`│ ${chalk.bold(title.padEnd(width - 2))} │`))
    console.log(chalk.cyan(`├${border}┤`))
    for (const line of content.split('\n')) {
      console.log(chalk.cyan(`│ ${line.padEnd(width - 2)} │`))
    }
    console.log(chalk.cyan(`└${border}┘`))
  },

  // Divider
  divider(): void {
    console.log(chalk.gray('─'.repeat(50)))
  },

  // Empty line
  newline(): void {
    console.log()
  },
}
