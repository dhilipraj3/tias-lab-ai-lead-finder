# TIAS Lab AI Lead Finder — Cloudflare Workers + D1

This repository contains a Next.js App Router dashboard and API routes deployed to Cloudflare Workers with OpenNext, backed by Cloudflare D1.

## Important limitations

- Deploy the **full-stack Worker** for the application. Deploying `public/` to Pages only serves the standalone HTML file; it does not run the Next.js API routes or use the D1 database.
- A Cloudflare D1 database ID must be added to `wrangler.toml` before deployment. Do not use the placeholder value.
- Hacker News and Reddit connectors do not need API keys but may return no results or be rate-limited. Google Custom Search and SAM.gov require their own API credentials. Leads are opportunities to investigate, not guaranteed buyers.
- The dashboard/API currently has no built-in user login. Before public use, protect the subdomain using Cloudflare Zero Trust Access (recommended for an internal tool). Do not treat an unlisted URL as security.

## Prerequisites

1. Install Node.js 20 or newer and npm.
2. Have a Cloudflare account with `tiaslab.in` added as an active zone if you plan to use `leadfinder.tiaslab.in`.
3. Open a terminal in this project folder.

## 1. Install dependencies

```bash
npm install
npx wrangler login
```

## 2. Create the D1 database

```bash
npx wrangler d1 create tias-lead-finder-db
```

Cloudflare prints a database ID. Copy the ID into `wrangler.toml` here:

```toml
[[d1_databases]]
binding = "DB"
database_name = "tias-lead-finder-db"
database_id = "PASTE_THE_REAL_ID_HERE"
migrations_dir = "migrations"
```

Do not change `binding = "DB"`; the API code expects that binding.

## 3. Apply the database schema

```bash
npx wrangler d1 migrations apply tias-lead-finder-db --remote
```

Confirm the migration completes successfully before deploying.

## 4. Add API credentials (optional)

Add only the integrations you have configured. Each command prompts you to enter the secret securely:

```bash
npx wrangler secret put GOOGLE_CSE_API_KEY
npx wrangler secret put GOOGLE_CSE_CX
npx wrangler secret put SAM_GOV_API_KEY
```

Google Places integration is not currently included in the active sync list. PageSpeed audit API route can be used separately; configure `GOOGLE_PAGESPEED_API_KEY` if needed. Never commit API keys to Git or put them in frontend code.

## 5. Build and test

```bash
npm run cf:build
npm run cf:preview
```

Open the local URL shown by Wrangler (usually `http://localhost:8787`). Test the dashboard and API before deploying. In a second terminal, the D1 schema can be checked with:

```bash
npx wrangler d1 execute tias-lead-finder-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

## 6. Deploy to Cloudflare Workers

```bash
npm run cf:deploy
```

Wrangler prints the deployed Worker URL, typically ending in `.workers.dev`. Open it and test the app. If the build fails, do not continue to domain setup until the error is fixed.

Current production URL: <https://tias-lab-ai-lead-finder.dhilip-raj3.workers.dev>

Quick health check (should report `"mode":"LIVE_PRODUCTION_D1"`):

```bash
curl https://tias-lab-ai-lead-finder.dhilip-raj3.workers.dev/api/leads
```

## 7. Attach your subdomain (example: leadfinder.tiaslab.in)

1. In the Cloudflare dashboard, open **Workers & Pages**.
2. Select the deployed Worker named `tias-lab-ai-lead-finder`.
3. Open **Settings** (or **Domains & Routes**, depending on dashboard layout).
4. Choose **Add** / **Add Custom Domain**.
5. Enter `leadfinder.tiaslab.in` and confirm. Cloudflare will provision the route and TLS certificate if `tiaslab.in` is active in this Cloudflare account and the hostname is available.
6. Wait for the domain status to become active, then visit `https://leadfinder.tiaslab.in`.

For a Worker custom domain, prefer the **Workers & Pages → Worker → Settings → Domains & Routes → Add Custom Domain** flow. Do not create a separate Pages project for this full-stack Next.js app. If Cloudflare asks you to create a DNS record manually, follow the exact target it displays rather than guessing a CNAME target.

## 8. Auto-deploy on git push (Cloudflare Workers Builds)

Pushes to `main` are built and deployed automatically by **Cloudflare's git
integration (Workers Builds)** — this project does **not** use GitHub Actions
(there is no `.github/` directory). To connect or change the repository, open
**Cloudflare dashboard → Workers & Pages → `tias-lab-ai-lead-finder` →
Settings → Builds → Git repository → Manage**.

Cloudflare runs two commands on every push to `main`:

| Phase | Command | What it does |
|-------|---------|--------------|
| Build | `npm run build` | `next build`, then `postbuild` → `opennextjs-cloudflare build` |
| Deploy | `npx wrangler deploy` | OpenNext detects the project and runs `opennextjs-cloudflare deploy` |

### Bindings come from `wrangler.toml`

`wrangler.toml` is the **source of truth** for every deploy. The D1 binding,
AI binding, assets and variables are all read from it, so the real
`database_id` must be committed (see step 2). If the placeholder value is
present, the deploy fails with:

```
binding DB of type d1 must have a valid `database_id` specified [code: 10021]
```

### If a build fails

Check which commit the build checked out. A build launched from an older
commit still uses the older `wrangler.toml`. To force a build of the current
`main`, push any new commit (an empty commit works):

```bash
git commit --allow-empty -m "Trigger Cloudflare build"
git push origin main
```

Then watch **Workers & Pages → `tias-lab-ai-lead-finder` → Deployments**.

### One-time setup that must be done before the first git deploy

1. **Create the D1 database** and put its real ID in `wrangler.toml` (step 2).
2. **Apply the migration** (step 3):
   ```bash
   npx wrangler d1 migrations apply tias-lead-finder-db --remote
   ```
3. **Add runtime secrets** (never commit these to Git):
   ```bash
   npx wrangler secret put GOOGLE_CSE_API_KEY
   npx wrangler secret put GOOGLE_CSE_CX
   npx wrangler secret put SAM_GOV_API_KEY
   ```

## 9. Attach your subdomain (example: leadfinder.tiaslab.in)

1. In the Cloudflare dashboard, open **Workers & Pages**.
2. Select the deployed Worker named `tias-lab-ai-lead-finder`.
3. Open **Settings → Domains & Routes → Add Custom Domain**.
4. Enter `leadfinder.tiaslab.in` and confirm.

## 10. Protect the app before sharing it

This project does not implement login. If only you or your team should use it, create a Cloudflare Zero Trust Access application for `leadfinder.tiaslab.in` and allow only your email addresses or organization identity. Test access to both the dashboard and `/api/*` routes. Do not expose the sync endpoint publicly without access control.

## Active source connectors

- Hacker News Algolia search
- Reddit public JSON search
- Google Custom Search JSON API (requires `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX`)
- SAM.gov opportunities API (requires `SAM_GOV_API_KEY`)

The database also contains source records for additional integrations, but those records alone do not mean an integration is active. Review sync results and verify the source's terms, rate limits, and data quality before using leads commercially.
