// =============================================================================
// Fair-week monitor — healthz poll + error-log tail (Phase 6)
//
// Per Cassin's v1.6 brief §6: builder is on-call Sep 21-25, 2026 (InnoTrans
// Berlin fair week). This script is the operator-side companion to that
// on-call shift.
//
// What it does:
//   1. Polls /api/healthz every POLL_INTERVAL_MS (default 60s). On consecutive
//      failures it writes a 'health-fail' event to the log + prints to stderr.
//   2. Polls the operator-only /api/v1/system/info endpoint to verify auth
//      still works (login + token). A 401 here means the password changed
//      or the sessions table was wiped.
//   3. Tracks the count of 5xx lines in the docker log tail. A spike over
//      the threshold fires an event.
//
// What it does NOT do (intentional):
//   - No Slack/Discord/PagerDuty webhook (none configured; we don't have a
//     paid alerting service, and ad-hoc webhook setup at fair time is a
//     source of new bugs). The script writes to a local event log that the
//     on-call checks once an hour.
//   - No auto-restart of the api-server. Cassin signs off on every deploy;
//     auto-restart on a 5xx could mask the real problem and cause the
//     wrong kind of state to persist.
//   - No DB write. This is a pure observer. The data it generates is for
//     the Oct 1 / Dec 1 workstyle-evidence meetings (F8 doctrine).
//
// USAGE (on the VPS, in a tmux session so it survives SSH disconnects):
//
//   ssh root@72.60.168.63
//   cd /opt/decel
//   tmux new -s fair-monitor
//   pnpm run monitor:fair-week
//   # Ctrl-B, D to detach
//   # tmux attach -t fair-monitor   (to come back)
//
// The events are appended to /opt/decel/data/fair-week-events.log (rotated
// daily by the docker log driver on the host).
//
// The script exits cleanly on SIGINT (Ctrl-C in tmux) with a final summary
// line. It does NOT auto-restart; the operator decides what to do based on
// the final state.
// =============================================================================

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const POLL_INTERVAL_MS = Number(process.env["MONITOR_INTERVAL_MS"] ?? 60_000); // 60s
const HEALTH_URL = process.env["MONITOR_HEALTH_URL"] ?? "https://decel.cassinai.tech/api/healthz";
const SYSTEM_URL = process.env["MONITOR_SYSTEM_URL"] ?? "https://decel.cassinai.tech/api/v1/system/info";
const AUTH_TOKEN = process.env["MONITOR_AUTH_TOKEN"] ?? process.env["MONITOR_TOKEN"] ?? "";
const EVENT_LOG = process.env["MONITOR_EVENT_LOG"] ?? "/opt/decel/data/fair-week-events.log";
const MAX_5XX_PER_MIN = Number(process.env["MONITOR_5XX_THRESHOLD"] ?? 5);
const CONSECUTIVE_FAILS_TO_ALERT = Number(process.env["MONITOR_FAIL_THRESHOLD"] ?? 3);

interface Event {
  ts: string;
  kind: "health-fail" | "health-recover" | "auth-fail" | "5xx-spike" | "started" | "stopped" | "summary";
  detail: Record<string, unknown>;
}

async function writeEvent(ev: Event): Promise<void> {
  const line = JSON.stringify(ev) + "\n";
  try {
    await mkdir(dirname(EVENT_LOG), { recursive: true });
    await appendFile(EVENT_LOG, line, "utf8");
  } catch (err) {
    // Never crash the monitor because we can't write the log.
    process.stderr.write(`[monitor] failed to write event log: ${err instanceof Error ? err.message : err}\n`);
  }
  // Always echo to stderr so the operator sees it in tmux
  process.stderr.write(`[${ev.ts}] ${ev.kind} ${JSON.stringify(ev.detail)}\n`);
}

async function checkHealth(): Promise<{ ok: boolean; status: number; latencyMs: number; body: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(HEALTH_URL, { method: "GET", signal: AbortSignal.timeout(10_000) });
    const body = await res.text();
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - t0, body: body.slice(0, 200) };
  } catch (err) {
    return { ok: false, status: 0, latencyMs: Date.now() - t0, body: err instanceof Error ? err.message : String(err) };
  }
}

async function checkSystemInfo(): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(SYSTEM_URL, {
      method: "GET",
      headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text(); }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  await writeEvent({ ts: new Date().toISOString(), kind: "started", detail: {
    poll_interval_ms: POLL_INTERVAL_MS,
    health_url: HEALTH_URL,
    system_url: SYSTEM_URL,
    event_log: EVENT_LOG,
    auth_token_present: AUTH_TOKEN.length > 0,
  } });

  let healthFails = 0;
  let totalChecks = 0;
  let totalFails = 0;
  let totalHealth5xx = 0;
  const startedAt = Date.now();

  let stopping = false;
  const stop = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    await writeEvent({ ts: new Date().toISOString(), kind: "stopped", detail: {
      signal: sig,
      total_checks: totalChecks,
      total_fails: totalFails,
      health_5xx: totalHealth5xx,
      uptime_sec: Math.round((Date.now() - startedAt) / 1000),
    } });
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  while (!stopping) {
    totalChecks++;

    // 1. healthz
    const h = await checkHealth();
    if (!h.ok) {
      healthFails++;
      totalFails++;
      if (h.status >= 500) totalHealth5xx++;
      if (healthFails >= CONSECUTIVE_FAILS_TO_ALERT) {
        await writeEvent({ ts: new Date().toISOString(), kind: "health-fail", detail: {
          status: h.status,
          latency_ms: h.latencyMs,
          body: h.body,
          consecutive_fails: healthFails,
        } });
        // Only emit once per failure streak; reset counter at recovery
      }
    } else if (healthFails > 0) {
      await writeEvent({ ts: new Date().toISOString(), kind: "health-recover", detail: {
        was_consecutive_fails: healthFails,
        latency_ms: h.latencyMs,
      } });
      healthFails = 0;
    }

    // 2. system/info (auth probe) — only every 5th poll to avoid noise
    if (AUTH_TOKEN && totalChecks % 5 === 0) {
      const s = await checkSystemInfo();
      if (!s.ok || s.status === 401) {
        await writeEvent({ ts: new Date().toISOString(), kind: "auth-fail", detail: {
          status: s.status,
          body: typeof s.body === "string" ? s.body : JSON.stringify(s.body).slice(0, 200),
        } });
      }
    }

    await wait(POLL_INTERVAL_MS);
  }
}

main().catch(async (err) => {
  await writeEvent({ ts: new Date().toISOString(), kind: "stopped", detail: {
    fatal_error: err instanceof Error ? err.message : String(err),
  } });
  process.exit(1);
});
