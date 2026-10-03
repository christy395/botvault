from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
import websockets
from websockets.exceptions import ConnectionClosed

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("botvault-runner")

API_KEY = os.getenv("VPS_API_KEY", "").strip()
DATA_FILE = Path(os.getenv("BOT_DATA_FILE", "./data/bots.json")).expanduser()
DASHBOARD_DIR = Path(os.getenv("DASHBOARD_DIR", ".")).expanduser()
DASHBOARD_FILE = os.getenv("DASHBOARD_FILE", "dashboard.html")
DISCORD_GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json"
DISCORD_API = "https://discord.com/api/v10"
COMMAND_PREFIX_DEFAULT = "!"
MAX_SSE_QUEUE = 100
MAX_BACKOFF = 60.0
FATAL_GATEWAY_CODES = {4004, 4010, 4011, 4012, 4013, 4014}

# Fix 3: Never expose the repository root through Flask's automatic /static route.
# The runner serves only the explicitly selected dashboard file.
app = Flask(__name__, static_folder=None)
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*").split(",")}})

pool_lock = threading.RLock()
persistence_lock = threading.RLock()
bot_pool: dict[str, "BotInstance"] = {}
dashboard_subscribers: dict[str, set[queue.Queue[str]]] = {}


# Fix 14: Bound every SSE queue and drop the oldest event if a client is too slow.
class SubscriberQueue(queue.Queue[str]):
    def __init__(self) -> None:
        super().__init__(maxsize=MAX_SSE_QUEUE)

    def put_latest(self, item: str) -> None:
        try:
            self.put_nowait(item)
            return
        except queue.Full:
            pass
        try:
            self.get_nowait()
        except queue.Empty:
            pass
        try:
            self.put_nowait(item)
        except queue.Full:
            pass


@dataclass
class Command:
    name: str
    description: str = ""
    reply_text: str = ""
    reply_embed: str = ""
    prefix: str = COMMAND_PREFIX_DEFAULT


@dataclass
class BotStats:
    uptime_start: Optional[float] = None
    latency_ms: Optional[float] = None
    guilds: dict[str, int] = field(default_factory=dict)
    commands_used: int = 0


