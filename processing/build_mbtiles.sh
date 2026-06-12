#!/usr/bin/env bash
# Build a single MBTiles archive for one layer (one file = no ExFAT cluster waste):
#   gdaldem color-relief (lazy VRT) -> gdalwarp EPSG:3857 -> gdal_translate MBTILES -> gdaladdo
#
# Usage: build_mbtiles.sh <src.tif> <ramp.txt> <out.mbtiles> [tr_meters]
#   tr_meters: optional warp resolution (e.g. 200) to cap max zoom / size.
set -euo pipefail

SRC="$1"; RAMP="$2"; OUT="$3"; TR="${4:-}"
NAME="$(basename "$OUT" .mbtiles)"
TMP="$(dirname "$0")/_tmp"; mkdir -p "$TMP" "$(dirname "$OUT")"

CR_VRT="$TMP/${NAME}_cr.vrt"
WARP="$TMP/${NAME}_3857.tif"

echo "[$NAME] 1/4 color-relief ..."
gdaldem color-relief -alpha -of VRT "$SRC" "$RAMP" "$CR_VRT"

echo "[$NAME] 2/4 warp -> EPSG:3857 ${TR:+(@ ${TR} m)} ..."
gdalwarp -overwrite -t_srs EPSG:3857 -r near ${TR:+-tr $TR $TR} \
  -multi -wo NUM_THREADS=ALL_CPUS \
  -co TILED=YES -co COMPRESS=DEFLATE -co BIGTIFF=YES \
  -dstalpha "$CR_VRT" "$WARP"

echo "[$NAME] 3/4 -> MBTILES ..."
rm -f "$OUT"
gdal_translate -of MBTILES "$WARP" "$OUT" \
  -co TILE_FORMAT=PNG -co RESAMPLING=NEAREST

echo "[$NAME] 4/4 overviews (lower zooms) ..."
gdaladdo -r average "$OUT" 2 4 8 16 32 64 128 256

rm -f "$CR_VRT" "$WARP" "$WARP.aux.xml"
echo "[$NAME] DONE -> $OUT"
gdalinfo "$OUT" 2>/dev/null | grep -E "Size is|ZOOM" | head -3
ls -lh "$OUT" | awk '{print "  file size:", $5}'
