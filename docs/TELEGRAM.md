# 🤖 Telegram Bot Integration Guide

Vacuum comes with a built-in Telegram bot that allows you to monitor your account status and trigger rent reclaims directly from your phone. This guide covers setup, configuration, and running the bot.

## 1. Create a Telegram Bot

1.  Open Telegram and search for **@BotFather**.
2.  Send the command `/newbot`.
3.  Follow the prompts to name your bot (e.g., `MyVacuumBot`).
4.  BotFather will give you an **HTTP API Token**. Save this token.
    - Example: `123456789:ABCdefGhIJKlmNoPQRstuVWxyz`

## 2. Get Your Chat ID

To prevent unauthorized access, the bot only responds to a specific Chat ID (you).

1.  Search for **@userinfobot** or **@JsonDumpBot** on Telegram.
2.  Click "Start" or send `/start`.
3.  Copy your `Id` number.
    - Example: `987654321`

## 3. Configuration

Add the following to your `.env` file in the project root:

```env
TELEGRAM_BOT_TOKEN=your_api_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

## 4. Running the Bot

### Verified & Recommended Method

We have added a dedicated script to run the bot easily.

**Using npm:**

```bash
npm run bot
```

**Using source (for development):**

```bash
npm run bot:dev
```

### Running in Background (Production)

To keep the bot running 24/7, we recommend using PM2.

1.  **Install PM2:**

    ```bash
    npm install -g pm2
    ```

2.  **Start the Bot:**

    ```bash
    pm2 start npm --name "vacuum-bot" -- run bot
    ```

3.  **View Logs:**
    ```bash
    pm2 logs vacuum-bot
    ```

## 5. Using the Bot

Once running, send `/start` to your bot in Telegram.

| Command            | Description                                               |
| :----------------- | :-------------------------------------------------------- |
| `/status`          | Show current rent summary (Locked vs Reclaimed)           |
| `/scan`            | Scan your operator accounts for new zero-balance accounts |
| `/check`           | Check for accounts that are safe to reclaim               |
| `/reclaim`         | **Dry Run**: Preview what would be reclaimed              |
| `/reclaim_execute` | **Execute**: Actually reclaim rent to your treasury       |
| `/history`         | Show the last 5 reclaim actions                           |

## Troubleshooting

- **Bot doesn't reply:** Ensure `TELEGRAM_CHAT_ID` matches your ID exactly. The bot ignores messages from unauthorized users.
- **"Unauthorized":** If the bot replies "Unauthorized", your Chat ID in `.env` is incorrect.
- **Env vars not loading:** Make sure you are running the command from the directory containing `.env`.
