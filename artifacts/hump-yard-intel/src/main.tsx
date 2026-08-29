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

createRoot(document.getElementById("root")!).render(<App />);
