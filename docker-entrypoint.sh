#!/bin/sh
set -e

echo "🚀 Starting Agor development environment..."

# Always run pnpm install on startup (fast if deps already installed, fixes worktree mounts)
# Use CI=true to disable interactive prompts
echo "📦 Checking dependencies..."
CI=true pnpm install --reporter=append-only

# Database initialization is handled by the daemon on startup
# Docker uses anonymous-first mode by default (matching Agor's local-first philosophy)
# To enable authentication, set config manually:
#   docker compose exec agor-dev agor config set daemon.requireAuth true
#   docker compose exec agor-dev agor user create-admin

# Start daemon in background (use DAEMON_PORT env var or default to 3030)
echo "📡 Starting daemon on port ${DAEMON_PORT:-3030}..."
PORT="${DAEMON_PORT:-3030}" pnpm --filter @agor/daemon dev &
DAEMON_PID=$!

# Wait a bit for daemon to start
sleep 3

# Start UI in foreground (this keeps container alive)
echo "🎨 Starting UI on port ${UI_PORT:-5173}..."
VITE_DAEMON_PORT="${DAEMON_PORT:-3030}" pnpm --filter agor-ui dev --host 0.0.0.0 --port "${UI_PORT:-5173}"

# If UI exits, kill daemon too
kill $DAEMON_PID 2>/dev/null || true