class BotInstance:
    def __init__(
        self,
        bot_id: str,
        token: str,
        name: str,
        runtime: str = "node",
        discord_bot_id: Optional[str] = None,
        commands: Optional[list[dict[str, Any]]] = None,
        prefix: str = COMMAND_PREFIX_DEFAULT,
    ) -> None:
        self.bot_id = bot_id
        self.token = token
        self.name = name
        self.runtime = runtime if runtime in {"node", "python"} else "node"
        self.discord_bot_id = discord_bot_id
        self.prefix = prefix or COMMAND_PREFIX_DEFAULT
        self.commands: dict[str, Command] = {}

        for raw in commands or []:
            if not isinstance(raw, dict):
                continue
            cmd = Command(
                name=str(raw.get("name", "")).strip(),
                description=str(raw.get("description", "")),
                reply_text=str(raw.get("reply_text", "")),
                reply_embed=str(raw.get("reply_embed", "")),
                prefix=str(raw.get("prefix", self.prefix)),
            )
            if cmd.name:
                self.commands[cmd.name.casefold()] = cmd

        self.running = False
        self.ready = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.ws: Any = None
        self.thread: Optional[threading.Thread] = None
        self.sequence: Optional[int] = None
        self.session_id: Optional[str] = None
        self.resume_gateway_url: Optional[str] = None
        self.heartbeat_interval = 45.0
        self.last_heartbeat_sent: Optional[float] = None
        self.last_heartbeat_ack: Optional[float] = None
        self.stats = BotStats()
        self.retry_count = 0
        self.last_error: Optional[str] = None

    def snapshot(self) -> dict[str, Any]:
        with pool_lock:
            return {
                "botId": self.bot_id,
                "name": self.name,
                "runtime": self.runtime,
                "running": self.running,
                "ready": self.ready,
                "discordBotId": self.discord_bot_id,
                "uptime": max(0, int(time.time() - self.stats.uptime_start))
                if self.stats.uptime_start else 0,
                "latencyMs": round(self.stats.latency_ms, 1)
                if self.stats.latency_ms is not None else None,
                "guilds": len(self.stats.guilds),
                "members": sum(self.stats.guilds.values()),
                "commandsUsed": self.stats.commands_used,
                "lastError": self.last_error,
            }

    def start(self) -> None:
        # Fix 1 + 5: Register/check the instance before its worker starts. A
        # double-click cannot create two workers for the same bot.
        with pool_lock:
            if self.running or (self.thread and self.thread.is_alive()):
                return
            self.running = True
            self.thread = threading.Thread(
                target=self._thread_main,
                name=f"botvault-{self.bot_id}",
                daemon=True,
            )
            self.thread.start()

    def _thread_main(self) -> None:
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        try:
            self.loop.run_until_complete(self.run_bot())
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: runner failed"
            log.exception("bot %s runner failed", self.bot_id)
        finally:
            self.running = False
            self.ready = False
            try:
                self.loop.close()
            except Exception:
                pass
            self.loop = None
            broadcast_event(self.bot_id, {"type": "stopped", "bot": self.snapshot()})

    async def run_bot(self) -> None:
        # Fix 1: run_bot explicitly starts in the running state and reconnects
        # while that state remains true.
        self.running = True
        backoff = 1.0

        while self.running:
            try:
                await self.connect_and_run()
                backoff = 1.0
            except ConnectionClosed as exc:
                code = getattr(exc, "code", None)
                reason = getattr(exc, "reason", "") or "gateway connection closed"
                if code in FATAL_GATEWAY_CODES:
                    self.last_error = f"Discord Gateway closed ({code}). {reason}".strip()
                    broadcast_event(self.bot_id, {"type": "error", "error": self.last_error})
                    self.running = False
                    break
                if self.running:
                    self.last_error = f"Gateway disconnected ({code}); reconnecting"
                    broadcast_event(self.bot_id, {
                        "type": "reconnecting",
                        "error": self.last_error,
                    })
            except Exception as exc:
                if not self.running:
                    break
                self.last_error = f"{type(exc).__name__}: connection failed"
                log.warning("bot %s connection failed: %s", self.bot_id, type(exc).__name__)
                broadcast_event(self.bot_id, {
                    "type": "reconnecting",
                    "error": self.last_error,
                })

            if not self.running:
                break
            await asyncio.sleep(min(backoff, MAX_BACKOFF))
            backoff = min(backoff * 2, MAX_BACKOFF)
            self.retry_count += 1

    async def connect_and_run(self) -> None:
        gateway = self.resume_gateway_url or DISCORD_GATEWAY
        self.ready = False
        self.last_heartbeat_sent = None
        self.last_heartbeat_ack = None
        heartbeat_task: Optional[asyncio.Task[Any]] = None

        try:
            # Fix 7: Do not depend on websockets.exceptions.InvalidStatus, whose
            # availability/name differs across websockets releases.
            async with websockets.connect(
                gateway,
                additional_headers={"User-Agent": "BotVault-VPS-Runner/1.0"},
                ping_interval=None,
                close_timeout=5,
                max_size=8 * 1024 * 1024,
            ) as ws:
                self.ws = ws

                while self.running:
                    raw = await ws.recv()
                    msg = json.loads(raw)
                    op = msg.get("op")
                    data = msg.get("d")

                    # Fix 9: Never replace a valid sequence with Discord's null s.
                    if msg.get("s") is not None:
                        self.sequence = msg["s"]

                    if op == 10:  # HELLO
                        self.heartbeat_interval = max(
                            1.0,
                            float(data.get("heartbeat_interval", 45000)) / 1000.0,
                        )
                        # HELLO starts a heartbeat window, so a socket that never
                        # sends an ACK can still be detected as zombied.
                        self.last_heartbeat_ack = time.monotonic()
                        if heartbeat_task:
                            heartbeat_task.cancel()
                        heartbeat_task = asyncio.create_task(self._heartbeat_loop())

                        if self.session_id and self.sequence is not None and self.resume_gateway_url:
                            await self._send_resume()
                        else:
                            await self._send_identify()

                    elif op == 11:  # HEARTBEAT_ACK
                        self.last_heartbeat_ack = time.monotonic()
                        if self.last_heartbeat_sent is not None:
                            self.stats.latency_ms = max(
                                0.0,
                                (self.last_heartbeat_ack - self.last_heartbeat_sent) * 1000.0,
                            )
                            broadcast_event(self.bot_id, {
                                "type": "stats",
                                "bot": self.snapshot(),
                            })

                    elif op == 1:  # HEARTBEAT requested immediately
                        await self._send_heartbeat()

                    elif op == 7:  # RECONNECT
                        return

                    elif op == 9:  # INVALID_SESSION
                        self.session_id = None
                        self.sequence = None
                        self.resume_gateway_url = None
                        self.ready = False
                        await asyncio.sleep(1.0)
                        return

                    elif op == 0 and isinstance(data, dict):
                        await self._handle_dispatch(msg.get("t"), data)
        finally:
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
                except Exception:
                    pass
            self.ws = None
            self.ready = False

    async def _heartbeat_loop(self) -> None:
        while self.running and self.ws is not None:
            await asyncio.sleep(self.heartbeat_interval)
            if not self.running or self.ws is None:
                return

            await self._send_heartbeat()

            # Fix 9: Detect a zombied connection when Discord stops acknowledging
            # heartbeats, then force a reconnect instead of reporting stale uptime.
            await asyncio.sleep(min(self.heartbeat_interval / 2.0, 5.0))
            if (
                self.running
                and self.ws is not None
                and self.last_heartbeat_ack is not None
                and time.monotonic() - self.last_heartbeat_ack
                > self.heartbeat_interval * 2.5
            ):
                await self.ws.close(code=4000, reason="Heartbeat ACK timeout")
                return

    async def _send_heartbeat(self) -> None:
        if self.ws is None:
            return
        self.last_heartbeat_sent = time.monotonic()
        await self.ws.send(json.dumps({"op": 1, "d": self.sequence}))

    async def _send_identify(self) -> None:
        await self.ws.send(json.dumps({
            "op": 2,
            "d": {
                "token": self.token,
                # GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT.
                "intents": 33281,
                "properties": {
                    "os": "linux",
                    "browser": "botvault",
                    "device": "botvault",
                },
            },
        }))

    async def _send_resume(self) -> None:
        await self.ws.send(json.dumps({
            "op": 6,
            "d": {
                "token": self.token,
                "session_id": self.session_id,
                "seq": self.sequence,
            },
        }))

    async def _handle_dispatch(self, event: Optional[str], data: dict[str, Any]) -> None:
        if event == "READY":
            self.session_id = data.get("session_id")
            self.resume_gateway_url = data.get("resume_gateway_url") or DISCORD_GATEWAY
            user = data.get("user") or {}
            self.discord_bot_id = user.get("id") or self.discord_bot_id
            self.ready = True

            # Fix 6: Reset retry_count only after a successful READY.
            self.retry_count = 0
            self.last_error = None

            # Fix 15: READY initializes uptime once; RESUME does not reset it.
            self.stats.uptime_start = self.stats.uptime_start or time.time()
            self.stats.guilds = {
                str(g.get("id")): int(g.get("member_count") or 0)
                for g in (data.get("guilds") or [])
                if g.get("id")
            }
            broadcast_event(self.bot_id, {"type": "ready", "bot": self.snapshot()})
            return

        if event == "RESUMED":
            self.ready = True
            self.retry_count = 0
            self.last_error = None
            self.stats.uptime_start = self.stats.uptime_start or time.time()
            broadcast_event(self.bot_id, {"type": "resumed", "bot": self.snapshot()})
            return

        if event == "GUILD_CREATE":
            guild_id = data.get("id")
            if guild_id:
                self.stats.guilds[str(guild_id)] = int(data.get("member_count") or 0)

        elif event == "GUILD_DELETE":
            # Fix 15: Removing a guild removes its member count from the total.
            guild_id = data.get("id")
            if guild_id:
                self.stats.guilds.pop(str(guild_id), None)

        elif event == "MESSAGE_CREATE":
            await self._handle_message(data)

    async def _handle_message(self, data: dict[str, Any]) -> None:
        if data.get("author", {}).get("bot"):
            return

        content = data.get("content")
        channel_id = data.get("channel_id")
        if not isinstance(content, str) or not channel_id:
            return

        # Fix 10: Compare the first whitespace-separated token, case-insensitively.
        # This makes !ping different from !pingpong.
        parts = content.strip().split()
        if not parts:
            return

        first = parts[0].casefold()
        args = parts[1:]
        matched: Optional[Command] = None

        for command in self.commands.values():
            prefix = command.prefix or self.prefix
            if first == f"{prefix}{command.name}".casefold():
                matched = command
                break

        if matched is None:
            return

        self.stats.commands_used += 1
        await self._reply(channel_id, matched, args)
        broadcast_event(self.bot_id, {
            "type": "command",
            "command": matched.name,
            "bot": self.snapshot(),
        })

    async def _reply(self, channel_id: str, command: Command, args: list[str]) -> None:
        text = command.reply_text.replace("{args}", " ".join(args)).strip()
        embed_description = command.reply_embed.replace("{args}", " ".join(args)).strip()

        # Fix 13: Send reply_embed as a real embed and never send empty content.
        # Fix 11: Disable all mentions so {args} cannot ping @everyone/@here/users.
        payload: dict[str, Any] = {"allowed_mentions": {"parse": []}}
        if text:
            payload["content"] = text
        if embed_description:
            payload["embeds"] = [{"description": embed_description}]

        if len(payload) == 1:
            return

        body = json.dumps(payload).encode("utf-8")
        url = f"{DISCORD_API}/channels/{channel_id}/messages"
        headers = {
            "Authorization": f"Bot {self.token}",
            "Content-Type": "application/json",
            "User-Agent": "BotVault-VPS-Runner/1.0",
        }

        # Fix 8: urllib is blocking, so run it off the Gateway event loop.
        await asyncio.to_thread(self._post_discord_message, url, headers, body)

    @staticmethod
    def _post_discord_message(
        url: str,
        headers: dict[str, str],
        body: bytes,
    ) -> None:
        # Fix 8: On HTTP 429, wait for retry_after and retry exactly once.
        for attempt in range(2):
            req = urllib_request.Request(
                url,
                data=body,
                headers=headers,
                method="POST",
            )
            try:
                with urllib_request.urlopen(req, timeout=15) as response:
                    response.read()
                return
            except urllib_error.HTTPError as exc:
                if exc.code != 429 or attempt == 1:
                    raise

                retry_after = 1.0
                try:
                    payload = json.loads(exc.read().decode("utf-8"))
                    retry_after = float(payload.get("retry_after", retry_after))
                except Exception:
                    pass
                time.sleep(max(0.0, retry_after))

    async def shutdown(self) -> None:
        # Fix 4: This coroutine is scheduled on the bot's own event loop by
        # asyncio.run_coroutine_threadsafe, never on a newly-created loop.
        self.running = False
        self.ready = False
        if self.ws is not None:
            try:
                await self.ws.close(code=1000, reason="Bot stopped")
            except Exception:
                pass


