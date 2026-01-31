# How I Built Vacuum: A Deep Dive into Automated Rent Reclamation on Solana

_A technical and philosophical journey through building a tool that recovers SOL from inactive sponsored accounts_

---

## Introduction: The Invisible Money Leak

I want to tell you about a problem that's silently draining capital from Solana projects. It's not a hack, not a bug, not market volatility. It's something far more mundane — and that's exactly why it goes unnoticed.

Every token account on Solana requires rent. About 0.002039 SOL, to be precise. This isn't news. But here's what _is_ news: if you're an operator sponsoring accounts on behalf of users — like Kora (built by the Solana Foundation) does for gasless transactions — you're probably hemorrhaging this rent to accounts that no one is using anymore.

The math is brutal. Let's say you've sponsored 20,000 accounts over the last year. That's:

```
20,000 × 0.002039 SOL = 40.78 SOL
```

At current prices, that's roughly **$5,000 USD** sitting in empty token accounts. Users who emptied their wallets months ago. Users who abandoned the platform. Users who moved their funds elsewhere. Their accounts remain — holding your SOL hostage.

This is the problem that led me to build **Vacuum**.

---

## Part 1: Understanding the Rent Model

Before I dive into the solution, let's make sure I understand the problem deeply.

### How Solana Rent Works

Unlike Ethereum's storage model, Solana uses a rent-based system. Every account on Solana must maintain a minimum balance (called "rent-exempt balance") to exist. This balance varies based on the account's data size:

| Account Type                   | Data Size | Minimum Balance |
| ------------------------------ | --------- | --------------- |
| Token Account                  | 165 bytes | ~0.00203928 SOL |
| Associated Token Account (ATA) | 165 bytes | ~0.00203928 SOL |
| Mint Account                   | 82 bytes  | ~0.00144768 SOL |

When you close an account, this rent is returned to a designated address. The key insight is: **if you own the account, you can close it and reclaim the rent.**

### The Kora Operator Model

The Solana Foundation built Kora, which pioneered a gasless transaction model on Solana. Here's how it works:

1. A user wants to receive SPL tokens but doesn't have SOL for rent
2. The Kora "operator" creates a token account on their behalf
3. The operator pays the rent (~0.002 SOL)
4. The user receives tokens without ever holding SOL

This is brilliant for onboarding new users. But it creates a hidden liability: the operator is now the "owner" of potentially thousands of token accounts, each holding locked rent.

### The Lifecycle of a Sponsored Account

```
Day 0:   User signs up → Operator creates account → 0.002 SOL locked
Day 30:  User receives tokens → Account is "active"
Day 90:  User transfers tokens away → Balance = 0
Day 180: User has forgotten about the platform
Day 365: Account still exists, rent still locked, user never returning
```

At what point can I safely reclaim this rent? That's the core question Vacuum answers.

---

## Part 2: The Safety-First Philosophy

When designing Vacuum, I established an immutable principle:

> **We will never close an account that shouldn't be closed.**

This isn't just a nice-to-have. It's the foundation of every design decision. One incorrectly closed account — an account with user funds — would destroy trust instantly. So I built multiple layers of verification.

### The Three Laws of Vacuum

1. **Only close accounts with exactly zero token balance**
2. **Only close accounts owned by the operator**
3. **Never close protected (whitelisted) accounts**

These rules are non-negotiable. They're enforced at multiple points in the codebase, not just at the entry point. Defense in depth.

---

## Part 3: Architecture Deep Dive

