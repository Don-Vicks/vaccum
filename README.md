# 🧹 Vacuum

**Suck up forgotten rent from Solana accounts.**

An automated rent-reclaim bot that monitors sponsored accounts and safely reclaims rent SOL when accounts are closed or eligible for cleanup.

## 📖 Understanding Solana Rent & Kora Sponsorship

### What is Rent on Solana?

Every account on Solana must hold **rent** (SOL) to remain active on the blockchain. This is essentially a storage fee:

| Account Type              | Typical Rent |
| ------------------------- | ------------ |
| Minimum (0 bytes)         | ~0.00089 SOL |
| Token Account (165 bytes) | ~0.00204 SOL |
| 1KB Account               | ~0.00696 SOL |

Accounts can be **rent-exempt** by holding 2 years worth of rent upfront. When an account is **closed**, the remaining lamports (including rent) are returned to a designated recipient.

### How Kora Sponsors Accounts

Kora is a gasless transaction infrastructure for Solana that allows apps to sponsor:

1. **Account Creation** - Kora pays the rent for new accounts (Token Accounts, ATAs, PDAs)
2. **Transaction Fees** - Kora covers gas fees for user transactions

When Kora sponsors account creation:

```
User Transaction → Kora Node Intercepts → Kora Pays Rent → Account Created
                                              ↓
                                     Rent SOL Locked in Account
```

### Where Rent Gets Locked

```
┌─────────────────────────────────────────────────────────────────┐
│                     RENT LOCKING FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│  1. User initiates action (e.g., receive NFT, create wallet)    │
│  2. Transaction requires new account creation                   │
│  3. Kora node sponsors the transaction                          │
│  4. Kora treasury pays rent (~0.002 SOL per token account)      │
│  5. Rent SOL is now LOCKED in the new account                   │
│  6. Over time, many accounts become unused/inactive             │
│  7. Rent remains locked unless accounts are explicitly closed    │
│         → This is the "silent capital loss"                     │
└─────────────────────────────────────────────────────────────────┘
```

### The Problem

- Kora operators sponsor thousands of accounts
- Many become inactive (user closed wallet, emptied tokens, etc.)
- Rent SOL stays locked indefinitely
- **No automated way to track or reclaim** this rent
- Result: **Silent capital loss**

### The Solution

This bot:

1. **Monitors** all sponsored accounts
2. **Detects** when accounts are closed or have zero balance
3. **Safely reclaims** rent back to the operator treasury
4. **Reports** on rent status (locked vs. reclaimed)

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Solana CLI (for keypair generation)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/kora-rent-reclaim
cd kora-rent-reclaim

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Generate operator keypair (if needed)
solana-keygen new -o operator-keypair.json

# Edit .env with your configuration
```

### Configuration

Edit `.env` with your settings:

```env
# Solana RPC (devnet for testing)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Your treasury address (where reclaimed SOL goes)
TREASURY_ADDRESS=YourTreasuryPublicKeyHere

# Path to operator keypair
OPERATOR_KEYPAIR_PATH=./operator-keypair.json

# Safety: Start with dry-run enabled
DRY_RUN=true
```

### Build

```bash
npm run build
```

---

## 📋 CLI Commands

### `scan` - Scan for Accounts to Track

```bash
# Scan all token accounts owned by operator
npm start -- scan

# Scan specific transactions for sponsored accounts
npm start -- scan --tx <signature1> <signature2>
```

### `check` - Find Reclaimable Accounts

```bash
# Check all tracked accounts
npm start -- check --all

# Check a specific account
npm start -- check --address <pubkey>
```

### `reclaim` - Reclaim Rent

```bash
# Preview reclaim (dry run)
npm start -- reclaim --dry-run

# Reclaim up to 10 accounts
npm start -- reclaim --max 10 --yes

# Reclaim without dry run
npm start -- reclaim --yes
```

### `report` - Generate Reports

```bash
# Show summary
npm start -- report

# Show reclaim history
npm start -- report --history

# Export as JSON
npm start -- report --format json
```

### `protect` - Manage Protected Accounts

```bash
# Add account to whitelist
npm start -- protect --add <pubkey> --reason "Active user"

# Remove from whitelist
npm start -- protect --remove <pubkey>

# List protected accounts
npm start -- protect --list
```

### `list` - List Tracked Accounts

```bash
# List all accounts
npm start -- list

# Filter by status
npm start -- list --status reclaimable
```

### `config` - Show Configuration

```bash
npm start -- config
```

---

## 🛡️ Safety Features

1. **Dry Run Mode** - Preview all actions before executing
2. **Protected Accounts** - Whitelist accounts that should never be reclaimed
3. **Zero Balance Check** - Only close token accounts with 0 balance
4. **Authority Verification** - Ensures operator has close authority
5. **Audit Trail** - All reclaims logged with transaction signatures
6. **Cooldown Period** - Configurable wait time before reclaiming inactive accounts

---

## 🏗️ Architecture

```
src/
├── index.ts              # CLI entry point
├── config.ts             # Configuration management
├── core/
│   ├── types.ts          # Type definitions
│   ├── monitor.ts        # Account monitoring/scanning
│   ├── detector.ts       # Reclaimable account detection
│   └── reclaimer.ts      # Rent reclaim execution
├── db/
│   ├── index.ts          # SQLite database setup
│   └── accounts.ts       # Account CRUD operations
├── services/
│   ├── solana.ts         # Solana RPC wrapper
│   └── reporter.ts       # Report generation
└── utils/
    ├── logger.ts         # Colored logging
    └── helpers.ts        # Utility functions
```

---

## 🧪 Testing on Devnet

### 1. Setup Devnet Environment

```bash
# Set Solana CLI to devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2 --keypair operator-keypair.json
```

### 2. Create Test Accounts

```bash
# Run simulation script to create test token accounts
npm run simulate create

# This creates several token accounts with 0 balance
```

### 3. Scan and Check

```bash
# Scan operator's accounts
npm start -- scan

# Check for reclaimable
npm start -- check --all
```

### 4. Test Dry Run

```bash
# Preview reclaim
npm start -- reclaim --dry-run
```

### 5. Execute Reclaim

```bash
# Actually reclaim (with confirmation skip)
DRY_RUN=false npm start -- reclaim --yes
```

---

## 📊 Report Example

```
📊 Rent Reclaim Summary
┌────────────────────────────────────────┐
│ Total Accounts Tracked: 150            │
│ ├─ Active:      85                     │
│ ├─ Reclaimable: 42                     │
│ ├─ Reclaimed:   20                     │
│ └─ Protected:   3                      │
│                                        │
│ 💰 Rent Status                         │
│ ├─ Locked:    0.285 SOL                │
│ └─ Reclaimed: 0.041 SOL                │
└────────────────────────────────────────┘
```

---

## 🔧 Extending for Production

### Adding Telegram Alerts

```typescript
// Future: Add telegram notification service
import { Telegram } from 'telegraf'

async function notifyReclaim(amount: number, accounts: number) {
  await bot.telegram.sendMessage(
    CHAT_ID,
    `✅ Reclaimed ${amount} SOL from ${accounts} accounts`,
  )
}
```

### Cron-Based Automation

```bash
# Add to crontab for daily checks
0 6 * * * cd /path/to/bot && npm start -- reclaim --yes >> /var/log/kora-reclaim.log
```

### Dashboard Integration

The `--format json` option outputs structured data that can be consumed by monitoring dashboards like Grafana.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- [Kora](https://kora.network) - Gasless transaction infrastructure
- [Solana](https://solana.com) - High-performance blockchain
- SuperteamNG - Bounty program
