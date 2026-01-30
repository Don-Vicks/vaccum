import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { useCallback, useState } from 'react'
import { type ScannedAccount } from '../types'

export const useScanAccounts = (
  connection: Connection,
  publicKey: PublicKey | null,
) => {
  const [accounts, setAccounts] = useState<ScannedAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async () => {
    if (!publicKey) return

    setLoading(true)
    setError(null)
    setAccounts([])

    try {
      console.log('Scanning accounts for:', publicKey.toBase58())

      // Fetch all token accounts by owner
      const response = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: TOKEN_PROGRAM_ID,
        },
      )

      const scanned: ScannedAccount[] = []

      for (const { pubkey, account } of response.value) {
        const parsed = account.data.parsed
        if (!parsed || parsed.type !== 'account') continue

        const info = parsed.info
        const amount = BigInt(info.tokenAmount.amount)
        const lamports = account.lamports // Note: getParsedTokenAccountsByOwner returns this directly in the account object structure

        // Filter logic: We want 0 balance accounts
        const isReclaimable = amount === 0n

        scanned.push({
          pubkey,
          accountType: 'token_account', // Simplified for now
          mint: new PublicKey(info.mint),
          owner: new PublicKey(info.owner),
          amount,
          lamports,
          status: isReclaimable ? 'reclaimable' : 'active',
        })
      }

      // sort reclaimable first
      scanned.sort((a, _b) => (a.status === 'reclaimable' ? -1 : 1))

      setAccounts(scanned)
    } catch (err) {
      console.error('Scan failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error during scan')
    } finally {
      setLoading(false)
    }
  }, [connection, publicKey])

  const totalReclaimable = accounts
    .filter((a) => a.status === 'reclaimable')
    .reduce((sum, a) => sum + a.lamports, 0)

  return { accounts, loading, error, totalReclaimable, scan }
}
