# BOTVAULT

Your Discord Bots. Online. 24/7.

Cloudflare-first Discord bot hosting control panel designed around a Free Forever plan.

Architecture:
Cloudflare Pages/Workers -> BotVault API -> D1/R2/KV -> secure hosting controller -> Docker hosting node -> Discord bots.

Cloudflare Workers are the web/API edge. Long-lived Discord processes run on dedicated hosting nodes.

Local development:
npm install
npm run dev

Cloudflare setup:
1. Authenticate Wrangler with Cloudflare.
2. Create D1, R2 and KV resources.
3. Replace placeholder IDs in wrangler.jsonc.
4. Apply schema.sql to D1.
5. Configure production secrets in Cloudflare, never Git.
6. Build/deploy with OpenNext.

Deploy:
npm run deploy

A real Discord hosting service also requires a separate Linux hosting controller and Docker node. Do not expose the Docker socket to the public web application.

Never commit Discord tokens, database passwords, API keys, or private credentials.

Free Forever:
₹0 / $0 — Forever.
Capacity is controlled by connected infrastructure and configurable limits. No fake trials or fake payment flows are included.