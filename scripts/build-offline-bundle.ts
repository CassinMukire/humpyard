// =============================================================================
// Build the offline bundle (§12.2 — W34 spec)
//
// "Static offline bundle per §12.2 — pnpm build && build:offline-bundle,
//  scp to phone, verify airplane mode works."
//
// This generates a single self-contained HTML file per battle card at
// `dist/offline/<orgId>.html`. Each file:
//   - has the card doctrine baked in (no LLM, no API calls)
//   - has a "Cached at" header so the operator knows when it was generated
//   - is < 50 KB (no inline images, no external JS)
//   - works on airplane Wi-Fi (no fetch at runtime)
//
// USAGE:
//   pnpm run build:offline-bundle
//   → dist/offline/index.html + dist/offline/<orgId>.html
//
// The operator copies `dist/offline/` to their phone. The phone's browser
// can open any card.html directly from the file system.
// =============================================================================

import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listBattleCards, listOrgs } from "../artifacts/api-server/src/lib/store-factory";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIST = path.join(REPO_ROOT, "artifacts", "hump-yard-intel", "dist", "public");
const OUT_DIR = path.join(REPO_ROOT, "dist", "offline");

interface BattleCard {
  org_id: string;
  who_they_are: string;
  why_matters: string;
  known_people: Array<{ person_id: string; role: string; relationship_status: string }>;
  relationship_status: string;
  suggested_questions: string[];
  trap_to_avoid: string;
  sources: Array<{ url: string; title: string; live?: boolean }>;
  kind: string;
  recon_what_to_observe?: string[];
  way_in?: string | null;
  opening?: string | null;
  receipt?: string | null;
  doctrine_version: number;
  doctrine_updated_at: string;
  doctrine_updated_by: string;
}

