# Understanding Vacuum: CLI vs SDK

Vacuum works in two ways:

1.  **CLI Tool**: A standalone application you run in your terminal (perfect for operators/individuals).
2.  **SDK (Library)**: A code library you import into your own backend/scripts (perfect for builders).

This guide explains when and how to use each.

---

## 1. The CLI Tool (Command Line Interface)

**Best for:**

- Manual operation.
- Running cron jobs on a server.
- Using the Telegram Bot.
- No coding required.

**How it works:**
You install `vacuum-sol` globally or run it via `npm start`. It uses the configuration from your `.env` file or arguments you pass to it.

**Example Usage:**

```bash
# Scan for accounts
vacuum scan

# Reclaim rent
vacuum reclaim --yes

# Start the Telegram bot
vacuum bot
```

---

## 2. The SDK (Software Development Kit)

**Best for:**

- Integrating rent reclamation into your existing backend.
- Custom automation logic.
- Building your own dashboard or tools on top of Vacuum.

**How it works:**
You import `VacuumClient` into your TypeScript/JavaScript code. You can configure it programmatically, overriding environment variables if needed.

### Installation

```bash
npm install vacuum-sol
```

### Usage Example

Here is how you would use the SDK in your own `worker.ts` or backend service:

```typescript
import { VacuumClient } from 'vacuum-sol'

async function runCleanupJob() {
  // 1. Initialize the client
  const client = new VacuumClient({
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    treasury: 'YOUR_TREASURY_WALLET_ADDRESS',
    keypairPath: './operator-keypair.json', // Path to the keypair that serves as the authority
    logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error' | 'silent'
  })

  console.log('Starting cleanup job...')

  // 2. Scan for accounts
  // This finds all token accounts owned by the operator keypair
  const accounts = await client.scan()
  console.log(`Found ${accounts.length} total accounts.`)

  // 3. Detect Reclaimable Accounts
  // Filters the list for accounts with 0 balance that are safe to close
  const reclaimable = await client.check(accounts)
  console.log(`${reclaimable.length} accounts are ready to be reclaimed.`)

  if (reclaimable.length === 0) {
    return
  }

  // 4. Reclaim Rent
  // Executes the close instructions.
  // Returns a list of results with transaction signatures.
  const results = await client.reclaim(reclaimable, {
    dryRun: false, // Set to true to simulate without sending transactions
    maxAccounts: 50, // Optional limit per batch
  })

  const successful = results.filter((r) => r.success)
  console.log(`Successfully reclaimed rent from ${successful.length} accounts!`)
}

runCleanupJob().catch(console.error)
```

### Key Differences

| Feature         | CLI                 | SDK                             |
| :-------------- | :------------------ | :------------------------------ |
| **Setup**       | `.env` file         | Constructor config object       |
| **Execution**   | Terminal commands   | Function calls                  |
| **Output**      | Pretty console logs | Return values (Arrays, Objects) |
| **Integration** | Standalone process  | Embedded in your app            |
