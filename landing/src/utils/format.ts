export const LAMPORTS_PER_SOL = 1_000_000_000

export function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4) + ' SOL'
}

export function shortenPubkey(pubkey: string, chars = 4): string {
  return `${pubkey.slice(0, chars)}...${pubkey.slice(-chars)}`
}
