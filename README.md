# 🧹 Vacuum

**Suck up forgotten rent from Solana accounts.**

Vacuum is an automated rent-reclaim bot that monitors token accounts and safely reclaims rent SOL when accounts are closed or have zero balance. Built for Kora node operators and anyone managing sponsored Solana accounts.

![NPM Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Solana](https://img.shields.io/badge/solana-compatible-purple)

---

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/your-username/vacuum-sol
cd vacuum-sol
npm install && npm run build

# Configure
cp .env.example .env
# Edit .env with your TREASURY_ADDRESS

# Run
npm start -- scan          # Find accounts
npm start -- check --all   # Find reclaimable
npm start -- reclaim --dry-run  # Preview reclaim
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

- Kora/paymaster operators sponsor thousands of accounts
- Many get abandoned (users close wallets, empty tokens, etc.)
- Rent stays locked forever unless explicitly reclaimed
- **Result**: Silent capital loss

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
  <a href="https://github.com/your-username/vacuum-sol">GitHub</a> •
  <a href="https://t.me/vacuumsol">Telegram</a> •
  <a href="https://your-landing-page.com">Website</a>
</div>
