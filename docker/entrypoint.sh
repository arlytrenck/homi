#!/bin/sh
set -e
# Run as the unprivileged "node" user; if started as root, align ownership of /data first.
if [ "$(id -u)" = "0" ]; then
  [ -n "$PUID" ] && usermod -o -u "$PUID" node 2>/dev/null || true
  [ -n "$PGID" ] && groupmod -o -g "$PGID" node 2>/dev/null || true
  chown -R node:node "$HOMI_DATA" 2>/dev/null || true
  exec gosu node "$@"
fi
exec "$@"
