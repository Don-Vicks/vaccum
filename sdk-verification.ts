import { Keypair } from '@solana/web3.js'
import chalk from 'chalk'
import { VacuumClient } from './src/index.js'

async function verifySDK() {
  console.log(chalk.blue('🧪 Verifying Vacuum SDK...'))

  try {
    // 1. Verify Import
    if (!VacuumClient) {
      throw new Error('VacuumClient export not found!')
    }
    console.log(chalk.green('✅ VacuumClient export found'))

    // 2. Verify Constructor
    const client = new VacuumClient({
      rpcUrl: 'https://api.devnet.solana.com',
      treasury: Keypair.generate().publicKey.toBase58(),
      keypairPath: './operator-keypair.json',
      logLevel: 'silent',
      dryRun: true,
    })
    console.log(chalk.green('✅ VacuumClient initialized successfully'))

    // 3. Verify Methods existence
    if (typeof client.scan !== 'function')
      throw new Error('scan() method missing')
    if (typeof client.check !== 'function')
      throw new Error('check() method missing')
    if (typeof client.reclaim !== 'function')
      throw new Error('reclaim() method missing')
    console.log(chalk.green('✅ VacuumClient methods verified'))

    console.log(chalk.blue('\n✨ SDK Verification Passed!'))
  } catch (error) {
    console.error(chalk.red('❌ SDK Verification Failed:'), error)
    process.exit(1)
  }
}

verifySDK()
