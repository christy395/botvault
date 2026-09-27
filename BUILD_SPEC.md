# BotVault — Free Forever Edition

Cloudflare-first architecture:
Cloudflare Pages/Workers -> API -> D1/R2/KV -> authenticated hosting controller -> Docker node -> Discord bots.

Cloudflare Workers do not run long-lived Discord bot processes. Long-lived processes run on dedicated hosting nodes. Discord tokens stay server-side and are never returned by normal API responses.

Production integrations:
1. Create a Cloudflare D1 database and replace the placeholder ID in wrangler.jsonc.
2. Create the bot file R2 bucket.
3. Create a KV namespace and replace the placeholder ID.
4. Deploy the Next.js app with OpenNext for Cloudflare.
5. Deploy a separate Linux hosting controller.
6. Authenticate and sign controller requests.
7. Run user bots in isolated Docker containers with CPU, memory, PID and filesystem restrictions.
8. Configure secrets in Cloudflare/server environments, never Git.