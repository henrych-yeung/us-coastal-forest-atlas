#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
D=..
bash build_mbtiles.sh "$D/aligned_100m_raster_merged_meanMortRate_2012_2023_conf0d5_masked_noFireMort_filled_goodNAIPp75_everg_wetland.tif" ramps/mortality.txt ../web/data/wetland.mbtiles
bash build_mbtiles.sh "$D/aligned_100m_merged_nYears_100m_conf0d5_everg.tif" ramps/uncertainty.txt ../web/data/uncertainty.mbtiles
bash build_mbtiles.sh "$D/aligned_100m_dem_3dep_full.tif" ramps/dem.txt ../web/data/dem.mbtiles 300
echo "MB_REST_DONE"
