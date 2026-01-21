/**
 * Devnet Simulation Script
 *
 * Creates test token accounts to simulate Kora-sponsored accounts for testing.
 */

import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMint,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { config as loadEnv } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

loadEnv()

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

async function loadKeypair(keypairPath: string): Promise<Keypair> {
  const resolvedPath = path.resolve(keypairPath)

  if (!existsSync(resolvedPath)) {
    throw new Error(`Keypair not found at: ${resolvedPath}`)
  }

  const keypairData = JSON.parse(readFileSync(resolvedPath, 'utf-8'))
  return Keypair.fromSecretKey(Uint8Array.from(keypairData))
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  const connection = new Connection(RPC_URL, 'confirmed')
  console.log(`Connected to: ${RPC_URL}`)

  const keypairPath =
    process.env.OPERATOR_KEYPAIR_PATH || './operator-keypair.json'
  let operator: Keypair

  try {
    operator = await loadKeypair(keypairPath)
    console.log(`Operator: ${operator.publicKey.toBase58()}`)
  } catch (error) {
    console.error('Failed to load operator keypair:', error)
    console.log('\nTo create a keypair:')
    console.log('  solana-keygen new -o operator-keypair.json')
    process.exit(1)
  }

  // Check balance
  const balance = await connection.getBalance(operator.publicKey)
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`)

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log('\n⚠️ Low balance! Request airdrop:')
    console.log(
      `  solana airdrop 2 ${operator.publicKey.toBase58()} --url devnet`,
    )
  }

  switch (command) {
    case 'create':
      await createTestAccounts(connection, operator)
      break

    case 'list':
      await listTokenAccounts(connection, operator.publicKey)
      break

    case 'airdrop':
      await requestAirdrop(connection, operator.publicKey)
      break

    case 'help':
    default:
      console.log(`
Kora Rent Reclaim - Devnet Simulation Script

Usage:
  npx tsx scripts/simulate.ts <command>

Commands:
  create    Create test token accounts (simulates Kora sponsorship)
  list      List all token accounts owned by operator
  airdrop   Request devnet SOL airdrop
  help      Show this help message

Environment Variables:
  SOLANA_RPC_URL         RPC endpoint (default: devnet)
  OPERATOR_KEYPAIR_PATH  Path to operator keypair
      `)
  }
}

async function createTestAccounts(connection: Connection, operator: Keypair) {
  console.log('\n🔨 Creating test token accounts...\n')

  // Create a test mint
  console.log('Creating test mint...')
  const mint = await createMint(
    connection,
    operator,
    operator.publicKey,
    null,
    9,
  )
  console.log(`Mint created: ${mint.toBase58()}`)

  // Create several ATAs (simulating Kora-sponsored accounts)
  const testWallets = [
    Keypair.generate(),
    Keypair.generate(),
    Keypair.generate(),
  ]

  for (let i = 0; i < testWallets.length; i++) {
    const wallet = testWallets[i]

    // Create ATA for the test wallet
    const ata = await getAssociatedTokenAddress(mint, wallet.publicKey)

    const createAtaIx = createAssociatedTokenAccountInstruction(
      operator.publicKey, // payer (Kora would be this)
      ata,
      wallet.publicKey,
      mint,
    )

    const tx = new Transaction().add(createAtaIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [operator])

    console.log(`✅ Created ATA ${i + 1}: ${ata.toBase58()}`)
    console.log(`   Owner: ${wallet.publicKey.toBase58()}`)
    console.log(`   TX: ${sig}`)
  }

  // Create some ATAs owned by operator (these can be reclaimed)
  console.log('\nCreating operator-owned ATAs (reclaimable)...')

  for (let i = 0; i < 3; i++) {
    const newMint = await createMint(
      connection,
      operator,
      operator.publicKey,
      null,
      9,
    )

    const ata = await getAssociatedTokenAddress(newMint, operator.publicKey)

    const createAtaIx = createAssociatedTokenAccountInstruction(
      operator.publicKey,
      ata,
      operator.publicKey,
      newMint,
    )

    const tx = new Transaction().add(createAtaIx)
    await sendAndConfirmTransaction(connection, tx, [operator])

    console.log(
      `✅ Created operator ATA: ${ata.toBase58()} (0 tokens, reclaimable)`,
    )
  }

  console.log('\n🎉 Test accounts created!')
  console.log('\nNext steps:')
  console.log('  1. Run: npm start -- scan')
  console.log('  2. Run: npm start -- check --all')
  console.log('  3. Run: npm start -- reclaim --dry-run')
}

async function listTokenAccounts(connection: Connection, owner: PublicKey) {
  console.log('\n📋 Token accounts owned by operator:\n')

  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  })

  if (accounts.value.length === 0) {
    console.log('No token accounts found.')
    return
  }

  for (const { pubkey, account } of accounts.value) {
    const data = account.data.parsed.info
    console.log(`Address: ${pubkey.toBase58()}`)
    console.log(`  Mint: ${data.mint}`)
    console.log(`  Balance: ${data.tokenAmount.uiAmount}`)
    console.log(`  Rent: ${account.lamports / LAMPORTS_PER_SOL} SOL`)
    console.log(
      `  Reclaimable: ${data.tokenAmount.uiAmount === 0 ? 'YES' : 'NO'}`,
    )
    console.log('')
  }

  const totalRent = accounts.value.reduce(
    (sum, a) => sum + a.account.lamports,
    0,
  )
  const reclaimable = accounts.value.filter(
    (a) => a.account.data.parsed.info.tokenAmount.uiAmount === 0,
  )
  const reclaimableRent = reclaimable.reduce(
    (sum, a) => sum + a.account.lamports,
    0,
  )

  console.log('─'.repeat(50))
  console.log(`Total accounts: ${accounts.value.length}`)
  console.log(`Total rent locked: ${totalRent / LAMPORTS_PER_SOL} SOL`)
  console.log(`Reclaimable accounts: ${reclaimable.length}`)
  console.log(`Reclaimable rent: ${reclaimableRent / LAMPORTS_PER_SOL} SOL`)
}

async function requestAirdrop(connection: Connection, pubkey: PublicKey) {
  console.log('\n💰 Requesting airdrop...')

  try {
    const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig)
    console.log(`✅ Airdrop successful! TX: ${sig}`)

    const balance = await connection.getBalance(pubkey)
    console.log(`New balance: ${balance / LAMPORTS_PER_SOL} SOL`)
  } catch (error) {
    console.error('Airdrop failed:', error)
    console.log('\nTry manually:')
    console.log(`  solana airdrop 2 ${pubkey.toBase58()} --url devnet`)
  }
}

main().catch(console.error)
