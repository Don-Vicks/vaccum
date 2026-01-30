import { PublicKey } from '@solana/web3.js'

export type AccountType = 'token_account' | 'ata' | 'pda' | 'unknown'

export interface ScannedAccount {
  pubkey: PublicKey
  accountType: AccountType
  mint: PublicKey
  owner: PublicKey
  amount: bigint
  lamports: number
  status: 'active' | 'reclaimable'
  details?: string
}

export interface ScanResult {
  accounts: ScannedAccount[]
  totalReclaimable: number
  loading: boolean
  error: string | null
  scan: () => Promise<void>
}
