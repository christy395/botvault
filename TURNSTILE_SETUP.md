# BotVault anti-bot verification setup

BotVault uses Cloudflare Turnstile on account registration and Discord bot connection. Both API routes validate the challenge token server-side; hiding the widget in the browser does not bypass that server check.

## Configure Turnstile

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and go to **Turnstile**.
2. Create a widget for the exact hostname users visit (for example, your active BotVault domain). Choose the **Managed** widget mode.
3. Copy the **site key** and **secret key**.
4. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the site key in the environment used to build BotVault. It is public and must not be treated as a secret.
5. Add `TURNSTILE_SECRET_KEY` as a Worker secret in **Workers & Pages → botvault → Settings → Variables and Secrets**. Never commit the secret to Git.
6. Optionally set `TURNSTILE_HOSTNAME` to the exact hostname configured in the widget (without protocol or path) for an additional hostname check.
7. Rebuild and deploy BotVault, then test registration and bot connection in a private browser window.

The API fails closed when the secret is missing, so configure both keys before deploying this change. If the site key is missing from the build, the UI displays a configuration notice and keeps the submit button disabled.

## Add Cloudflare rate limits too

Turnstile reduces automated form abuse; it does not stop every DDoS or protect a bot runner by itself. In Cloudflare, create rate-limit rules for the public API endpoints, especially:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/bots`
- bot start/restart endpoints under `/api/bots/*/start` and `/api/bots/*/restart`

Use conservative thresholds and test legitimate usage before blocking. Prefer a managed challenge or temporary block for repeated bursts. Keep the bot runner private, require its API key, isolate each bot process/container, cap CPU/RAM/disk/processes, and never expose runner control ports directly to the public internet.

## What this protects

- New account creation requires a valid, server-verified Turnstile token.
- Connecting a Discord bot requires a fresh, server-verified Turnstile token.
- Tokens are checked with Cloudflare's Siteverify API and are not trusted just because they came from the browser.

This is one layer of defense, not a guarantee against all raids, DDoS attacks, stolen accounts, or malicious users.
