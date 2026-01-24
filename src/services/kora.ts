import { getConfig } from '../config.js'
import { logger } from '../utils/logger.js'

export interface KoraNodeStatus {
  healthy: boolean
  version: string
  url: string
  latency: number
  slot: number
  error?: string
}

/**
 * Service to interact with Kora/Solana Node
 */
export class KoraService {
  /**
   * Check the health and status of the configured Kora Node
   * Performs a basic availability check since custom Kora nodes may not expose standard RPC methods.
   */
  async getNodeStatus(): Promise<KoraNodeStatus> {
    const config = getConfig()

    if (!config.koraNodeUrl) {
      return {
        healthy: false,
        version: 'N/A',
        url: 'Not Configured',
        latency: 0,
        slot: 0,
        error: 'KORA_NODE_URL not set in .env',
      }
    }

    const start = Date.now()
    try {
      // Fetch Kora server configuration using official JSON-RPC method
      const rpcBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getConfig',
        params: {},
      }

      const response = await fetch(config.koraNodeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rpcBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      interface JsonRpcResponse {
        result?: { version?: string; slot?: number }
        error?: { message: string }
      }

      const data = (await response.json()) as JsonRpcResponse

      if (data.error) {
        throw new Error(
          `Kora RPC Error: ${data.error.message || 'Unknown error'}`,
        )
      }

      const latency = Date.now() - start
      const result = data.result || {}

      // Kora's getConfig returns configuration details.
      // We can use this to confirm it's a valid Kora node.
      return {
        healthy: true,
        version: result.version || 'Active', // Fallback if version isn't explicit in config
        url: config.koraNodeUrl,
        latency,
        slot: result.slot || 0, // Some Kora configs might include sync status
      }
    } catch (error) {
      logger.error('Failed to connect to Kora Node:', error)
      return {
        healthy: false,
        version: 'Unreachable',
        url: config.koraNodeUrl,
        latency: Date.now() - start,
        slot: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

// Export singleton
export const koraService = new KoraService()