async function loadBattleCards(): Promise<BattleCard[]> {
  const result = await listBattleCards();
  console.log(`  [debug] listBattleCards returned:`, JSON.stringify(result).slice(0, 200));
  return (result?.cards ?? []) as BattleCard[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderCard(card: BattleCard, orgName: string, cachedAt: string): string {
  const sources = card.sources
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a><br><span class="url">${escapeHtml(s.url)}</span></li>`,
    )
    .join("");

  const questions = card.suggested_questions
    .map((q, i) => `<li><span class="num">${i + 1}.</span> ${escapeHtml(q)}</li>`)
    .join("");

  const people = card.known_people
    .map(
      (p) =>
        `<li><span class="pid">${escapeHtml(p.person_id)}</span> <span class="role">${escapeHtml(p.role)}</span> <span class="status">(${escapeHtml(p.relationship_status)})</span></li>`,
    )
    .join("");

  const d2Block =
    card.way_in || card.opening || card.receipt
      ? `<section class="d2">
        <h2>Cassin-curated notes (D2)</h2>
        ${card.way_in ? `<p><b>Way in:</b> ${escapeHtml(card.way_in)}</p>` : ""}
        ${card.opening ? `<p><b>Opening (first 30s):</b> ${escapeHtml(card.opening)}</p>` : ""}
        ${card.receipt ? `<p><b>Receipt (success looks like):</b> ${escapeHtml(card.receipt)}</p>` : ""}
       </section>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(orgName)} — DECEL Battle Card</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; padding: 16px; background: #0a0a0a; color: #e5e5e5; }
  header { border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px 0; color: #fff; }
  .meta { font-size: 11px; color: #888; font-family: monospace; }
  .cached { display: inline-block; background: #166534; color: #fff; padding: 2px 8px; font-size: 10px; font-family: monospace; margin-left: 8px; border-radius: 2px; }
  .badge { display: inline-block; background: #1e3a8a; color: #fff; padding: 2px 6px; font-size: 10px; font-family: monospace; text-transform: uppercase; margin-right: 6px; border-radius: 2px; }
  .badge.recon { background: #991b1b; }
  .badge.watchlist { background: #6b21a8; }
  section { margin-bottom: 18px; padding: 12px; background: #171717; border: 1px solid #2a2a2a; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 8px 0; font-family: monospace; }
  p, li { font-size: 14px; line-height: 1.5; }
  ol, ul { padding-left: 20px; margin: 4px 0; }
  .trap { background: #422006; border-color: #92400e; }
  .trap h2 { color: #fb923c; }
  .d2 { background: #0c1e3f; border-color: #1e3a8a; }
  .url { color: #666; font-size: 11px; font-family: monospace; word-break: break-all; }
  .pid { color: #60a5fa; font-family: monospace; font-size: 12px; }
  .role { color: #e5e5e5; }
  .status { color: #888; font-size: 11px; }
  .num { color: #888; font-family: monospace; }
  footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #333; font-size: 10px; color: #666; font-family: monospace; }
</style>
</head>
<body>
<header>
  <div>
    <span class="badge ${card.kind === "recon" ? "recon" : card.kind === "watchlist_plus" ? "watchlist" : ""}">${escapeHtml(card.kind)}</span>
    <span class="cached">OFFLINE</span>
  </div>
  <h1>${escapeHtml(orgName)}</h1>
  <div class="meta">org/${escapeHtml(card.org_id)} · doctrine v${card.doctrine_version} · updated ${escapeHtml(card.doctrine_updated_at.slice(0, 10))} by ${escapeHtml(card.doctrine_updated_by)}</div>
  <div class="meta">cached at: ${escapeHtml(cachedAt)}</div>
</header>

<section>
  <h2>Who they are</h2>
  <p>${escapeHtml(card.who_they_are)}</p>
</section>

<section>
  <h2>Why this matters</h2>
  <p>${escapeHtml(card.why_matters)}</p>
</section>

${d2Block}

<section class="trap">
  <h2>⚠ Trap to avoid</h2>
  <p>${escapeHtml(card.trap_to_avoid)}</p>
</section>

${
  questions
    ? `<section>
  <h2>Suggested questions</h2>
  <ol>${questions}</ol>
</section>`
    : ""
}

${
  card.recon_what_to_observe && card.recon_what_to_observe.length > 0
    ? `<section>
  <h2>What to observe</h2>
  <ol>${card.recon_what_to_observe.map((r, i) => `<li><span class="num">${i + 1}.</span> ${escapeHtml(r)}</li>`).join("")}</ol>
</section>`
    : ""
}

${
  people
    ? `<section>
  <h2>Known people</h2>
  <ul>${people}</ul>
</section>`
    : ""
}

${
  sources
    ? `<section>
  <h2>Sources</h2>
  <ul>${sources}</ul>
</section>`
    : ""
}

<footer>
  DECEL Intelligence Platform · offline bundle · v1 · ${escapeHtml(cachedAt)}
</footer>
</body>
</html>`;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const cards = await loadBattleCards();
  const cachedAt = new Date().toISOString();
  console.log(`OFFLINE bundle build`);
  console.log(`  ${cards.length} cards`);
  console.log(`  out: ${path.relative(REPO_ROOT, OUT_DIR)}`);

  // Render each card
  const indexEntries: Array<{ org_id: string; name: string; kind: string; file: string }> = [];
  const orgs = await listOrgs();
  for (const card of cards) {
    // Look up the org name. The card has org_id only; we can fetch the org.
    const org = orgs.find((o) => o.id === card.org_id);
    const name = org?.name ?? card.org_id;
    const file = `${card.org_id.replace(/[^a-z0-9-]/gi, "_")}.html`;
    const html = renderCard(card, name, cachedAt);
    await writeFile(path.join(OUT_DIR, file), html, "utf8");
    indexEntries.push({ org_id: card.org_id, name, kind: card.kind, file });
    console.log(`  ✓ ${card.org_id} (${name}) → ${file}`);
  }

  // Index page
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DECEL Battle Cards — Offline Index</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; padding: 16px; background: #0a0a0a; color: #e5e5e5; }
  h1 { font-size: 18px; color: #fff; }
  .meta { font-size: 11px; color: #888; font-family: monospace; margin-bottom: 16px; }
  ul { list-style: none; padding: 0; }
  li { margin-bottom: 8px; padding: 12px; background: #171717; border: 1px solid #2a2a2a; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .badge { display: inline-block; background: #1e3a8a; color: #fff; padding: 2px 6px; font-size: 10px; font-family: monospace; text-transform: uppercase; margin-right: 6px; border-radius: 2px; }
  .badge.recon { background: #991b1b; }
  .badge.watchlist { background: #6b21a8; }
  footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #333; font-size: 10px; color: #666; font-family: monospace; }
</style>
</head>
<body>
<h1>DECEL Battle Cards — Offline Index</h1>
<div class="meta">cached at: ${escapeHtml(cachedAt)} · ${indexEntries.length} cards · works on airplane Wi-Fi</div>
<ul>
${indexEntries
  .map(
    (e) =>
      `<li><span class="badge ${e.kind === "recon" ? "recon" : e.kind === "watchlist_plus" ? "watchlist" : ""}">${escapeHtml(e.kind)}</span> <a href="${escapeHtml(e.file)}">${escapeHtml(e.name)}</a> <span class="meta">(${escapeHtml(e.org_id)})</span></li>`,
  )
  .join("\n")}
</ul>
<footer>DECEL Intelligence Platform · v1 · offline bundle · no LLM, no API calls</footer>
</body>
</html>`;
  await writeFile(path.join(OUT_DIR, "index.html"), indexHtml, "utf8");

  // Sizes
  console.log(`\n=== Bundle summary ===`);
  let totalBytes = 0;
  for (const file of ["index.html", ...indexEntries.map((e) => e.file)]) {
    const p = path.join(OUT_DIR, file);
    if (existsSync(p)) {
      const s = statSync(p).size;
      totalBytes += s;
      console.log(`  ${file.padEnd(50)} ${(s / 1024).toFixed(1)} KB`);
    }
  }
  console.log(`  total: ${(totalBytes / 1024).toFixed(1)} KB (${indexEntries.length + 1} files)`);
  console.log(`\nDone. Copy ${path.relative(REPO_ROOT, OUT_DIR)}/ to the operator's phone.`);
}

main().catch((err) => {
  console.error("Offline bundle build failed:", err);
  process.exit(1);
});