def validate_string(
    value: Any,
    field_name: str,
    *,
    required: bool = False,
) -> tuple[Optional[str], Optional[str]]:
    # Fix 12: Reject non-string values before calling string methods.
    if not isinstance(value, str):
        return None, f"{field_name} must be a string."

    if field_name not in {"reply_text", "reply_embed"}:
        value = value.strip()

    if required and not value:
        return None, f"{field_name} is required."

    return value, None


def validate_command_payload(
    body: Any,
) -> tuple[Optional[dict[str, str]], Optional[str]]:
    if not isinstance(body, dict):
        return None, "JSON body must be an object."

    fields: dict[str, str] = {}
    for field_name in (
        "name",
        "description",
        "reply_text",
        "reply_embed",
        "prefix",
    ):
        if field_name in body:
            value, error = validate_string(body[field_name], field_name)
            if error:
                return None, error
            fields[field_name] = value or ""

    if not fields.get("name"):
        return None, "name is required."

    prefix = fields.get("prefix", COMMAND_PREFIX_DEFAULT)
    if not 1 <= len(prefix) <= 5 or any(ch.isspace() for ch in prefix):
        return None, "prefix must be 1-5 characters and contain no whitespace."

    fields["prefix"] = prefix
    return fields, None


def require_api_key() -> Optional[Response]:
    # Fix 2: All /api endpoints except /api/health require the runner key.
    # SSE additionally accepts a query key because EventSource cannot set headers.
    if not API_KEY:
        return jsonify({"error": "VPS_API_KEY is not configured."}), 503

    supplied = request.headers.get("X-API-Key") or ""
    if request.path.endswith("/events"):
        supplied = supplied or request.args.get("api_key", "") or request.args.get("key", "")

    if supplied != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    return None


