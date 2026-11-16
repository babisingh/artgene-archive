# ArtGene Archive: Deploy to Railway

**TL;DR:** Connect your GitHub account to Railway.app, Railway auto-deploys artgene-archive with hosted Postgres, then deposit the 20 backfill records.

---

## Why Railway?

- **No local setup:** Postgres, API, dashboard all hosted
- **GitHub integration:** Auto-deploys on push to main
- **Free tier:** Sufficient for staging/testing
- **Environment variables:** Secrets managed securely
- **Public URL:** API accessible from anywhere

---

## Prerequisites

1. **GitHub account** (you have this)
2. **Railway account** (free, sign up with GitHub)
3. **20 backfill draft records** (artgene_backfill_drafts.tar.gz from Claude Science)
4. **genome-watch deposit tool** (cloned to ~/genome-watch on your Mac)

---

## Step 1: Prepare GitHub Repos

Both repos must be up-to-date on main branch:

### artgene-archive

Add these files to the root if missing:

**`dev-up.sh`** (for local development; already in repo or provided by Claude)

**`AUDIT.md`** (findings and fixes from the audit phase)

**`PROPOSALS.md`** (10 ranked enhancement proposals)

**`DEPLOY_TO_RAILWAY.md`** (this file, for future reference)

Commit and push:
```bash
cd ~/artgene-archive
git add dev-up.sh AUDIT.md PROPOSALS.md DEPLOY_TO_RAILWAY.md
git commit -m "docs: add audit findings, proposals, and deployment guide"
git push origin main
```

### genome-watch

Verify the fixed tools are committed:

```bash
cd ~/genome-watch
git status
# Should show no changes (fixes already committed)
# If not, commit them:
git add tools/check_draft.py tools/stage_sequences.py tools/deposit_draft.py
git commit -m "fix: archive validation, duplicate-key detection, status tiers"
git push origin main
```

---

## Step 2: Deploy on Railway

1. **Go to** https://railway.app
2. **Sign in with GitHub** (or create account)
3. **New Project** → **Deploy from GitHub repo**
4. **Select** `artgene-archive`
5. **Railway builds and deploys automatically**

This creates:
- PostgreSQL 15 (managed database)
- Node.js service (dashboard)
- Python service (API)

Wait for all services to show "✓ Running". 

---

## Step 3: Get Your API Key and URL

1. Click on the **API service** in Railway dashboard
2. Go to **Logs** tab → search for "Your dev API key"
3. Copy the printed key

Also from the **API service**:
1. Click **Settings** → **Network**
2. Copy the **Public URL** (e.g., `https://artgene-prod-abc123.railway.app`)

Save both:
```
API_KEY=agc_xyz...
API_URL=https://artgene-prod-abc123.railway.app
```

---

## Step 4: Deposit the 20 Backfill Records

1. **Extract drafts** (on your Mac):
```bash
cd ~/genome-watch
tar xzf artgene_backfill_drafts.tar.gz -C drafts/
# Verify: should have 20 .md files in drafts/
```

2. **Install dependencies** (if not already done):
```bash
cd ~/genome-watch
pip3 install -r requirements.txt
```

3. **Set environment variable**:
```bash
export ARTGENE_API_KEY="<your-key-from-railway-logs>"
```

4. **Deposit all records**:
```bash
cd ~/genome-watch
for draft in drafts/*.md; do
  echo "Depositing: $(basename "$draft")"
  python3 tools/deposit_draft.py "$draft" \
    --api-url https://artgene-prod-abc123.railway.app \
    --post
done
```

Each record will print an `AGC-2026-NNNNNN` registry ID on success.

**BUT WAIT:** Records are `status: reviewed`. The catalogue will refuse them unless you change status to `published` (which means you've published a Substack post about each). 

**Options:**
- **A. Publish Substack posts first**, then change all drafts to `status: published` and re-deposit
- **B. Ask the archive maintainer** if `status: artgene-verified` bypasses the per-post gate
- **C. Set all drafts to `status: proposed`** (not yet reviewed) if that's acceptable

For now, **verify the API works without depositing**:
```bash
curl https://artgene-prod-abc123.railway.app/api/v1/health
# Should return: {"ok": true}
```

---

## Step 5: Verify in the Dashboard

1. **Go to** https://artgene-prod-abc123.railway.app (or :3000)
2. **Look for** the ArtGene dashboard (Remix/React frontend)
3. **Search the catalogue** (should be empty until you deposit)

---

## Post-Deployment: Custom Domain (Optional)

Railway lets you add a custom domain:

1. **Railway Dashboard** → **API service** → **Settings** → **Custom Domain**
2. Add `api.artgene.yoursite.com`
3. Update DNS per Railway's instructions

---

## Troubleshooting

### "API service won't start"
- Check **Logs** tab for database connection errors
- Verify **DATABASE_URL** is set (Railway auto-injects this)
- Restart the service

### "Deposit fails with 401 Unauthorized"
- Verify **ARTGENE_API_KEY** is correct (copy from logs exactly)
- Verify **API_URL** is correct (use the public URL from Railway)

### "deposit_draft.py: No module named 'sentinel_api'"
- You're running from the wrong directory. Must be `cd ~/genome-watch` before running
- The tool is in `genome-watch/tools/`, not `artgene-archive/`

### "REFUSED: status is 'reviewed'"
- Change draft status before depositing, or clarify the status tier with the archive maintainer

---

## What's Next?

After deposit:
1. **Verify records appear** in the catalogue (`curl <API_URL>/api/v1/catalogue`)
2. **Check the dashboard** for the new records
3. **Set up DNS** if you want a custom domain
4. **Consider the enhancement proposals** in PROPOSALS.md for future work

---

## Summary

| Step | What | Where | Time |
|------|------|-------|------|
| 1 | Commit & push repos | GitHub | 5 min |
| 2 | Deploy on Railway | Railway.app | 2 min |
| 3 | Get API key & URL | Railway logs/settings | 2 min |
| 4 | Extract & deposit | Your Mac terminal | 10 min |
| 5 | Verify in dashboard | Browser | 2 min |

**Total: ~20 minutes to a live catalogue.**

---

## Questions for Claude Code

If you're asking Claude Code to help with this, provide:
1. GitHub repo URLs (artgene-archive, genome-watch)
2. The 20 backfill draft files (or the .tar.gz)
3. A Railway.app account (free; sign up takes 1 min)
4. This guide

Then tell Claude Code:
> "Deploy artgene-archive to Railway.app, extract the 20 backfill drafts, and deposit them to the catalogue. Skip the deployment if there are errors (don't force it); just report what needs to be fixed."
