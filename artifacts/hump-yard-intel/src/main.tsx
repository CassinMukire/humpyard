import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Bridge the localStorage token (set by /login) into the customFetch Bearer
// header. The cookie path also works for same-origin, but the Bearer token
// keeps things alive when cookies are blocked (Safari ITP, 3rd-party iframes,
// cross-origin dev with the Vite proxy).
setAuthTokenGetter(() => {
  try {
    return localStorage.getItem("decel_session_token");
  } catch {
    return null;
  }
});

// PWA — service worker for offline shell at InnoTrans (W37 deliverable).
// Strategy: stale-while-revalidate for the static UI, network-only for /api/*.
// See artifacts/hump-yard-intel/public/sw.js. Registration is best-effort;
// a SW registration failure must NOT block the SPA from loading.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Optional: surface a toast when an updated SW is waiting.
        if (reg.waiting) {
          reg.waiting.postMessage("SKIP_WAITING");
        }
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              // A new SW is installed and waiting. Trigger the swap on next
              // navigation. We do not interrupt the current page.
              console.info("[sw] update available, will activate on next load");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[sw] registration failed:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
