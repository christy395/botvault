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