@app.before_request
def authenticate_api() -> Optional[Response]:
    if request.path == "/api/health" or not request.path.startswith("/api/"):
        return None
    return require_api_key()


@app.get("/")
def dashboard_root() -> Response:
    # Fix 3: Explicit route only; Flask has no public static directory.
    return send_from_directory(DASHBOARD_DIR, DASHBOARD_FILE)


@app.get("/dashboard")
def dashboard_page() -> Response:
    return send_from_directory(DASHBOARD_DIR, DASHBOARD_FILE)


@app.get("/api/health")
def health() -> Response:
    # Fix 17: Read bot_pool while holding pool_lock.
    with pool_lock:
        bots = list(bot_pool.values())

    return jsonify({
        "ok": True,
        "service": "botvault-vps-runner",
        "bots": len(bots),
        "running": sum(1 for bot in bots if bot.running),
        "ready": sum(1 for bot in bots if bot.ready),
        "timestamp": int(time.time()),
    })


@app.post("/api/bots/action")
def bot_action() -> Response:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "JSON body must be an object."}), 400

    action = body.get("action")
    bot_id = body.get("botId")

    if action not in {"start", "stop", "restart"}:
        return jsonify({"error": "action must be start, stop, or restart."}), 400
    if not isinstance(bot_id, str) or not bot_id.strip():
        return jsonify({"error": "botId must be a non-empty string."}), 400

    bot_id = bot_id.strip()

    if action == "start":
        token, token_error = validate_string(body.get("token"), "token", required=True)
        name, name_error = validate_string(
            body.get("name", bot_id),
            "name",
            required=True,
        )

        if token_error or name_error:
            return jsonify({"error": token_error or name_error}), 400
        if len(token or "") > 300:
            return jsonify({"error": "Invalid Discord bot token."}), 400
        if len(name or "") > 80:
            return jsonify({"error": "name must be 80 characters or fewer."}), 400

        runtime = body.get("runtime", "node")
        if runtime not in {"node", "python"}:
            return jsonify({"error": "runtime must be node or python."}), 400

        discord_bot_id = body.get("discordBotId")
        if discord_bot_id is not None and not isinstance(discord_bot_id, str):
            return jsonify({"error": "discordBotId must be a string."}), 400

        with pool_lock:
            existing = bot_pool.get(bot_id)

            if existing:
                if existing.token != token:
                    return jsonify({
                        "error": "A different token is already registered for this bot ID."
                    }), 409
                if existing.running:
                    return jsonify({
                        "ok": True,
                        "status": "already_running",
                        "bot": existing.snapshot(),
                    })
            else:
                # Fix 5: Duplicate-token detection and registration happen under
                # the same lock before starting the thread.
                duplicate = next(
                    (bot for bot in bot_pool.values() if bot.token == token),
                    None,
                )
                if duplicate:
                    return jsonify({
                        "error": "That Discord bot token is already running."
                    }), 409

                existing = BotInstance(
                    bot_id=bot_id,
                    token=token or "",
                    name=name or bot_id,
                    runtime=runtime,
                    discord_bot_id=discord_bot_id,
                )
                bot_pool[bot_id] = existing

            existing.start()

        persist_state()
        return jsonify({
            "ok": True,
            "status": "starting",
            "bot": existing.snapshot(),
        })

    with pool_lock:
        bot = bot_pool.get(bot_id)

    if not bot:
        return jsonify({"error": "Bot not found."}), 404

    if action == "restart":
        stop_instance(bot)
        bot.start()
        persist_state()
        return jsonify({
            "ok": True,
            "status": "restarting",
            "bot": bot.snapshot(),
        })

    stop_instance(bot)
    persist_state()
    return jsonify({
        "ok": True,
        "status": "stopped",
        "bot": bot.snapshot(),
    })


