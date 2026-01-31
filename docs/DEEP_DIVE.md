# How We Built Vacuum: A Deep Dive into Automated Rent Reclamation on Solana

_Recovering SOL that Kora operators lose to inactive sponsored accounts_

---

## The Problem: Silent Capital Drain

If you're a Kora operator sponsoring accounts on Solana, you're familiar with this scenario:

1. You sponsor a token account for a user (~0.002 SOL in rent)
2. The user transfers their tokens away
3. The account sits empty — **forever**
4. Your SOL stays locked

At scale, this becomes a significant capital leak. **20,000 sponsored accounts = 40 SOL sitting idle.** For operators serving 100K+ users, we're talking hundreds of SOL that could be put back to work.

This problem inspired **Vacuum** — an automated solution for detecting and reclaiming rent from inactive Solana accounts.

---

## Our Approach: Safety-First Architecture

We built Vacuum around one core principle: **never close an account that shouldn't be closed.**

The architecture consists of three main components:

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│   Scanner   │ ──▶ │    Detector    │ ──▶ │   Reclaimer  │
│             │     │                │     │              │
│ Find all    │     │ Check balance  │     │ Close empty  │
│ accounts    │     │ Verify safety  │     │ Return rent  │
└─────────────┘     └────────────────┘     └──────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
    ┌─────────────────────────────────────────────────┐
    │              SQLite Database                     │
    │   (Audit trail, whitelist, reclaim history)     │
    └─────────────────────────────────────────────────┘
```

### 1. Scanning: Finding Your Token Accounts

The scanner queries all token accounts owned by a specific operator wallet. We use Solana's `getProgramAccounts` with filters to efficiently retrieve only token accounts:

```typescript
const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
  filters: [
    { dataSize: 165 }, // Token account size
    { memcmp: { offset: 32, bytes: ownerPubkey.toBase58() } },
  ],
})
```

This returns every SPL token account where your operator wallet is the owner — the accounts holding your locked rent.

### 2. Detection: The Safety Layer

This is where Vacuum differentiates from naive approaches. We don't just look for "old" accounts — we verify they're **safe to close**.

```typescript
class ReclaimableDetector {
  async checkAccount(pubkey: PublicKey): Promise<DetectionResult | null> {
    // Skip protected accounts (whitelist)
    if (isAccountProtected(pubkey)) return null

    // Get current on-chain state
    const tokenData = await getTokenAccountData(pubkey)

    // Only reclaim if balance is EXACTLY 0
    if (tokenData && tokenData.amount === 0n) {
      return {
        account: trackedAccount,
        reason: 'zero_balance',
        reclaimableLamports: tokenData.lamports,
        safe: true, // Safe to auto-close
      }
    }

    // Non-zero balance = unsafe
    return null
  }
}
```

**Key safety checks:**

- ✅ **Zero balance verification**: Only accounts with `amount === 0n` are flagged as safe
- ✅ **Whitelist support**: Protected accounts are never touched
- ✅ **Real-time validation**: We check on-chain state, not cached data
- ✅ **Ownership verification**: Only close accounts the operator actually owns

### 3. Reclamation: Executing the Close

Once an account passes all safety checks, we execute the `closeAccount` instruction from the SPL Token program:

```typescript
async reclaimTokenAccount(detection: DetectionResult): Promise<ReclaimResult> {
  // Final safety gate
  if (!detection.safe) {
    return { success: false, error: 'Account marked as unsafe' };
  }

  // Double-check balance hasn't changed
  const tokenData = await getTokenAccountData(accountPubkey);
  if (tokenData.amount > 0n) {
    return { success: false, error: 'Balance no longer zero' };
  }

  // Verify operator ownership
  if (!tokenData.owner.equals(operator.publicKey)) {
    return { success: false, error: 'Operator is not the account owner' };
  }

  // Execute close — rent goes to treasury
  const txSignature = await closeTokenAccount(
    accountPubkey,
    this.treasuryAddress,
    operator
  );

  // Record in audit trail
  addReclaimHistory(accountPubkey, tokenData.lamports, txSignature);

  return { success: true, amountReclaimed: tokenData.lamports };
}
```

**Why double-check before closing?**

Between detection and execution, the account state can change. A user might:

- Deposit tokens back into the account
- Transfer ownership to another wallet

Our pre-flight checks catch these edge cases.

---

## Dry Run Mode: Preview Before You Commit

One of our most requested features: see what _would_ be reclaimed without actually executing transactions.

```bash
vacuum reclaim --dry-run
```

```
[DRY RUN] Would close 7vF9...xK2p and reclaim 0.00203928 SOL
[DRY RUN] Would close 8wG0...yL3q and reclaim 0.00203928 SOL
...
Total: 42 accounts, 0.0856 SOL reclaimable
```

This is especially useful for:

- Auditing what's available to reclaim
- Getting approval from stakeholders before executing
- Testing integrations without real transactions

---

## The Audit Trail

Every reclaim is logged with full details:

| Field              | Description                               |
| ------------------ | ----------------------------------------- |
| `account_pubkey`   | The closed account                        |
| `amount_reclaimed` | Lamports returned to treasury             |
| `tx_signature`     | On-chain transaction proof                |
| `reason`           | Why it was flagged (e.g., `zero_balance`) |
| `reclaimed_at`     | Timestamp                                 |

This creates a complete history for compliance, debugging, and reporting.

---

## Three Interfaces, One Engine

We built Vacuum to fit different workflows:

### CLI: For Operators & DevOps

```bash
vacuum scan          # Find all accounts
vacuum check --all   # Detect reclaimable
vacuum reclaim --yes # Execute (with confirmation)
```

Perfect for cron jobs, CI/CD pipelines, or manual operation.

### SDK: For Custom Integrations

```typescript
import { VacuumClient } from 'vacuum-sol'

