/**
 * Faction Hub - Cloudflare Worker
 * Handles: API proxying, Discord webhooks, Auth validation, WebSocket (real-time)
 */

import { DurableObject } from "cloudflare:workers";

// ─── Environment Interface ────────────────────────────────────────────────────
export interface Env {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Discord
  DISCORD_BOT_TOKEN: string;
  DISCORD_WEBHOOK_SECRET: string;

  // Auth
  JWT_SECRET: string;

  // KV for session caching
  SESSION_CACHE: KVNamespace;

  // Durable Object for real-time WebSocket rooms
  FACTION_ROOM: DurableObjectNamespace;
}

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dayz-faction-hub.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Faction-Id",
  "Access-Control-Max-Age": "86400",
};

function corsResponse(body: string | object | null, status = 200): Response {
  const isJson = typeof body === "object" && body !== null;
  return new Response(isJson ? JSON.stringify(body) : (body as string), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": isJson ? "application/json" : "text/plain",
    },
  });
}

// ─── Auth Validation ──────────────────────────────────────────────────────────
async function validateSession(
  request: Request,
  env: Env
): Promise<{ valid: boolean; userId?: string; factionId?: string }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false };
  }

  const token = authHeader.slice(7);

  // Check KV session cache first (fast path)
  const cached = await env.SESSION_CACHE.get(`session:${token}`);
  if (cached) {
    const session = JSON.parse(cached);
    return { valid: true, userId: session.userId, factionId: session.factionId };
  }

  // Validate against Supabase Auth
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!res.ok) return { valid: false };

    const user = await res.json<{ id: string; user_metadata?: { faction_id?: string } }>();

    const sessionData = {
      userId: user.id,
      factionId: user.user_metadata?.faction_id,
    };

    // Cache the session for 5 minutes
    await env.SESSION_CACHE.put(`session:${token}`, JSON.stringify(sessionData), {
      expirationTtl: 300,
    });

    return { valid: true, ...sessionData };
  } catch (err) {
    console.error("Auth validation error:", err);
    return { valid: false };
  }
}

// ─── API Proxy to Supabase ────────────────────────────────────────────────────
async function handleApiProxy(request: Request, env: Env, path: string): Promise<Response> {
  const session = await validateSession(request, env);
  if (!session.valid) {
    return corsResponse({ error: "Unauthorized" }, 401);
  }

  // Strip /api prefix and forward to Supabase
  const supabasePath = path.replace(/^\/api/, "");
  const targetUrl = `${env.SUPABASE_URL}/rest/v1${supabasePath}`;

  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
  });

  try {
    const response = await fetch(proxyRequest);
    const data = await response.json();
    return corsResponse(data, response.status);
  } catch (err) {
    console.error("API proxy error:", err);
    return corsResponse({ error: "Upstream error" }, 502);
  }
}

// ─── Discord Webhook Handler ──────────────────────────────────────────────────
async function handleDiscordWebhook(request: Request, env: Env): Promise<Response> {
  // Verify the request is from our own app (shared secret)
  const secret = request.headers.get("X-Webhook-Secret");
  if (secret !== env.DISCORD_WEBHOOK_SECRET) {
    return corsResponse({ error: "Forbidden" }, 403);
  }

  let body: {
    webhookUrl: string;
    event: string;
    factionName: string;
    message: string;
    color?: number;
    fields?: { name: string; value: string; inline?: boolean }[];
  };

  try {
    body = await request.json();
  } catch {
    return corsResponse({ error: "Invalid JSON body" }, 400);
  }

  // Build Discord embed
  const embed = {
    title: `⚔️ ${body.factionName} — ${body.event}`,
    description: body.message,
    color: body.color ?? 0xe74c3c, // DayZ red by default
    fields: body.fields ?? [],
    footer: { text: "Faction Hub • dayz-faction-hub.vercel.app" },
    timestamp: new Date().toISOString(),
  };

  try {
    const discordRes = await fetch(body.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error("Discord webhook failed:", err);
      return corsResponse({ error: "Discord delivery failed", detail: err }, 502);
    }

    return corsResponse({ success: true, event: body.event });
  } catch (err) {
    console.error("Discord webhook error:", err);
    return corsResponse({ error: "Failed to send webhook" }, 500);
  }
}

// ─── WebSocket Upgrade (routes to Durable Object) ────────────────────────────
async function handleWebSocket(request: Request, env: Env, factionId: string): Promise<Response> {
  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return corsResponse({ error: "Expected WebSocket upgrade" }, 426);
  }

  // Each faction gets its own Durable Object room
  const roomId = env.FACTION_ROOM.idFromName(factionId);
  const room = env.FACTION_ROOM.get(roomId);
  return room.fetch(request);
}

// ─── Main Router ──────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === "/health") {
      return corsResponse({ status: "ok", service: "faction-hub-worker" });
    }

    // Auth check endpoint
    if (path === "/auth/validate" && request.method === "GET") {
      const session = await validateSession(request, env);
      if (!session.valid) return corsResponse({ valid: false }, 401);
      return corsResponse({ valid: true, userId: session.userId, factionId: session.factionId });
    }

    // Discord webhook endpoint
    if (path === "/webhook/discord" && request.method === "POST") {
      return handleDiscordWebhook(request, env);
    }

    // WebSocket endpoint: /ws/:factionId
    if (path.startsWith("/ws/")) {
      const factionId = path.replace("/ws/", "").split("/")[0];
      if (!factionId) return corsResponse({ error: "Missing faction ID" }, 400);
      return handleWebSocket(request, env, factionId);
    }

    // API proxy: /api/*
    if (path.startsWith("/api/")) {
      return handleApiProxy(request, env, path);
    }

    return corsResponse({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

// ─── Durable Object: Faction Real-Time Room ───────────────────────────────────
export class FactionRoom extends DurableObject {
  /**
   * Each faction gets its own room. Members connect via WebSocket
   * and receive live events: war updates, stockpile changes, announcements, etc.
   */

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept using Hibernation API — keeps the DO alive only when needed
    this.ctx.acceptWebSocket(server);

    console.log(`New WebSocket connection. Active: ${this.ctx.getWebSockets().length}`);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let parsed: { type: string; payload?: unknown };

    try {
      parsed = JSON.parse(message as string);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // Broadcast to all connected members in this faction room
    const sockets = this.ctx.getWebSockets();

    switch (parsed.type) {
      case "war:update":
      case "stockpile:update":
      case "announcement":
      case "bounty:new":
      case "member:joined":
      case "member:left":
      case "diplomacy:update": {
        // Fan out to all connected clients in this faction
        const broadcast = JSON.stringify({
          type: parsed.type,
          payload: parsed.payload,
          timestamp: new Date().toISOString(),
          connections: sockets.length,
        });

        for (const socket of sockets) {
          if (socket !== ws || parsed.type === "announcement") {
            try {
              socket.send(broadcast);
            } catch (err) {
              console.error("Failed to send to socket:", err);
            }
          }
        }
        break;
      }

      case "ping":
        ws.send(JSON.stringify({ type: "pong", connections: sockets.length }));
        break;

      default:
        ws.send(JSON.stringify({ type: "error", message: `Unknown event type: ${parsed.type}` }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, "Faction Hub: connection closed");
    console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("WebSocket error:", error);
    ws.close(1011, "Internal WebSocket error");
  }
}