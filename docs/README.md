# DECEL Intelligence Platform — Docs

Start here. The full project brief is in `AGENTS.md`. This folder has the
reference docs for anyone touching the code.

| File | What's in it |
|---|---|
| [API.md](./API.md) | Every endpoint — path, method, auth, body, response |
| [DATABASE.md](./DATABASE.md) | Every table — columns, types, indexes, what they store |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How data flows from request → DB → UI |
| [ENV.md](./ENV.md) | Every env var — what it's for, when to set it |
| [SPRINT.md](./SPRINT.md) | Sprint plan + scope cuts + open gaps |
| [DECISIONS.md](./DECISIONS.md) | Open contract gaps + what to do about them |

## TL;DR for new people

1. This is a sales-intelligence tool for DECEL. Cassin (the salesperson) uses
   it to research railway companies in Poland, Germany, and Central Asia
   before meetings at InnoTrans Berlin (Sep 22–25).
2. Every fact is sourced and confidence-tagged. A fact with no source
   CANNOT render. This is the only hard rule.
3. Backend is Express 5 + Drizzle/Postgres. Frontend is React 19 + Vite.
4. Code freeze Sep 18, fair Sep 22–25, slip call Sep 8.

If you only read one file, read `AGENTS.md`.
