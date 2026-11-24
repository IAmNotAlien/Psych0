#!/usr/bin/env bash
# Deploy the current PSYCH0 build straight into the EXISTING Vercel project
# "psych0" (account gunter404) — the one that already has the Supabase DB.
#
# Usage (token is never echoed or stored):
#   VERCEL_TOKEN=xxxxxxxx bash scripts/deploy-vercel.sh
set -euo pipefail

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN first — create one at https://vercel.com/account/settings/tokens (scope: Full Account)}"

cd /home/z/my-project
VC="npx -y vercel@latest"

echo "== 1/4 identity check =="
$VC whoami --token "$VERCEL_TOKEN"

echo "== 2/4 linking to existing project psych0 =="
$VC link --yes --project psych0 --token "$VERCEL_TOKEN"

echo "== 3/4 production deploy (uploads source, builds on Vercel) =="
$VC deploy --prod --yes --token "$VERCEL_TOKEN" 2>&1 | tee /tmp/vercel-deploy.log | tail -12
DPL_URL=$(grep -oE 'https://psych0-[a-z0-9-]+\.vercel\.app' /tmp/vercel-deploy.log | tail -1 || true)

echo "== 4/4 health check =="
for url in "${DPL_URL:-https://psych0.vercel.app}" https://psych0.vercel.app; do
  for i in 1 2 3 4 5 6; do
    out=$(curl -s -m 20 "$url/api/health" || true)
    case "$out" in
      *'"ok":true'*) echo "OK $url -> $out"; exit 0 ;;
      *) echo "waiting ($i)..."; sleep 8 ;;
    esac
  done
done
echo "Health check did not pass yet — inspect: vercel logs (read from /tmp/vercel-deploy.log)"
exit 1
