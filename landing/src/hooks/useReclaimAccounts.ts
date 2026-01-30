import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, Transaction } from '@solana/web3.js'
import { useCallback, useState } from 'react'
import { type ScannedAccount } from '../types'

export const useReclaimAccounts = (connection: Connection) => {
  const { publicKey, sendTransaction } = useWallet()
  const [reclaiming, setReclaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState(0)

  const reclaim = useCallback(
    async (accounts: ScannedAccount[]) => {
      if (!publicKey) return

      setReclaiming(true)
      setError(null)
      setSuccessCount(0)

      try {
        // Solana transaction size limit is ~1232 bytes.
        // Each close instruction is small, but safer to batch conservatively.
        // 10-15 instructions per tx is usually safe.
        const BATCH_SIZE = 12
        const chunks = []

        for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
          chunks.push(accounts.slice(i, i + BATCH_SIZE))
        }

        console.log(
          `Processing ${accounts.length} accounts in ${chunks.length} batches`,
        )

        let reclaimed = 0

        for (const chunk of chunks) {
          const transaction = new Transaction()

          for (const account of chunk) {
            // Create close instruction
            // Token Account -> Destination (Wallet) -> Owner (Wallet)
            const ix = createCloseAccountInstruction(
              account.pubkey,
              publicKey, // Destination for rent
              publicKey, // Owner authority
              [],
              TOKEN_PROGRAM_ID,
            )
            transaction.add(ix)
          }

          // Send transaction
          // Note: wallet adapter handles signing
          try {
            const signature = await sendTransaction(transaction, connection)
            console.log('Batch sent:', signature)

            // Ideally wait for confirmation to be sure, but for UX speed we might just fire off
            await connection.confirmTransaction(signature, 'confirmed')
            reclaimed += chunk.length
            setSuccessCount(reclaimed)
          } catch (err) {
            console.error('Batch failed:', err)
            throw err // Stop on error or continue? customized based on needs
          }
        }
      } catch (err) {
        console.error('Reclaim failed:', err)
        setError(
          err instanceof Error ? err.message : 'Unknown error during reclaim',
        )
      } finally {
        setReclaiming(false)
      }
    },
    [connection, publicKey, sendTransaction],
  )

  return { reclaim, reclaiming, error, successCount }
}
