# BotVault VPS Runner

This runner is the actual Discord-bot compute layer.

## Architecture

Cloudflare Worker / Next.js
-> D1 stores bot metadata and encrypted tokens
-> VPS runner receives start/stop commands over HTTPS
-> VPS runs the Discord bot process

## Required VPS environment

VPS_API_KEY=your-private-runner-key

The Cloudflare Worker needs:

VPS_API_URL=https://your-vps-domain.example
VPS_API_KEY=the-same-private-runner-key

Never commit either value to GitHub.

## Runner API contract

POST /api/bots/action

Headers:
Authorization: Bearer <VPS_API_KEY>
Content-Type: application/json

Start:
{
  "action": "start",
  "botId": "bot-id",
  "token": "<discord-token>",
  "runtime": "node",
  "name": "My Bot",
  "discordBotId": "discord-id"
}

Stop:
{
  "action": "stop",
  "botId": "bot-id"
}

Restart:
{
  "action": "restart",
  "botId": "bot-id"
}

The runner must never log Discord bot tokens. It should store them only as long as needed to launch the process and keep process secrets out of stdout/stderr.

## Important

A Discord bot token by itself does not contain the bot's custom commands/code. The VPS runner can keep a bot connected, but real user bot code still needs to be uploaded or installed for that bot.

The Cloudflare Worker is the control plane. The VPS is the compute plane.


## Included runner

The repository now includes `backend.py`, a hardened Flask/WebSocket runner that implements the `POST /api/bots/action` contract used by `lib/vps.ts`.

It includes API-key authentication, safe dashboard routing, duplicate-start protection, Gateway resume/reconnect handling, real heartbeat latency, SSE events, command matching, mention protection, JSON persistence, and automatic restart of persisted bots.

### Run the runner

Use one Gunicorn worker because the current runner keeps bot processes and state in memory:

```bash
cd vps-runner
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

export VPS_API_KEY="replace-with-a-long-random-secret"
export BOT_DATA_FILE="/var/lib/botvault/bots.json"

gunicorn --bind 0.0.0.0:8080 --workers 1 backend:app
```

Put the runner behind HTTPS and a firewall. Never commit `VPS_API_KEY` or `BOT_DATA_FILE`.

**Important:** this simple runner persists Discord tokens in the local JSON state file so bots can reconnect after a runner restart. The file is Git-ignored, but it is plaintext and must be protected with normal server filesystem permissions. For a higher-security production deployment, replace the JSON token store with encrypted secret storage.

The existing BotVault Next.js dashboard remains the control plane; this runner is the compute-side service.
