# Vacuum Demo Script & Guide

**Goal:** Show Vacuum as a powerful "set it and forget it" tool for cleaning up Solana rent.

## 0. Preparation (Before Recording)

1.  **Link the command:** Run `npm link` in your project root. This lets you type `vacuum` instead of `npm start --`.
2.  **Clear data:** (Optional) If you want a fresh start, delete `data/accounts.db`.
3.  **Ensure accounts exist:** Make sure you have some dummy accounts (or real ones) for the tool to find.

---

## Part 1: The Problem (The "Why")

**Narrative:**

> "If you're building on Solana, you know the pain. You create thousands of token accounts for users, for testing, or for operations. When you're done, those accounts sit there, empty, holding 0.002 SOL each. It's zombie capital."

---

## Part 2: The Action (The CLI)

**Narrative:**

> "Vacuum is a CLI tool that hunts these down. Let me show you."

**Step 1: Scan**

- **Action:** Type `vacuum scan`
- **Say:** "First, I tel it to scan my operator wallet. It finds every token account I've ever created."
- _screen shows scanning spinner and total accounts found_

**Step 2: Check**

- **Action:** Type `vacuum check`
- **Say:** "Now the magic. I run `check`. It filters through that list and finds the ones that are totally empty—zero balance. These are safe to close."
- _screen shows list of 'Safe to Reclaim' accounts_

**Step 3: Reclaim (Dry Run)**

- **Action:** Type `vacuum reclaim --dry-run`
- **Say:** "I don't want to make mistakes, so I do a dry run first. It calculates exactly how much SOL I'm getting back."
- _screen shows expected SOL return_

**Step 4: Execute**

- **Action:** Type `vacuum reclaim --yes`
- **Say:** "Looks good. Let's get that money back."
- _screen shows transaction signatures and 'Reclaimed X SOL'_

---

## Part 3: The Automation (The Telegram Bot)

**Narrative:**

> "That's great for manual cleanup. But I don't want to do this every day. That's why Vacuum runs as a background service."

**Action:**

1.  Run `npm run bot` (or just say "I have the bot running on my server").
2.  Switch to Telegram.
3.  Type `/status`.

**Say:**

> "I can just check my phone. The bot tells me 'Hey, you have 5 accounts to reclaim'. I hit a button, and it's done."

---

## Part 4: The Developer Experience (The SDK)

**Narrative:**

> "Finally, if you're a developer building your own infrastructure, you don't even need the CLI."

**Action:** Show VS Code with `docs/SDK_VS_CLI.md` or a code snippet.

**Say:**

> "Vacuum is also an SDK. You can import `VacuumClient` directly into your backend and have it run automatically as part of your system's hygiene."

---

## Closing

**Say:**

> "Whether you're an individual dev or a custodial exchange, Vacuum stops you from leaking SOL on rent."
