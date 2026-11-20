# Deploy Hirevoice to Google Cloud Run

Target: **Cloud Run, `asia-south1` (Mumbai)**. Supabase stays hosted; Cloud Run serves the Next.js app only.

The container is a Next.js standalone build. It listens on `$PORT` (8080) and is stateless — all durable data lives in Supabase.

---

## 0. What you need

- A Google Cloud project with billing enabled.
- `gcloud` CLI authenticated (`gcloud auth login`, `gcloud config set project <id>`).
- A Supabase project (free tier is enough for a pilot).
- Docker is **not** required locally; Cloud Build builds the image.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

---

## 1. Supabase

### 1.1 Create the schema

Open **SQL Editor** in the Supabase dashboard and run, in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_agent_actions.sql`
3. `supabase/migrations/0003_meta.sql`
4. `supabase/seed.sql` (optional demo org — sign up in the app once first)

Or paste `supabase/all-migrations.sql` once. With the database password you can also run it from the repo:

```bash
npm run db:migrate   # reads DATABASE_URL from .env, records applied files
npm run db:check
```

Or with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

### 1.2 Auth redirect URLs

In **Authentication → URL Configuration**:

| Setting | Value |
|---|---|
| Site URL | `https://<cloud-run-url>` |
| Redirect URLs | `https://<cloud-run-url>/auth/callback` and `http://localhost:3000/auth/callback` |

Add the production URL after the first deploy. Until then, email magic-link sign-in works only on the URL listed here. The demo workspace does not need auth.

### 1.3 Keys

From **Project Settings → API**, copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `anon` JWT → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy projects, optional)
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only, never in the image**)

From **Project Settings → Database → Connection string**, copy the **session pooler** URL (port 5432) and percent-encode the password. This becomes `DATABASE_URL`; the app connects with `pg` (node-postgres).

---

## 2. Create the Artifact Registry repository

```bash
gcloud artifacts repositories create hirevoice \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Hirevoice container images"
```

---

## 3. Build and deploy

The public `NEXT_PUBLIC_*` values are compiled into the browser bundle, so they are passed as build args:

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SUPABASE_URL="https://<ref>.supabase.co",_SUPABASE_PUBLISHABLE_KEY="<publishable-key>",_SITE_URL="https://<cloud-run-url>"
```

On the first run you do not know the Cloud Run URL yet. Either:

- deploy with `_SITE_URL` blank, copy the URL from the command output, then redeploy with it; or
- reserve the URL first (step 6) and build once.

The deploy step uses `--allow-unauthenticated` because candidates open invite links without a Google account. Recruiter routes are protected by Supabase session checks in the app, not by Cloud Run IAM.

### Local build (optional)

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>" \
  -t hirevoice .

docker run --rm -p 8080:8080 \
  -e SUPABASE_SERVICE_ROLE_KEY="<service-role>" \
  hirevoice
```

---

## 4. Add server-only secrets

Store the service-role key, the Postgres URL and any optional integrations in Secret Manager, then attach them to the service:

```bash
printf '%s' "<service-role-key>" | gcloud secrets create supabase-service-role --data-file=-
printf '%s' "postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true" \
  | gcloud secrets create supabase-db-url --data-file=-
printf '%s' "<gemini-key>"       | gcloud secrets create gemini-api-key --data-file=-   # optional
printf '%s' "<google-client-secret>" | gcloud secrets create google-oauth-secret --data-file=-  # optional

gcloud run services update hirevoice \
  --region=asia-south1 \
  --update-secrets=SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest,DATABASE_URL=supabase-db-url:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CLIENT_SECRET=google-oauth-secret:latest \
  --update-env-vars=GOOGLE_CLIENT_ID="<client-id>",GOOGLE_REDIRECT_URI="https://<cloud-run-url>/api/google/callback",CONNECTOR_ENCRYPTION_KEY="<32-byte-base64>",GEMINI_API_KEYS="<key1,key2>",GEMMA_API_KEYS="<key1>"
```

`CONNECTOR_ENCRYPTION_KEY` seals Google refresh tokens with AES-256-GCM. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`DATABASE_URL` points the runtime tables at Supabase Postgres. Without it the app falls back to ephemeral SQLite on `/tmp`; in production the repository fails loudly instead of silently splitting data. Set `HIREVOICE_DATA_DIR=/tmp/hirevoice` only if you intentionally want the fallback.

