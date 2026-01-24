# 🧹 Vacuum

**Suck up forgotten rent from Solana accounts.**

Vacuum is an automated rent-reclaim bot that monitors **operator-owned** token accounts and safely reclaims rent SOL when accounts are closed or have zero balance. Perfect for custodial services, development environments, and anyone managing their own Solana token accounts at scale.

[![NPM Version](https://img.shields.io/npm/v/vacuum-sol)](https://www.npmjs.com/package/vacuum-sol)
![License](https://img.shields.io/badge/license-MIT-green)
![Solana](https://img.shields.io/badge/solana-compatible-purple)

---

## � Installation

### Install via npm (Recommended)

```bash
# Install globally
npm install -g vacuum-sol

# Verify installation
vacuum --version
vacuum --help
```

### Or clone from source

```bash
git clone https://github.com/Don-Vicks/vaccum.git
cd vaccum
npm install && npm run build
npm link  # Make 'vacuum' command available globally
```

---

## 🚀 Quick Start

### 1. Initial Setup

```bash
# Create a configuration directory
mkdir -p ~/.vacuum

# Set up your environment variables
export SOLANA_RPC_URL=https://api.devnet.solana.com
export TREASURY_ADDRESS=<your-wallet-address>
export OPERATOR_KEYPAIR_PATH=~/.vacuum/operator-keypair.json

# Or create a .env file in your project directory
cat > .env << EOF
# Solana RPC Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com

# Operator treasury address - rent will be reclaimed here
TREASURY_ADDRESS=<your-wallet-address>

# Path to operator keypair file (must have authority to close accounts)
OPERATOR_KEYPAIR_PATH=~/.vacuum/operator-keypair.json

# Kora Node Configuration (optional - for monitoring sponsored accounts)
KORA_NODE_URL=

# Safety Configuration
DRY_RUN=true
COOLDOWN_HOURS=24
MIN_INACTIVE_DAYS=7

# Telegram Bot (optional)
# Create bot via @BotFather on Telegram
TELEGRAM_BOT_TOKEN=
# Your personal chat ID (get via @userinfobot)
TELEGRAM_CHAT_ID=

# Database path
DB_PATH=./data/accounts.db

# Dashboard port (optional)
DASHBOARD_PORT=3333
EOF
```

### 2. Run Your First Scan

```bash
# Scan for accounts
vacuum scan

# Find reclaimable accounts
vacuum check --all

# Preview reclaim (safe, dry-run mode)
vacuum reclaim --dry-run

# Actually reclaim rent
vacuum reclaim --yes
```

### 3. View Reports

```bash
# Show summary
vacuum report

# Show history
vacuum report --history
```

---

## 📖 Understanding Solana Rent

### What is Rent?

Every Solana account must hold **rent** (SOL) to stay active:

| Account Type              | Rent Cost    |
| ------------------------- | ------------ |
| Token Account (165 bytes) | ~0.00204 SOL |
| 1KB Account               | ~0.00696 SOL |

When accounts are **closed**, this rent is returned to a designated address.

### The Problem

- Developers and custodial services create thousands of token accounts
- Many get abandoned (testing, unused wallets, closed positions, etc.)
- Rent stays locked in zero-balance accounts forever unless reclaimed
- **Result**: Silent capital loss of ~0.00204 SOL per account

> **⚠️ Important**: Vacuum reclaims rent from **accounts you own** (where your operator keypair is the account authority). It does NOT work for accounts where you merely paid transaction fees as a paymaster. See [Authority Model](#-authority-model) for details.

### The Solution

Vacuum automatically:

1. **Tracks** sponsored accounts in a local database
2. **Detects** accounts with 0 balance (safe to close)
3. **Reclaims** rent back to your treasury
4. **Reports** locked vs reclaimed totals

---

## ✨ Features

| Feature                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| 🔍 **Smart Detection**  | Finds zero-balance token accounts safe to close   |
| 🛡️ **Safety First**     | Dry-run mode, whitelists, balance verification    |
| 🤖 **Telegram Bot**     | Monitor and trigger reclaims from your phone      |
| 📊 **Audit Trail**      | Every reclaim logged with TX signatures           |
| ⏰ **Automation Ready** | Run on schedule with cron, PM2, or GitHub Actions |
| 💻 **CLI Interface**    | 8 powerful commands for full control              |

---

## 📋 CLI Commands

```bash
# Scanning
vacuum scan                # Scan operator's token accounts
vacuum scan --tx <sig>     # Scan specific transactions

# Checking
vacuum check --all         # Find all reclaimable accounts
vacuum check --address <pubkey>  # Check specific account

# Reclaiming
vacuum reclaim --dry-run   # Preview reclaim (safe)
vacuum reclaim --yes       # Actually reclaim
vacuum reclaim --max 20    # Limit to 20 accounts

# Reporting
vacuum report              # Show summary
vacuum report --history    # Show reclaim history
vacuum report --format json  # Export as JSON

# Protection
vacuum protect --add <pubkey> --reason "Active user"
vacuum protect --remove <pubkey>
vacuum protect --list

# Listing
vacuum list                # List all tracked accounts
vacuum list --status reclaimable  # Filter by status

# Bot
vacuum bot                 # Start Telegram bot

# Config
vacuum config              # Show configuration
```

---

## 🤖 Telegram Integration

### Setup

1. Create a bot: Message `@BotFather` on Telegram → `/newbot`
2. Get your chat ID: Message `@userinfobot`
3. Add to `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your-bot-token
   TELEGRAM_CHAT_ID=your-chat-id
   ```

### Run the Bot

```bash
npm start -- bot
```

### Telegram Commands

| Command            | Action            |
| ------------------ | ----------------- |
| `/status`          | Show rent summary |
| `/scan`            | Scan for accounts |
| `/check`           | Find reclaimable  |
| `/reclaim`         | Preview reclaim   |
| `/reclaim_execute` | Actually reclaim  |
| `/history`         | Recent reclaims   |

---

## ⚙️ Configuration

Create a `.env` file:

```env
# Required
SOLANA_RPC_URL=https://api.devnet.solana.com
TREASURY_ADDRESS=<your-wallet-address>
OPERATOR_KEYPAIR_PATH=./operator-keypair.json

# Optional
DRY_RUN=true
COOLDOWN_HOURS=24
MIN_INACTIVE_DAYS=7
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Database
DB_PATH=./data/accounts.db
```

---

## 🛡️ Safety Features

✅ **Dry-Run Mode** - Preview all actions before executing  
✅ **Zero Balance Check** - Only closes accounts with 0 tokens  
✅ **Protected Accounts** - Whitelist accounts to never reclaim  
✅ **Authority Verification** - Confirms operator owns the account  
✅ **Audit Trail** - All reclaims logged with TX signatures  
✅ **Cooldown Periods** - Wait N days before reclaiming inactive accounts

---

## 🔐 Authority Model

**Critical Understanding**: Vacuum can only reclaim rent from accounts where your operator keypair is the **account owner/authority**.

### ✅ Works For:

- Token accounts created by your operator wallet
- Custodial service accounts you manage
- Development/testing accounts you own
- Any account where `closeAuthority` is your operator

### ❌ Does NOT Work For:

- User-owned accounts (even if you paid fees as a Kora paymaster)
- Accounts where you're only the fee payer, not the owner
- Third-party wallets using your paymaster service

**Why?** On Solana, paying transaction fees ≠ account ownership. Only the account's `owner` or `closeAuthority` can close it and reclaim rent.

### Use Cases

1. **Custodial Services**: Reclaim rent from your users' accounts you manage
2. **Development**: Clean up test accounts from devnet/testnet
3. **Personal Management**: Monitor your own token accounts
4. **Bulk Account Management**: Manage rent across multiple operator profiles

---

## 🏗️ Architecture

```
vacuum-sol/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Environment configuration
│   ├── core/
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── monitor.ts        # Account scanning
│   │   ├── detector.ts       # Reclaimable detection
│   │   └── reclaimer.ts      # Rent reclaim execution
│   ├── db/
│   │   ├── index.ts          # SQLite setup
│   │   └── accounts.ts       # CRUD operations
│   ├── services/
│   │   ├── solana.ts         # Solana RPC wrapper
│   │   ├── telegram.ts       # Telegram bot
│   │   └── reporter.ts       # Report generation
│   └── utils/
│       ├── logger.ts         # Colored logging
│       └── helpers.ts        # Utilities
├── scripts/
│   └── simulate.ts           # Devnet testing
└── landing/
    └── index.html            # Landing page
```

---

## 🧪 Testing on Devnet

### 1. Setup

```bash
# Generate keypair
solana-keygen new -o operator-keypair.json

# Get devnet SOL
solana airdrop 2 --keypair operator-keypair.json --url devnet

# Configure for devnet
# Edit .env: SOLANA_RPC_URL=https://api.devnet.solana.com
```

### 2. Create Test Accounts

```bash
npx tsx scripts/simulate.ts create
```

This creates token accounts with 0 balance for testing.

### 3. Run the Bot

```bash
npm start -- scan
npm start -- check --all
npm start -- reclaim --dry-run
```

### 4. Actual Reclaim

```bash
DRY_RUN=false npm start -- reclaim --yes
```

---

## 📊 Example Report

```
📊 Rent Reclaim Summary
┌────────────────────────────────┐
│ Total Accounts Tracked: 150    │
│ ├─ Active:      85             │
│ ├─ Reclaimable: 42             │
│ ├─ Reclaimed:   20             │
│ └─ Protected:   3              │
│                                │
│ 💰 Rent Status                 │
│ ├─ Locked:    0.285 SOL        │
│ └─ Reclaimed: 0.041 SOL        │
└────────────────────────────────┘
```

---

## 🔧 Automation

### Cron

```bash
# Add to crontab for daily 6am checks
0 6 * * * cd /path/to/vacuum-sol && DRY_RUN=false npm start -- reclaim --yes
```

### PM2

```bash
npm install -g pm2
pm2 start npm --name "vacuum-reclaim" --cron "0 6 * * *" -- start -- reclaim --yes
```

### GitHub Actions

```yaml
name: Daily Reclaim
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  reclaim:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install && npm run build
      - run: npm start -- reclaim --yes
        env:
          TREASURY_ADDRESS: ${{ secrets.TREASURY_ADDRESS }}
```

---

## 🤝 Contributing

Contributions welcome! Open an issue or PR.

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 🙏 Acknowledgements

- [Kora](https://kora.network) - Gasless transaction infrastructure
- [Solana](https://solana.com) - High-performance blockchain
- SuperteamNG - Bounty program

---

<div align="center">
  <strong>Built with ❤️ for the Solana ecosystem</strong>
  <br><br>
  <a href="https://github.com/Don-Vicks/vaccum">GitHub</a> •
  <a href="https://www.npmjs.com/package/vacuum-sol">NPM</a> •
  <a href="http://vaccum-bot.vercel.app">Website</a>
</div>
