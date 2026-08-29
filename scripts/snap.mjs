// Quick screenshot of the 4 v1 pages for visual verification.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = join(process.cwd(), "screenshots");
await mkdir(OUT, { recursive: true });

const pages = [
  { path: "/", name: "home" },
  { path: "/dossiers", name: "dossiers-list" },
  { path: "/dossiers/pl", name: "dossier-detail" },
  { path: "/review-queue", name: "review-queue" },
  { path: "/battle-cards", name: "battle-cards" },
  { path: "/login", name: "login" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

for (const p of pages) {
  console.log(`navigating to http://localhost:8080${p.path}`);
  try {
    await page.goto(`http://localhost:8080${p.path}`, { waitUntil: "networkidle", timeout: 15_000 });
  } catch (e) {
    console.log(`  (networkidle timed out for ${p.path}, continuing)`);
  }
  await page.waitForTimeout(800);
  const file = join(OUT, `${p.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  saved ${file}`);
}

await browser.close();
console.log("done");
