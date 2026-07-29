# AI Question Bank Agent Notes

This project is trusted for local Codex work. Prefer the configured MCP servers and local CLIs before asking the user to open dashboards.

- Vercel: use the `vercel` MCP server for project, deployment, environment, log, and documentation tasks. Use `npx vercel ...` only when a CLI command is the simplest reliable path.
- Supabase: use the project-scoped `supabase` MCP server for database inspection, SQL, functions, and docs. The project ref is `yswbsnpltlqmpuxryewv`.
- GitHub: use the configured `github` MCP server, connected GitHub tools, or `gh` CLI for repository, pull request, issue, and Actions work.
- Never print or commit secrets. Keep `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CRON_SECRET`, Vercel tokens, and Supabase access tokens out of source files.
- Before schema or data mutations, inspect the current state and use a small, reversible change. Report exactly what changed.
