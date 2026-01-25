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
      // Use standard Solana RPC 'getVersion' as a health check
      const rpcBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getVersion',
        params: [],
      }

      const response = await fetch(config.koraNodeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rpcBody),
      })

      const latency = Date.now() - start

      // If the HTTP request fails (network error), generic catch block handles it.
      // If HTTP status is not OK (e.g. 403, 500, etc), report as error.
      if (!response.ok) {
        return {
          healthy: false,
          version: `HTTP ${response.status}`,
          url: config.koraNodeUrl,
          latency,
          slot: 0,
          error: `HTTP Error ${response.status}: ${response.statusText}`,
        }
      }

      interface JsonRpcResponse {
        result?: { 'solana-core': string; feature_set?: number }
        error?: { message: string }
      }

      const data = (await response.json()) as JsonRpcResponse

      if (data.error) {
        logger.warn(`Kora Node returned RPC error: ${data.error.message}`)
        // Even if method fails, node is reachable. But status is technically "unhealthy" for our purpose?
        // Let's mark it as healthy (online) but with error version info.
        return {
          healthy: true,
          version: 'Active (RPC Error)',
          url: config.koraNodeUrl,
          latency,
          slot: 0,
          error: data.error.message,
        }
      }

      const version = data.result?.['solana-core'] || 'Active'

      return {
        healthy: true,
        version: `v${version}`,
        url: config.koraNodeUrl,
        latency,
        slot: 0,
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