@app.get("/api/bots")
def list_bots() -> Response:
    with pool_lock:
        bots = list(bot_pool.values())
    return jsonify({"bots": [bot.snapshot() for bot in bots]})


@app.get("/api/bots/<bot_id>")
def get_bot(bot_id: str) -> Response:
    with pool_lock:
        bot = bot_pool.get(bot_id)
    if not bot:
        return jsonify({"error": "Bot not found."}), 404
    return jsonify({"bot": bot.snapshot()})


@app.post("/api/deploy")
def deploy_compat() -> Response:
    # Compatibility endpoint for the earlier standalone backend API. The main
    # BotVault control plane uses /api/bots/action.
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "JSON body must be an object."}), 400

    token, token_error = validate_string(body.get("token"), "token", required=True)
    name, name_error = validate_string(body.get("name"), "name", required=True)
    if token_error or name_error:
        return jsonify({"error": token_error or name_error}), 400

    if len(token or "") > 300:
        return jsonify({"error": "Invalid Discord bot token."}), 400

    runtime = body.get("runtime", "node")
    if runtime not in {"node", "python"}:
        return jsonify({"error": "runtime must be node or python."}), 400

    with pool_lock:
        if any(bot.token == token for bot in bot_pool.values()):
            return jsonify({"error": "That Discord bot token is already running."}), 409

        bot_id = str(body.get("bot_id") or uuid.uuid4())
        if bot_id in bot_pool:
            return jsonify({"error": "bot_id already exists."}), 409

        bot = BotInstance(
            bot_id,
            token or "",
            name or bot_id,
            runtime,
        )
        bot_pool[bot_id] = bot
        bot.start()

    persist_state()
    return jsonify({"ok": True, "bot": bot.snapshot()}), 201


