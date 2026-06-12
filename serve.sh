#!/usr/bin/env bash
# Serve the Ghost Forest Atlas locally. server.py serves the static front-end and
# streams raster tiles out of the per-layer MBTiles archives in web/data/.
set -e
cd "$(dirname "$0")"
exec python3 server.py "${1:-8011}"
