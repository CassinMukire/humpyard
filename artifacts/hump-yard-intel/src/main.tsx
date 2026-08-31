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

// Service worker is INTENTIONALLY NOT REGISTERED in v1.
//
// The earlier /sw.js intercepted /api/* with a "network unavailable → 503"
// fallback, which broke the dossier list when the network call inside the SW
// failed for any reason (CORS preflight race, stale SW from a previous port,
// SW lifecycle quirk). The trust contract (§11.3) requires every fact to be
// fresh from the server — caching API responses is wrong anyway. The static
// shell alone doesn't need an SW for the W36 demo.
//
// For InnoTrans Berlin (W37) we will re-add a SW that:
//   - NEVER intercepts /api/* (pass-through, no fetch handling)
//   - Uses stale-while-revalidate ONLY for the static index.html + assets
//   - Has a clearly-bumped CACHE_VERSION so the v1 SW self-unregisters.
//
// Meanwhile: if a stale SW from an earlier session is still installed, the
// self-unregistering no-op at /sw.js will purge it on next page load.

createRoot(document.getElementById("root")!).render(<App />);
