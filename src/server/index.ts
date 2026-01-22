import cors from 'cors'
import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  getAccountStats,
  getAllTrackedAccounts,
  getReclaimHistory,
} from '../db/accounts.js'
import { initDatabase } from '../db/index.js'
import { getAllOperators } from '../db/operators.js'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.DASHBOARD_PORT || 3333

// Middleware
app.use(cors())
app.use(express.json())

// Serve static dashboard files
const dashboardPath = path.join(__dirname, '../../dashboard')
app.use(express.static(dashboardPath))

// Initialize database
initDatabase()

// API Routes

/**
 * GET /api/stats - Get overall statistics
 */
app.get('/api/stats', (req: Request, res: Response) => {
  try {
    const stats = getAccountStats()
    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error('Error fetching stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    })
  }
})

/**
 * GET /api/accounts - Get all tracked accounts
 */
app.get('/api/accounts', (req: Request, res: Response) => {
  try {
    const operatorId = req.query.operator_id
      ? parseInt(req.query.operator_id as string)
      : undefined
    const accounts = getAllTrackedAccounts(operatorId)

    res.json({
      success: true,
      data: accounts.map((acc) => ({
        ...acc,
        pubkey: acc.pubkey.toBase58(),
      })),
    })
  } catch (error) {
    logger.error('Error fetching accounts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts',
    })
  }
})

/**
 * GET /api/history - Get reclaim history
 */
app.get('/api/history', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
    const history = getReclaimHistory(limit)

    res.json({
      success: true,
      data: history,
    })
  } catch (error) {
    logger.error('Error fetching history:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history',
    })
  }
})

/**
 * GET /api/operators - Get all operators
 */
app.get('/api/operators', (req: Request, res: Response) => {
  try {
    const operators = getAllOperators()

    res.json({
      success: true,
      data: operators.map((op) => ({
        ...op,
        treasury_address: op.treasury_address.toBase58(),
      })),
    })
  } catch (error) {
    logger.error('Error fetching operators:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch operators',
    })
  }
})

/**
 * Start the server
 */
export function startDashboardServer(): void {
  app.listen(PORT, () => {
    logger.success(`Dashboard server running at http://localhost:${PORT}`)
    logger.info(`API available at http://localhost:${PORT}/api/*`)
  })
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startDashboardServer()
}
