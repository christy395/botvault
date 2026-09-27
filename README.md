# BOTVAULT



> **Your Discord Bots. Online. 24/7.**



BotVault is a Cloudflare-first Discord bot hosting platform designed around a genuine Free Forever plan. The project separates the web application from the machines that actually run customer Discord bots.



## Table of Contents

- Overview

- Goals

- Architecture

- Cloudflare

- Technology

- Repository

- Dashboard

- Authentication

- Bot lifecycle

- Hosting nodes

- Docker isolation

- Database

- D1 / R2 / KV

- API

- Console

- File manager

- Secrets

- Free Forever

- Admin panel

- Monitoring

- Security

- Deployment

- Local development

- Production setup

- Hosting controller

- Troubleshooting

- Production checklist

- Current scope

- Future roadmap



## Overview

BotVault provides a browser control panel for creating, deploying, monitoring, and managing Discord bots. A user should be able to create an account, create a bot, select Node.js or Python, upload files, configure environment variables, deploy to an available hosting node, start or stop the bot, inspect live logs, and manage the project without direct server access.



BotVault is intentionally not designed to execute long-lived Discord processes inside Cloudflare Workers. Cloudflare is the web and API edge. Dedicated Linux hosting nodes run the customer processes.



## Goals

1. Build a real hosting platform rather than a static dashboard.

2. Keep credentials and customer data protected.

3. Isolate customer workloads from each other and from the host.

4. Keep the web layer Cloudflare-compatible.

5. Support a genuine $0/₹0 Free Forever plan.

6. Allow one node to grow into a multi-node infrastructure.

7. Never display fake uptime, fake CPU/RAM values, or fake deployment success.



## Architecture

User browser → Cloudflare Pages/Workers → BotVault API → D1/R2/KV → authenticated hosting controller → Linux node → Docker container → Discord.



The web/API layer handles authentication, application data, files, configuration, permissions, and control requests. The hosting controller handles Docker lifecycle operations, resource limits, logs, health checks, and long-running bot processes.



## Why Cloudflare

Cloudflare provides the public edge layer, DNS, web delivery, Workers, D1, R2, KV, security features, and a deployment environment suitable for the BotVault control plane. This also keeps the public web application separate from the servers running untrusted customer code.



## Why bots need a hosting node

Discord bots normally maintain persistent Gateway connections and need a process that remains alive. Workers are request-oriented/serverless infrastructure and should not be treated as the permanent process manager for customer bots. BotVault therefore uses a dedicated Linux server or fleet of servers for the actual bot processes.



## Technology

- Next.js and React for the web application

- TypeScript for application code

- Cloudflare Pages/Workers for the web/API edge

- Cloudflare D1 for relational application data

- Cloudflare R2 for object and bot-file storage

- Cloudflare KV for appropriate cache/session use cases

- Wrangler for Cloudflare management

- OpenNext for Cloudflare-compatible Next.js deployment

- Linux and Docker for bot execution

- Node.js and Python runtimes for customer bots



## Repository structure

Important project files include:

- app/layout.tsx — application metadata and root layout

- app/page.tsx — BotVault landing page

- app/globals.css — visual system and responsive styling

- wrangler.jsonc — Cloudflare bindings and deployment configuration

- schema.sql — D1 starter schema

- BUILD_SPEC.md — production architecture notes

- README.md — project documentation

- package.json — scripts and dependencies

- next.config.ts — Next.js configuration

- tsconfig.json — TypeScript configuration

- .gitignore — local and secret-file exclusions



## Dashboard

The planned dashboard contains Dashboard, My Bots, Create Bot, Servers, Usage, Account, and Settings sections.

Dashboard cards should show real totals and real infrastructure measurements. Bot cards should show name, runtime, status, CPU, memory, storage, uptime, and available lifecycle controls.



## Authentication

Production authentication should include registration, login, logout, password reset, secure sessions, optional email verification, and optional Discord OAuth. Passwords must never be stored as plaintext. Protected operations must be authorized on the server.



Changing a bot ID in a URL must never allow a user to access another user's bot. Ownership must be checked against the authenticated session on every protected resource operation.



## Bot lifecycle

Supported lifecycle operations are create, deploy, start, stop, restart, rebuild, and delete.

A typical deployment is: authenticate user → verify ownership → check plan limits → create deployment record → select node → send authenticated controller request → prepare files → create restricted container → apply resource limits → start process → collect logs → report health.



Failures must become explicit failure states. The dashboard must never claim a deployment succeeded if the hosting controller did not confirm it.



## Hosting nodes

