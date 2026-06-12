# Ghost Forest Atlas — web app

Interactive map of U.S. coastal forest mortality (2012–2023). A **fully static**
single-page Leaflet front-end (`web/`) that reads per-layer **PMTiles** archives
(`web/data/*.pmtiles`) directly in the browser via HTTP range requests. No backend
— deployable to any static host.

## Local preview

```bash
./serve.sh            # -> http://127.0.0.1:8011/   (runs server.py)
```

`server.py` is **only** a local preview helper: it serves `web/` with range-request
support (PMTiles needs it) and no-cache headers. It is **not** needed to deploy —
GitHub Pages / Cloudflare Pages serve the static files directly and support ranges
natively. After editing, hard-refresh the browser (Cmd+Shift+R).

## Deploy (free, permanent, no PC running)

The site is just the `web/` folder (~146 MB of PMTiles + a few text files). Each
PMTiles file is < 100 MB, so it fits GitHub's limits.

**GitHub Pages** (you already have an account):
```bash
# 1. create a new repo on github.com (Private is fine to start)
# 2. from this folder:
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
# 3. repo Settings -> Pages -> Source: "Deploy from a branch" -> main / root
#    (NOTE: free GitHub Pages requires the repo to be PUBLIC. Private repos need
#     GitHub Pro, OR host on Cloudflare Pages instead — see below.)
```
URL: `https://<you>.github.io/<repo>/`

**Cloudflare Pages** (free; can serve a *private* GitHub repo, optionally gated by
Cloudflare Access): connect the repo at dash.cloudflare.com → Pages, build output
directory = `web`. URL: `https://<name>.pages.dev`.

Cost at this scale: **$0** on either free tier. Basemaps (CARTO street, Esri
satellite) are free third-party services — fine for research traffic, attribution
shown.

> Why PMTiles and not loose tiles: loose XYZ PNGs on this ExFAT drive (~1 MB
> cluster size) wasted **615 GB** for ~1.4 GB of data, plus a `._` sidecar per
> file. The pipeline builds one MBTiles per layer, then packs each into a single
> PMTiles archive the browser reads directly.

## Layers

| Layer | Source raster | Palette | Display range |
|-------|---------------|---------|---------------|
| Mortality rate | `...meanMortRate...everg.tif` | Reds (0 = transparent) | 0 → 5 ha⁻¹ yr⁻¹ |
| Forested wetland only | `...everg_wetland.tif` | Reds (0 = transparent) | 0 → 5 ha⁻¹ yr⁻¹ |
| Uncertainty | `...nYears...everg.tif` | viridis | 1 → 3 (= nYears ÷ 10, orig 10–30) |
| Elevation | `aligned_100m_dem_3dep_full.tif` | grayscale | 0 m black → ≥5 m white (zoom 4–9) |

Basemaps: CARTO Voyager (street) and Esri World Imagery (satellite), toggle in the panel.

## Rebuilding tiles

Source GeoTIFFs are EPSG:5070 (CONUS Albers), 46400×29200, 100 m.
Pipeline per layer: `gdaldem color-relief` (bakes palette + alpha) → `gdalwarp`
to EPSG:3857 → `gdal_translate -of MBTILES` → `gdaladdo` (lower zoom levels).

```bash
cd processing
python3 make_ramps.py                                   # regenerate color ramps
./build_mbtiles.sh <src.tif> ramps/<ramp>.txt ../web/data/<layer>.mbtiles [tr_m]
# then pack the served archive the front-end actually reads:
pmtiles convert ../web/data/<layer>.mbtiles ../web/data/<layer>.pmtiles
```

- `make_ramps.py` — writes `ramps/*.txt` (value R G B A) from matplotlib colormaps.
- `build_mbtiles.sh` — single-layer pipeline; `tr_m` optionally coarsens the warp
  (e.g. `300`) to cap max zoom / size. Used for DEM (full-CONUS) at ~300 m.
- `run_mb_rest.sh` — batch driver for wetland + uncertainty + DEM.
- `pmtiles convert` — `brew install pmtiles`; turns each MBTiles into the single-file
  `.pmtiles` archive the browser reads. The `.mbtiles` are intermediates (gitignored).
- `logs/` — build logs.

To change a palette or range, edit `make_ramps.py`, rerun it, rebuild the layer's
MBTiles, then re-run `pmtiles convert`. Display text (titles, legends, footnote)
lives in `web/app.js` (the `LAYERS` list) and `web/index.html`.
