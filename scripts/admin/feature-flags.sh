#!/bin/bash
# Feature Flag Admin Script (moved from root scripts/)
# This is a wrapper that calls the existing feature-admin.sh script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Call the existing feature-admin.sh script
exec "$PROJECT_ROOT/scripts/feature-admin.sh" "$@"