Each node should report a unique ID, name, endpoint, status, CPU capacity, RAM capacity, storage capacity, current usage, running bot count, and last heartbeat.

Recommended states are Online, Offline, Maintenance, and Full.

Nodes should periodically send heartbeats. If heartbeats stop beyond the configured timeout, the node should be marked unavailable and new deployments should avoid it.



## Docker isolation

Customer code must not execute directly inside the public API process. Each bot should run inside an isolated Docker container with a dedicated bot directory and enforced CPU, memory, PID, storage, and process limits.

Containers must not have access to the host filesystem, Docker socket, host credentials, or other customers' containers.

The public web application must never expose the Docker socket.



## Database

The starter schema contains Users, Bots, Servers, Deployments, and AuditLogs. The production model should expand to include BotFiles, EnvironmentVariables, Plans, Subscriptions, UsageMetrics, Logs, and Sessions as required.

Ownership relationships should make it impossible for one user to access another user's records.



## Cloudflare D1

D1 is intended for structured application records such as users, bots, deployments, servers, plan limits, and audit events. The repository includes schema.sql as a starting point. Production database changes should use deliberate migrations and backups.



## Cloudflare R2

R2 can store bot project files, deployment packages, large log exports, and backups where appropriate. R2 does not replace the isolated filesystem of a running container.



## Cloudflare KV

KV can support cache, short-lived state, session-related information, and other suitable edge use cases. It should not replace D1 as the primary relational store.



## API

Planned API resources include authentication, bots, bot lifecycle actions, logs, files, environment variables, servers, and public status.

Every protected endpoint must verify authentication, ownership, permissions, input validity, resource existence, and plan limits. Client-provided admin flags, user IDs, ownership fields, or resource limits must never be trusted.



## Realtime console

The console should display real stdout/stderr from the customer's container through the hosting controller. Features include live logs, timestamps, search, clear, download, auto-scroll, connection status, and lifecycle controls.

Secrets must be filtered and must never be intentionally written to logs.



## File manager

The file manager should support upload, download, create, edit, rename, delete, folders, search, and breadcrumbs. Path traversal protection is mandatory. User paths must always remain inside the bot's assigned directory or storage namespace.



## Environment variables and secrets

Examples include DISCORD_TOKEN, PREFIX, API_KEY, and DATABASE_URL. Secret values should be masked by default.

Never expose Discord tokens or other secrets through URLs, analytics, ordinary API responses, browser logs, deployment logs, or Git. Production secrets belong in secure server-side secret storage.



## Free Forever

BotVault's default product is Free Forever: ₹0 / $0 with no expiration and no fake trial or fake payment success.

Limits such as bot count, RAM, CPU, storage, deployment size, and log retention should be configurable by an authorized administrator and enforced by the infrastructure, not merely displayed by the UI.



## Admin panel

The admin panel should contain Overview, Users, Bots, Servers, Deployments, Logs, Plans, Usage, Settings, and Audit Logs.

Administrators may view infrastructure health, manage users, configure Free Forever limits, manage nodes, inspect deployments, and review resource usage according to the permission model.

Admin access must be enforced server-side. Hiding an admin button in the frontend is not security.



## Monitoring

Node monitoring should collect actual CPU, RAM, storage, bot count, health, and heartbeat information. Unknown infrastructure must be shown as unknown or unavailable rather than replaced with invented values.



## Security

Required controls include password hashing, secure sessions, authorization, ownership checks, admin RBAC, input validation, rate limiting, security headers, restricted CORS, CSRF protection where applicable, file validation, path traversal protection, command injection prevention, secret handling, audit logs, and authenticated controller requests.



Do not expose database passwords, Discord tokens, Cloudflare credentials, controller secrets, API keys, or private credentials.



## Resource limits

Resource limits should be enforced by Docker and the hosting node. A UI-only limit is insufficient.

Possible controls include CPU quota, memory limit, PID limit, storage quota, process count, and deployment-size limits. Actual values should be configurable rather than hardcoded into the public UI.



## Deployment

The project is configured for Cloudflare-oriented deployment using Wrangler and OpenNext.

Before production deployment, create D1, R2, and KV resources, replace placeholder IDs in wrangler.jsonc, apply the database schema, configure production secrets, verify Cloudflare permissions, and connect an authenticated hosting controller.

Deployment of the website alone does not create a bot hosting node.



## Local development

Install Node.js and npm, then run npm install followed by npm run dev. Use the production build before deployment to catch build-time errors.



## Cloudflare setup

1. Authenticate Wrangler with your Cloudflare account.

