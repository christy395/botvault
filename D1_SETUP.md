# BotVault D1 persistence setup

BotVault now has account sessions and persistent bot records backed by Cloudflare D1.

## What this adds

- Email/password BotVault accounts.
- 30-day HTTP-only sessions.
- Passwords stored as PBKDF2-SHA-256 hashes, never plaintext.
- Bots are owned by a user account.
- /dashboard loads the signed-in user's bots from D1.
- Leaving the website does not remove a bot.
- /login and /register are available.
- The bot API never returns stored Discord bot credentials.
- The New Bot flow validates a Discord bot token with Discord and stores the token encrypted.

## 1. Create the D1 database

In Cloudflare:
1. Open Workers & Pages.
2. Open D1.
3. Create a database named botvault-db.
4. Copy the database ID.

You can also use: npx wrangler d1 create botvault-db

## 2. Add the binding

Add a D1 binding named exactly DB to the botvault Worker.

Cloudflare Dashboard: Workers & Pages -> botvault -> Bindings -> Add binding -> D1 database.

Use variable name DB and select botvault-db.

If you use Wrangler, add the generated binding to wrangler.jsonc. Do not commit a fake database ID.

## 3. Create/update the tables

For a new database run:

npx wrangler d1 execute botvault-db --remote --file=./migrations/0001_auth_bots.sql

For an existing BotVault database, also apply:

npx wrangler d1 execute botvault-db --remote --file=./migrations/0002_bot_connections.sql

The application also checks for the new columns automatically when D1 is first accessed.

## 4. Configure Discord token encryption

The New Bot connection flow needs a Cloudflare Worker secret named:

BOT_TOKEN_ENCRYPTION_KEY

Set it with Wrangler:

npx wrangler secret put BOT_TOKEN_ENCRYPTION_KEY

When Wrangler asks for the value, enter a long random secret. Never commit it to GitHub and never paste it into chat.

Without this secret, BotVault will not store Discord tokens.

## 5. Deploy

After the binding, migration, and secret exist, run:

npm run deploy

## 6. Test the New Bot flow

Open /dashboard and click **+ New bot**.

The modal asks for:
- Bot name
- Discord bot token

BotVault calls Discord to validate the token. It then stores the token encrypted and never displays it again in the bot profile or normal bot API responses.

Each bot has its own profile at /dashboard/bots/<bot-id>. That profile shows only the selected bot, not all bots in the account.

Actual Discord bot execution is separate: the VPS/hosting node will run the long-lived process, while Cloudflare stores account and bot metadata and provides the web/API layer. A successful connection at this stage means the Discord bot credentials were validated and stored securely; it does not claim that the bot is running 24/7 without a hosting node.