const client = new VacuumClient({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  treasury: 'YOUR_TREASURY_WALLET',
  keypairPath: './operator-keypair.json',
})

// Full control in your backend
const accounts = await client.scan()
const reclaimable = await client.check(accounts)
const results = await client.reclaim(reclaimable, { dryRun: false })
```

Integrate rent reclamation into your existing infrastructure.

### Web Dashboard: One-Click Reclaim

Connect your wallet, see your reclaimable accounts, click "Reclaim All."

Built for operators who prefer a visual interface over terminal commands.

---

## Performance Considerations

**Rate limiting**: We add 500ms delays between transactions to avoid hitting RPC rate limits.

```typescript
// Small delay between transactions
if (i < toProcess.length - 1 && result.success && !options.dryRun) {
  await new Promise((resolve) => setTimeout(resolve, 500))
}
```

**Batch processing**: The `batchReclaim` function processes accounts sequentially with progress logging:

```
[1/42] Processing 7vF9...xK2p...
[2/42] Processing 8wG0...yL3q...
...
Reclaim complete:
  - Successful: 42/42
  - Total reclaimed: 0.0856 SOL
```

---

## What We Learned

1. **Safety over speed**: It's tempting to optimize for throughput, but one bad close (e.g., an account with funds) destroys trust. Every check is worth it.

2. **Audit trails matter**: When dealing with money, you need receipts. The SQLite database gives us instant answers for "when did we close this?" and "how much have we recovered?"

3. **Multiple interfaces serve different users**: Some operators live in the terminal. Others want a GUI. Some want to embed it in their stack. Supporting all three wasn't 3x the work — the core engine is shared.

---

## Try It Yourself

```bash
npm install -g vacuum-sol
vacuum --help
```

Or integrate the SDK:

```bash
npm install vacuum-sol
```

**GitHub**: [github.com/Don-Vicks/vaccum](https://github.com/Don-Vicks/vaccum)

---

_Built for the SuperteamNG Bounty. Stop leaving money on the table._