In Google Cloud, enable the Gmail, Google Calendar, Google Meet, Drive, Docs and Sheets APIs, and add `https://<cloud-run-url>/api/google/callback` as an authorised redirect URI. Until tokens are connected, Mail and Calendar show clearly labelled demo data.

Grant the Cloud Run runtime service account access:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding supabase-service-role \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"
```

If you skip this step, the app still runs in seeded demo mode; server routes that need the service role will return a clear "not configured" response.

---

## 5. Verify

```bash
SERVICE_URL=$(gcloud run services describe hirevoice \
  --region=asia-south1 --format='value(status.url)')

curl -I "$SERVICE_URL"
```

Open:

| Route | Expected |
|---|---|
| `https://<url>/` | Landing page, no console errors |
| `https://<url>/api/demo/enter` | Sets demo cookie, redirects to `/app` |
| `https://<url>/app` | Recruiter desk with seeded workspace |
| `https://<url>/app/roles/role-support/candidates/cand-sana` | Evidence screen |
| `https://<url>/practice` | Candidate booth, mic check |
| `https://<url>/sign-in` | Supabase form if keys were supplied; otherwise the demo entry |

Then update Supabase **Site URL** and **Redirect URLs** to the final domain and redeploy with `_SITE_URL` set.

---

## 6. Optional: fixed URL and custom domain

Cloud Run URLs are stable per service and region. For a friendlier address, map a domain (requires domain verification):

```bash
gcloud run domain-mappings create \
  --service=hirevoice \
  --domain=app.example.com \
  --region=asia-south1
```

Then add the DNS records printed by the command and update Supabase redirect URLs.

---

## 7. Operations

```bash
# Logs
gcloud run services logs read hirevoice --region=asia-south1 --limit=100

# Roll back to a previous revision
gcloud run revisions list --service=hirevoice --region=asia-south1
gcloud run services update-traffic hirevoice \
  --region=asia-south1 --to-revisions=<revision-name>=100

# Cost controls
gcloud run services update hirevoice --region=asia-south1 \
  --min-instances=0 --max-instances=4 --concurrency=80
```

`min-instances=0` keeps demo cost near zero but adds a cold start (a few seconds). For a judged demo, set `--min-instances=1` the morning of the event and back to 0 afterwards.

### Sizing

| Setting | Value | Why |
|---|---|---|
| CPU | 1 | SSR + Supabase calls only |
| Memory | 1 GiB | Next.js server + font subsetting at build |
| Port | 8080 | Injected by Cloud Run |
| Timeout | 300 s | Room for score/replay routes |
| Concurrency | 80 | Default, safe for this workload |

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Container failed to start. Port 8080` | `HOSTNAME`/`PORT` not honoured | The Dockerfile sets both; do not override them |
| Sign-in loops back to `/sign-in` | Supabase redirect URL missing | Add `https://<url>/auth/callback` in Supabase |
| `password authentication failed for user "postgres"` | Stale or unencoded database password | Reset it in Database → Settings, percent-encode, update `DATABASE_URL` |
| `/api/integrations` shows `store.active: "sqlite"` | `DATABASE_URL` missing or rejected | Run `npm run db:check` and read `store.error` |
| `Supabase is not configured` | Build args were blank | Rebuild with `_SUPABASE_URL` and `_SUPABASE_ANON_KEY` |
| Demo works, real auth does not | Keys missing at build time | `NEXT_PUBLIC_*` are inlined; a runtime env var alone is not enough |
| `permission denied for table ...` | Migration not run, or missing RLS policy | Re-run `0001_init.sql`; check `is_org_member` |
| 403 on Google connector | OAuth consent screen not configured | Set scopes and test users in Google Cloud Console |

---

## 9. What this deployment is not

- It is a **single stateless service**. Scoring workers, retention sweeps and connector syncs are written as route handlers today; at higher volume move them to Cloud Tasks or Cloud Run jobs.
- The demo workspace is seeded. Supabase auth is wired, but the candidate/score tables are not yet read by the desk UI — `lib/data/workspace.ts` is the seam to add that.
- Cloud Run IAM is not used for recruiter auth. Candidate links must stay public. Keep the app-level checks and RLS in place.