@app.post("/api/bots/<bot_id>/commands")
def create_command(bot_id: str) -> Response:
    with pool_lock:
        bot = bot_pool.get(bot_id)

    if not bot:
        return jsonify({"error": "Bot not found."}), 404

    payload, error = validate_command_payload(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    assert payload is not None
    command = Command(**payload)

    with pool_lock:
        bot.commands[command.name.casefold()] = command

    persist_state()
    return jsonify({"ok": True, "command": command.__dict__}), 201


@app.delete("/api/bots/<bot_id>/commands/<command_name>")
def delete_command(bot_id: str, command_name: str) -> Response:
    with pool_lock:
        bot = bot_pool.get(bot_id)
        if not bot:
            return jsonify({"error": "Bot not found."}), 404
        removed = bot.commands.pop(command_name.casefold(), None)

    if removed is None:
        return jsonify({"error": "Command not found."}), 404

    persist_state()
    return jsonify({"ok": True})


@app.get("/api/bots/<bot_id>/events")
def bot_events(bot_id: str) -> Response:
    with pool_lock:
        if bot_id not in bot_pool:
            return jsonify({"error": "Bot not found."}), 404
        subscriber = SubscriberQueue()
        dashboard_subscribers.setdefault(bot_id, set()).add(subscriber)

    def stream():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    event = subscriber.get(timeout=15)
                except queue.Empty:
                    # Fix 14: No finite poll cutoff; timeout is only an SSE keepalive.
                    yield ": ping\n\n"
                    continue
                yield f"data: {event}\n\n"
        except GeneratorExit:
            pass
        finally:
            with pool_lock:
                subscribers = dashboard_subscribers.get(bot_id)
                if subscribers:
                    subscribers.discard(subscriber)
                    if not subscribers:
                        dashboard_subscribers.pop(bot_id, None)

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def stop_instance(bot: BotInstance) -> None:
    # Fix 4: Stop through the BotInstance's existing asyncio loop.
    loop = bot.loop
    if loop and loop.is_running():
        future = asyncio.run_coroutine_threadsafe(bot.shutdown(), loop)
        try:
            future.result(timeout=10)
        except Exception as exc:
            log.warning(
                "bot %s shutdown did not finish cleanly: %s",
                bot.bot_id,
                type(exc).__name__,
            )
    else:
        bot.running = False


def broadcast_event(bot_id: str, event: dict[str, Any]) -> None:
    payload = json.dumps(event, separators=(",", ":"), ensure_ascii=False)
    with pool_lock:
        subscribers = list(dashboard_subscribers.get(bot_id, set()))

    for subscriber in subscribers:
        subscriber.put_latest(payload)


def persist_state() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    with persistence_lock, pool_lock:
        data = [
            {
                "botId": bot.bot_id,
                "token": bot.token,
                "name": bot.name,
                "runtime": bot.runtime,
                "discordBotId": bot.discord_bot_id,
                "prefix": bot.prefix,
                "commands": [cmd.__dict__ for cmd in bot.commands.values()],
            }
            for bot in bot_pool.values()
        ]

        tmp = DATA_FILE.with_suffix(DATA_FILE.suffix + ".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.replace(tmp, DATA_FILE)


def load_state() -> None:
    if not DATA_FILE.exists():
        return

    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("could not load %s: %s", DATA_FILE, type(exc).__name__)
        return

    if not isinstance(raw, list):
        log.warning("ignoring invalid bot state file")
        return

    with pool_lock:
        for item in raw:
            if not isinstance(item, dict):
                continue

            bot_id = item.get("botId")
            token = item.get("token")
            name = item.get("name")

            if not all(isinstance(v, str) and v for v in (bot_id, token, name)):
                continue
            if bot_id in bot_pool or any(bot.token == token for bot in bot_pool.values()):
                continue

            bot_pool[bot_id] = BotInstance(
                bot_id=bot_id,
                token=token,
                name=name,
                runtime=item.get("runtime", "node"),
                discord_bot_id=item.get("discordBotId"),
                commands=item.get("commands", []),
                prefix=item.get("prefix", COMMAND_PREFIX_DEFAULT),
            )

    # Fix 16: Load and auto-start persisted bots on runner boot.
    with pool_lock:
        bots = list(bot_pool.values())
    for bot in bots:
        bot.start()


# Fix 16: This simple runner persists Discord tokens in plaintext JSON so it can
# reconnect after a restart. Keep BOT_DATA_FILE private and out of Git. A
# production deployment should replace this with encrypted secret storage.
load_state()


if __name__ == "__main__":
    if not API_KEY:
        log.warning("VPS_API_KEY is not configured")
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8080")),
        threaded=True,
    )
