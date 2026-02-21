#!/bin/bash
# helpers/reset-rate-limits.sh
# Resets guest rate limit entries in the database for e2e testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Resetting guest rate limits for e2e testing..."

# Source .env.local to get Supabase credentials
set -a
source "$PROJECT_DIR/.env.local" 2>/dev/null || true
set +a

# Default Supabase local values
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:54321}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_KEY" ]]; then
    echo "Error: SUPABASE_SERVICE_ROLE_KEY not found"
    exit 1
fi

# Delete guest rate limit entries using Supabase REST API
response=$(curl -s -X DELETE "$SUPABASE_URL/rest/v1/rate_limits?key=eq.guest-analysis" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json")

if [[ $? -eq 0 ]]; then
    echo "✓ Guest rate limits cleared successfully"
    echo "  Anonymous users can now analyze 1 video again"
else
    echo "✗ Failed to clear rate limits"
    echo "  Response: $response"
    exit 1
fi
