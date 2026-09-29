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
- The bot API never returns stored bot credentials.

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

## 3. Create the tables

Run:

npx wrangler d1 execute botvault-db --remote --file=./migrations/0001_auth_bots.sql

The migration creates users, sessions, and bots tables plus indexes.

## 4. Deploy

After the binding exists and the migration has run, run:

bun run deploy

The Worker should show a D1 binding named DB.

## 5. Test

Open /register, create an account, then use /dashboard. Create a bot, log out, sign back in, and the bot should still be listed.

The D1 record is the source of truth. Do not move account ownership back to browser localStorage.

Actual Discord bot execution is separate: the VPS/hosting node will run the long-lived process, while Cloudflare stores account and bot metadata and provides the web/API layer.