Vacuum's architecture follows a classic pipeline pattern with three main stages:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VACUUM ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌───────────┐      ┌────────────┐      ┌────────────┐            │
│   │  SCANNER  │ ───▶ │  DETECTOR  │ ───▶ │ RECLAIMER  │            │
│   │           │      │            │      │            │            │
│   │ • Fetch   │      │ • Validate │      │ • Verify   │            │
│   │   token   │      │   balance  │      │   again    │            │
│   │   accounts│      │ • Check    │      │ • Execute  │            │
│   │ • Parse   │      │   ownership│      │   close TX │            │
│   │   data    │      │ • Mark     │      │ • Log      │            │
│   │           │      │   status   │      │   history  │            │
│   └───────────┘      └────────────┘      └────────────┘            │
│         │                  │                   │                    │
│         ▼                  ▼                   ▼                    │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │                    SQLite Database                       │      │
│   │  • accounts: tracked accounts, status, rent amounts     │      │
│   │  • history: reclaim transactions, signatures, amounts   │      │
│   │  • whitelist: protected accounts that should never close│      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Let's examine each component in detail.

---

### Stage 1: The Scanner (AccountMonitor)

The Scanner is responsible for finding all token accounts that belong to the operator. This is surprisingly nuanced.

#### Method 1: Direct Token Account Scan

The most straightforward approach — query all token accounts where the operator is the owner:

```typescript
async scanOperatorAccounts(): Promise<TrackedAccount[]> {
  logger.info('Scanning operator token accounts...');

  const tokenAccounts = await getOperatorTokenAccounts();
  const tracked: TrackedAccount[] = [];

  for (const { pubkey, account } of tokenAccounts) {
    const parsed = account.data.parsed;
    if (!parsed || parsed.type !== 'account') continue;

    const info = parsed.info;
    const amount = BigInt(info.tokenAmount.amount);

    // Get current lamports (rent)
    const accountInfo = await getAccountInfo(pubkey);
    const lamports = accountInfo?.lamports || 0;

    const trackedAccount = {
      pubkey,
      accountType: 'token_account',
      rentLamports: lamports,
      owner: new PublicKey(info.owner),
      mint: new PublicKey(info.mint),
      createdAt: new Date(),
      lastCheckedAt: new Date(),
      status: amount === 0n ? 'reclaimable' : 'active',
    };

    addTrackedAccount(trackedAccount);
    tracked.push(trackedAccount);
  }

  return tracked;
}
```

Under the hood, this uses Solana's `getProgramAccounts` with filters:

```typescript
const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
  filters: [
    { dataSize: 165 }, // Standard token account size
    { memcmp: { offset: 32, bytes: ownerPubkey.toBase58() } },
  ],
})
```

The `memcmp` filter checks the owner field (at offset 32 in the token account data structure) against the operator's public key. This is an indexed query, so it's efficient even with millions of accounts on-chain.

#### Method 2: Transaction Signature Parsing

For operators who want to track only _sponsored_ accounts (not all their token accounts), I offer signature-based scanning:

```typescript
async scanFromSignatures(signatures: string[]): Promise<TrackedAccount[]> {
  const conn = getConnection();
  const tracked: TrackedAccount[] = [];

  for (const signature of signatures) {
    const tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) continue;

    // Look for account creation in inner instructions
    const innerInstructions = tx.meta.innerInstructions || [];

    for (const inner of innerInstructions) {
      for (const instruction of inner.instructions) {
        if ('parsed' in instruction) {
          const parsed = instruction.parsed;

          // Detect account creation instructions
          if (
            parsed.type === 'createAccount' ||
            parsed.type === 'initializeAccount' ||
            parsed.type === 'initializeAccount3'
          ) {
            const info = parsed.info;
            const accountPubkey = new PublicKey(
              info.account || info.newAccount
            );

            // ... validate and track
          }
        }
      }
    }
  }

  return tracked;
}
```

This approach parses transaction logs to find `createAccount` and `initializeAccount` instructions — the exact moment a sponsored account was born. It's more targeted but requires maintaining a list of sponsorship transaction signatures.

#### Why SQLite?

You might wonder why I use a local SQLite database instead of querying the chain every time. Several reasons:

1. **Speed**: Querying the database is ~100x faster than RPC calls
2. **Offline access**: You can analyze your accounts without network connectivity
3. **Audit trail**: I keep history of when accounts were tracked, checked, and reclaimed
4. **Whitelist management**: Protected accounts are stored locally

