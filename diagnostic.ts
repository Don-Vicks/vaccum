import { Connection } from '@solana/web3.js'
import dotenv from 'dotenv'

dotenv.config()

const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

console.log(`Diagnostic: Testing connection to ${rpcUrl}`)

const connection = new Connection(rpcUrl, 'confirmed')

async function testConnection() {
  try {
    const version = await connection.getVersion()
    console.log('✅ Connection successful!')
    console.log('Node Version:', version)
  } catch (error) {
    console.error('❌ Connection failed:', error)
    if (error instanceof TypeError && error.message === 'fetch failed') {
      console.error('Possible Causes:')
      console.error('1. No internet connection')
      console.error('2. RPC URL is down or rate-limited')
      console.error('3. Firewall/VPN blocking the request')
    }
  }
}

testConnection()