2. Create a D1 database.

3. Create the botvault-files R2 bucket.

4. Create a KV namespace.

5. Replace the placeholder D1 and KV IDs in wrangler.jsonc.

6. Apply schema.sql to D1.

7. Configure production secrets using Cloudflare's secure secret mechanism.

8. Build and deploy using the configured OpenNext workflow.



## Environment variables

Never commit .env or production credentials. Typical production secrets can include database credentials, session secrets, OAuth secrets, controller authentication secrets, and other private keys.

If a credential is accidentally published, revoke or rotate it immediately.



## Hosting controller

The controller is a separate service running on a Linux hosting node. It receives authenticated commands from BotVault, validates them, performs Docker lifecycle operations, collects logs and metrics, reports health, and sends heartbeats.

The controller should use strong authentication and request signing where appropriate. It must not accept arbitrary public Docker commands.



## Connecting a hosting node

A node should have Linux, Docker, adequate CPU/RAM/storage, network access, firewall configuration, secure SSH, and the BotVault hosting controller.

Only the controller should have the privileges required to manage containers. The Docker socket should not be exposed to the Internet.



## Recommended production flow

User → account → dashboard → create bot → upload files → configure environment → deploy → node selected → container created → bot starts → console receives logs → health metrics update.



If a bot crashes, the controller detects the process exit, evaluates the restart policy, restarts when permitted, and reports the new state. If a node fails its heartbeat, BotVault marks it unavailable and prevents new scheduling there.



## Troubleshooting

Build errors: run npm install and npm run build and inspect the first meaningful error.

Cloudflare errors: verify Wrangler authentication, D1 ID, KV ID, R2 bucket, configuration, and permissions.

Database errors: verify the D1 binding and that the schema has been applied.

Bot startup errors: verify node availability, Docker, controller health, runtime, startup command, files, token validity, and resource limits.

Empty console: verify container logs, controller connectivity, authentication, and realtime transport.



## Production security checklist

- Passwords are hashed.

- Sessions are secure.

- Admin authorization is server-side.

- Ownership checks exist on every protected bot operation.

- Discord tokens are never returned by normal API responses.

- Secrets are never logged.

- .env files are ignored.

- Docker socket is private.

- Containers are isolated.

- CPU, RAM, PID, and storage limits are enforced.

- Path traversal is blocked.

- Command injection is prevented.

- Uploads are validated.

- Rate limiting is enabled.

- Security headers are configured.

- CORS is restricted.

- Audit logs are enabled.

- Controller requests are authenticated.

- Backups and recovery procedures exist.



## Production readiness

The repository provides the Cloudflare-oriented web foundation, original BotVault UI, deployment configuration, database starting point, and architecture documentation.

A complete production hosting service still requires the real authentication implementation, storage integration, hosting controller, Docker worker, node registration, bot deployment lifecycle, realtime logs, resource monitoring, secret management, admin RBAC, rate limiting, auditing, backups, monitoring, and recovery procedures.



BotVault must not present these integrations as active until they are actually connected.



## Current scope

Included in this repository are the Next.js foundation, TypeScript configuration, Cloudflare Wrangler configuration, D1 starter schema, R2/KV bindings, OpenNext deployment foundation, responsive BotVault landing page, Free Forever messaging, security requirements, and production architecture documentation.



## Future roadmap

Possible future features include Discord OAuth, bot templates, GitHub deployment, automatic dependency installation, deployment history, scheduled restarts, backups, webhooks, advanced analytics, multiple regions, automatic node selection, bot migration, custom plans, and a full billing system.



Paid plans should only be introduced with real billing logic and a real payment provider. The Free Forever plan should remain truthful.



## Contributing

Contributions should preserve security, Cloudflare compatibility, container isolation, server-side authorization, accurate infrastructure reporting, responsive design, and maintainable code.

Before submitting changes, install dependencies, run the development server, run a production build, test ownership and authentication changes, inspect responsive layouts, check for secrets, and document significant architecture changes.



## License

Choose a license that matches the intended open-source or commercial use of BotVault before distributing the project.



## Security notice

Never publish a Discord bot token, database password, Cloudflare API token, hosting-controller secret, OAuth secret, or other private credential in GitHub, README files, screenshots, issues, or chat.

If a credential is exposed, revoke or rotate it immediately.



## Final architecture

BOTVAULT WEB/API → Cloudflare Pages/Workers → D1/R2/KV → authenticated hosting controller → Linux nodes → Docker containers → Discord.



**BOTVAULT — Free Discord Bot Hosting. Forever.**