The database schema:

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  pubkey TEXT UNIQUE NOT NULL,
  account_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  rent_lamports INTEGER NOT NULL,
  owner TEXT,
  mint TEXT,
  sponsor_tx TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_checked_at DATETIME,
  last_activity_at DATETIME
);

CREATE TABLE reclaim_history (
  id INTEGER PRIMARY KEY,
  account_pubkey TEXT NOT NULL,
  amount_lamports INTEGER NOT NULL,
  tx_signature TEXT,
  reason TEXT,
  reclaimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE whitelist (
  pubkey TEXT PRIMARY KEY,
  reason TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### Stage 2: The Detector (ReclaimableDetector)

The Detector is the brain of Vacuum. It determines which accounts are safe to reclaim.

#### The Detection Algorithm

```typescript
async checkAccount(pubkey: PublicKey): Promise<DetectionResult | null> {
  const trackedAccount = getTrackedAccount(pubkey);

  // Gate 1: Must be tracked
  if (!trackedAccount) {
    logger.warn(`Account not tracked: ${pubkey.toBase58()}`);
    return null;
  }

  // Gate 2: Skip protected accounts
  if (isAccountProtected(pubkey)) {
    logger.debug(`Account is protected: ${pubkey.toBase58()}`);
    return null;
  }

  // Gate 3: Check current on-chain state
  const accountInfo = await getAccountInfo(pubkey);

  // Case A: Account no longer exists
  if (!accountInfo) {
    updateAccountState(pubkey, { status: 'reclaimed', rentLamports: 0 });
    return {
      account: trackedAccount,
      reason: 'closed',
      reclaimableLamports: trackedAccount.rentLamports,
      safe: true,
      details: 'Account no longer exists. Rent already returned.',
    };
  }

  // Case B: Token account with zero balance
  if (
    trackedAccount.accountType === 'token_account' ||
    trackedAccount.accountType === 'ata'
  ) {
    const tokenData = await getTokenAccountData(pubkey);

    if (tokenData && tokenData.amount === 0n) {
      updateAccountState(pubkey, {
        status: 'reclaimable',
        rentLamports: tokenData.lamports,
      });

      return {
        account: { ...trackedAccount, rentLamports: tokenData.lamports },
        reason: 'zero_balance',
        reclaimableLamports: tokenData.lamports,
        safe: true,  // ← This is the key flag
        details: `Token account has 0 balance. Safe to close.`,
      };
    }
  }

  // Case C: Account has balance or is non-token type
  updateAccountState(pubkey, {
    status: 'active',
    rentLamports: accountInfo.lamports,
  });
  return null;
}
```

Notice the `safe: true` flag. This is crucial. An account can be _detectable_ (we found something) but not _safe_ (we shouldn't auto-close it). The detector distinguishes between:

| Status        | Meaning                      | Action               |
| ------------- | ---------------------------- | -------------------- |
| `safe: true`  | Zero balance, verified owner | Auto-reclaim OK      |
| `safe: false` | Inactive but has balance     | Manual review needed |
| `null`        | Active or protected          | Skip entirely        |

#### Batch Detection

For efficiency, I provide a batch method:

```typescript
async findAllReclaimable(): Promise<DetectionResult[]> {
  const accounts = getAllTrackedAccounts();
  const results: DetectionResult[] = [];

  logger.info(`Checking ${accounts.length} tracked accounts...`);

  for (const account of accounts) {
    // Skip already-processed accounts
    if (account.status === 'reclaimed' || account.status === 'protected') {
      continue;
    }

    try {
      const result = await this.checkAccount(account.pubkey);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      logger.error(`Error checking ${account.pubkey.toBase58()}:`, error);
    }
  }

  logger.info(`Found ${results.length} reclaimable out of ${accounts.length}`);
  return results;
}
```

And a "safe only" filter:

```typescript
async findSafeReclaimable(): Promise<DetectionResult[]> {
  const all = await this.findAllReclaimable();
  return all.filter(r => r.safe);
}
```

---

### Stage 3: The Reclaimer (RentReclaimer)

The Reclaimer executes the actual close transactions. But before it does, it runs _additional_ verification — because state can change between detection and execution.

#### The Reclaim Flow

```typescript
async reclaimTokenAccount(
  detection: DetectionResult,
  options: ReclaimOptions = {}
): Promise<ReclaimResult> {
  const dryRun = options.dryRun ?? this.dryRunDefault;
  const accountPubkey = detection.account.pubkey;

  // === PRE-FLIGHT CHECKS ===

  // Check 1: Was it marked safe?
  if (!detection.safe) {
    return {
      success: false,
      error: 'Account marked as unsafe for automatic reclaim',
    };
  }

  // Check 2: Is it protected?
  if (isAccountProtected(accountPubkey)) {
    return { success: false, error: 'Account is protected' };
  }

  // Check 3: Is it the right account type?
  if (
    detection.account.accountType !== 'token_account' &&
    detection.account.accountType !== 'ata'
  ) {
    return { success: false, error: `Cannot reclaim type: ${detection.account.accountType}` };
  }

  // === REAL-TIME VERIFICATION ===

  // Re-fetch current state
  const tokenData = await getTokenAccountData(accountPubkey);

  if (!tokenData) {
    // Already closed by someone else
    updateAccountStatus(accountPubkey, 'reclaimed');
    return { success: true, error: 'Account already closed' };
  }

  // Check 4: Balance still zero?
  if (tokenData.amount > 0n) {
    return {
      success: false,
      error: `Balance no longer zero: ${tokenData.amount}`,
    };
  }

  // Check 5: Am I the owner?
  const operator = getOperatorKeypair();
  if (!tokenData.owner.equals(operator.publicKey)) {
    return {
      success: false,
      error: `Operator is not account owner. Owner: ${tokenData.owner.toBase58()}`,
    };
  }

  // === DRY RUN MODE ===

  if (dryRun) {
    logger.info(
      `[DRY RUN] Would close ${shortenPubkey(accountPubkey)} ` +
      `and reclaim ${formatSol(tokenData.lamports)} to treasury`
    );
    return {
      success: true,
      amountReclaimed: tokenData.lamports,
      txSignature: 'DRY_RUN',
    };
  }

  // === EXECUTE ===

  try {
    const txSignature = await closeTokenAccount(
      accountPubkey,
      this.treasuryAddress,
      operator
    );

    // Update database
    updateAccountStatus(accountPubkey, 'reclaimed');
    addReclaimHistory(
      accountPubkey,
      tokenData.lamports,
      txSignature,
      detection.reason
    );

    logger.success(
      `Reclaimed ${formatSol(tokenData.lamports)} from ${shortenPubkey(accountPubkey)}`
    );

    return {
      success: true,
      amountReclaimed: tokenData.lamports,
      txSignature,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### Why Double-Check Before Closing?

You might wonder: "If I already checked in the Detector, why check again?"

Because the blockchain moves fast. Between detection and execution:

- A user could deposit tokens back
- Another process could close the account
- Ownership could be transferred (rare, but possible)

The 30-second gap between "I found this account" and "I'm closing it" is enough for state to change. The Reclaimer's verification catches these edge cases.

#### Batch Processing with Rate Limiting

Closing hundreds of accounts means hundreds of transactions. I need to be responsible:

```typescript
async batchReclaim(
  detections: DetectionResult[],
  options: ReclaimOptions = {}
): Promise<ReclaimResult[]> {
  const maxAccounts = options.maxAccounts ?? detections.length;
  const toProcess = detections.slice(0, maxAccounts);
  const results: ReclaimResult[] = [];

  logger.info(`Processing ${toProcess.length} accounts for reclaim...`);

  for (let i = 0; i < toProcess.length; i++) {
    const detection = toProcess[i];
    logger.info(
      `[${i + 1}/${toProcess.length}] Processing ${shortenPubkey(detection.account.pubkey)}...`
    );

    const result = await this.reclaimTokenAccount(detection, options);
    results.push(result);

    // Rate limiting: 500ms between transactions
    if (i < toProcess.length - 1 && result.success && !options.dryRun) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  const successful = results.filter(r => r.success);
  const totalReclaimed = successful.reduce(
    (sum, r) => sum + r.amountReclaimed,
    0
  );

  logger.info(`Reclaim complete:`);
  logger.info(`  - Successful: ${successful.length}/${results.length}`);
  logger.info(`  - Total reclaimed: ${formatSol(totalReclaimed)}`);

  return results;
}
```

The 500ms delay prevents me from overwhelming RPC providers and ensures I don't hit rate limits.

---

## Part 4: The Interfaces

I built Vacuum to serve different users with different needs.

### CLI: For Terminal Lovers and Automation

```bash
# Install globally
npm install -g vacuum-sol

# Scan your accounts
vacuum scan

# Check for reclaimable
vacuum check --all

# Preview what would be reclaimed
vacuum reclaim --dry-run

# Execute (with confirmation)
vacuum reclaim --yes

# Run the Telegram bot
vacuum bot

# Start the dashboard server
vacuum dashboard
```

The CLI is perfect for:

- Manual one-off reclaims
- Cron jobs (scheduled daily/weekly)
- CI/CD pipelines
- Server-side automation

Example cron setup:

```bash
# Run every day at 3 AM
0 3 * * * cd /path/to/project && vacuum reclaim --yes >> /var/log/vacuum.log 2>&1
```

### SDK: For Developers Who Want Control

The SDK exposes the same functionality as programmatic APIs:

```typescript
import { VacuumClient } from 'vacuum-sol'

// Initialize with your configuration
const client = new VacuumClient({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  treasury: 'YOUR_TREASURY_WALLET_ADDRESS',
  keypairPath: './operator-keypair.json',
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error' | 'silent'
})

// Scan for accounts
const accounts = await client.scan()
console.log(`Found ${accounts.length} total accounts`)

// Detect reclaimable
const reclaimable = await client.check(accounts)
console.log(`${reclaimable.length} accounts ready to reclaim`)

// Preview (dry run)
const preview = await client.preview(reclaimable)
console.log(`Would reclaim: ${preview.totalSol}`)

// Execute
const results = await client.reclaim(reclaimable, {
  dryRun: false,
  maxAccounts: 100, // Process in batches
})

const successful = results.filter((r) => r.success)
console.log(`Reclaimed ${successful.length} accounts!`)
```

The SDK is designed to be embedded in:

- Backend services
- Monitoring systems
- Custom dashboards
- Automated trading bots

### Web Dashboard: For Visual Operators

For operators who prefer clicking over typing, I built a web interface:

- Connect your wallet
- See all your tracked accounts
- One-click reclaim
- Real-time balance updates
- Transaction history

The web version uses the same backend as the CLI and SDK — it's just a different frontend.

---

## Part 5: The Audit Trail

When dealing with money, you need receipts. Vacuum maintains a complete history:

```typescript
interface ReclaimHistoryEntry {
  id: number
  accountPubkey: string
  amountLamports: number
  txSignature: string
  reason: 'zero_balance' | 'closed' | 'inactive'
  reclaimedAt: Date
}
```

Every close is logged with:

- **Which account** was closed
- **How much** rent was recovered
- **The transaction signature** (proof on-chain)
- **Why** it was flagged (zero_balance, already closed, etc.)
- **When** it happened

This enables:

```typescript
// Get total reclaimed last 30 days
const history = getReclaimHistory(30)
const total = history.reduce((sum, h) => sum + h.amountLamports, 0)
```

Or for reporting:

```bash
vacuum report --days 30
```

Output:

```
Vacuum Report (Last 30 Days)
════════════════════════════════════════════
Total Reclaimed:    0.4523 SOL
Accounts Closed:    221
Average per Account: 0.00204 SOL

Top Reclaims:
  1. 7vF9...xK2p  0.00408 SOL  2024-01-15
  2. 8wG0...yL3q  0.00356 SOL  2024-01-14
  ...
```

---

## Part 6: Design Decisions & Trade-offs

### Why TypeScript?

The Solana ecosystem is heavily JavaScript/TypeScript. By building in TypeScript, I get:

- Native compatibility with `@solana/web3.js`
- Type safety for public APIs
- Easy integration with existing Node.js backends
- NPM distribution

The trade-off is performance — Rust would be faster. But for my use case (batch operations with RPC calls), network latency dominates runtime, so TypeScript is plenty fast.

### Why SQLite over PostgreSQL?

SQLite is:

- Zero configuration (no server to run)
- Portable (single file, easy to backup)
- Fast enough for my scale (millions of accounts per operator)

If I needed multi-node deployment or concurrent writes from multiple processes, PostgreSQL would make sense. For a single-operator tool, SQLite is perfect.

### Why Sequential, Not Parallel Transactions?

I process accounts one at a time with delays. I _could_ parallelize:

```typescript
// Don't do this
await Promise.all(detections.map((d) => reclaimTokenAccount(d)))
```

But parallel transactions:

- Hit rate limits faster
- Make debugging harder
- Can cause nonce/blockhash conflicts

Sequential with delays is slower but more reliable.

---

## Part 7: Lessons Learned

### 1. Safety Cannot Be Bolted On

I designed Vacuum with safety from day one. It's not a feature I added later. Every function, every check, every database schema assumes "we must never close an account with funds."

If you're building something similar, start with your invariants. What must _never_ happen? Build around that.

### 2. Dry Run Mode Is Not Optional

The first question every operator asks: "Can I test this without losing money?"

Dry run mode isn't a nice-to-have. It's essential for:

- Building trust with new users
- Debugging integrations
- Getting stakeholder approval

Always build preview/dry-run functionality into tools that touch money.

### 3. Multiple Interfaces Serve Different Users

Some operators love the terminal. Others want a GUI. Others want to integrate into their existing backend.

Building three interfaces (CLI, SDK, Web) wasn't 3x the work. The core engine is shared. The interfaces are thin wrappers. And it dramatically increases adoption.

### 4. Audit Trails Enable Debugging

When something goes wrong (and something always goes wrong), the first question is: "What happened?"

Comprehensive logging and database history let me answer that immediately. Worth the extra code.

---

## Part 8: Future Directions

Vacuum is functional today, but there's more I want to build:

1. **Scheduled automation**: Built-in cron-like scheduling without external tools
2. **Notification webhooks**: Ping a URL when reclaims happen
3. **Multi-operator support**: Manage multiple operator wallets from one interface
4. **Historical analytics**: Charts showing rent locked vs. reclaimed over time
5. **Kora SDK integration**: Direct hooks into Kora's sponsorship flow

---

## Conclusion: Stop Leaving Money on the Table

If you're sponsoring accounts on Solana, you're probably losing rent to inactive users. I built Vacuum to fix that.

The core insight is simple: token accounts with zero balance are safe to close. The implementation is careful: multiple verification layers ensure I never close something I shouldn't.

Try it yourself:

```bash
npm install -g vacuum-sol
vacuum scan
vacuum check --all
vacuum reclaim --dry-run
```

See how much you've been leaving behind.

---

**Links:**

- 📦 NPM: `npm install vacuum-sol`
- 📂 GitHub: [github.com/Don-Vicks/vaccum](https://github.com/Don-Vicks/vaccum)
- 🌐 Web Dashboard: [Coming soon]

_Built for the SuperteamNG Bounty. Because every lamport counts._

---

_If you found this useful, consider sharing it with other Solana developers. The more operators who reclaim their rent, the healthier the ecosystem._
