#!/usr/bin/env bash
# Rebuilds public/us-house-districts-2026.json (TopoJSON, docs/SPEC.md §4.4) from
# the Census TIGER/Line files: npm run districts-map [-- <output file>].
# Requires curl, unzip and mapshaper 0.6.102 (npm i -g mapshaper@0.6.102).
# The downloads (about 50 zip files) go into a temporary folder, removed at the
# end, or into $WORK if it is set (kept, outside the repo).
#
# Sources (U.S. Census Bureau, public domain):
#   - 2026 TIGER/Line, 120th Congressional Districts (boundaries as of Jan 1, 2026),
#     one file per state: https://www2.census.gov/geo/tiger/TIGER2026/CD/
#   - Missouri: 2024 TIGER/Line, 119th Congress (2022-2024 plan). The Supreme Court
#     (Sept 23, 2026) did not allow Missouri's new map for 2026, but the 2026 TIGER
#     files still contain it, so the old plan is used instead.
#   - Shoreline mask: 2024 cartographic boundary states, 1:500k
#     (TIGER districts extend into the Great Lakes and coastal water).
set -euo pipefail
command -v mapshaper >/dev/null || { echo "mapshaper not found: npm i -g mapshaper@0.6.102" >&2; exit 1; }
OUT=${1:-public/us-house-districts-2026.json}
if [ -z "${WORK:-}" ]; then
  WORK=$(mktemp -d)
  trap 'rm -rf "$WORK"' EXIT
fi
mkdir -p "$WORK/zip" "$WORK/shp"
STATES="01 02 04 05 06 08 09 10 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56"
for f in $STATES; do
  curl -fsS -A 'Mozilla/5.0' -o "$WORK/zip/tl_2026_${f}_cd120.zip" "https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_${f}_cd120.zip"
done
curl -fsS -A 'Mozilla/5.0' -o "$WORK/zip/tl_2024_29_cd119.zip" https://www2.census.gov/geo/tiger/TIGER2024/CD/tl_2024_29_cd119.zip
curl -fsS -A 'Mozilla/5.0' -o "$WORK/zip/cb_2024_us_state_500k.zip" https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip
for z in "$WORK"/zip/*.zip; do unzip -oq "$z" -d "$WORK/shp"; done

mapshaper -i "$WORK"/shp/tl_2026_*_cd120.shp combine-files -merge-layers force \
  -each 'CD=CD120FP' -filter-fields STATEFP,CD -o "$WORK/cd2026.shp"
mapshaper -i "$WORK/shp/tl_2024_29_cd119.shp" -each 'CD=CD119FP' -filter-fields STATEFP,CD -o "$WORK/mo2024.shp"
mapshaper -i "$WORK/shp/cb_2024_us_state_500k.shp" \
  -filter '!["11","60","66","69","72","78"].includes(STATEFP)' -dissolve -o "$WORK/land.shp"

mapshaper -require "$(dirname "$0")/fips.cjs" alias=F \
  -i "$WORK/cd2026.shp" "$WORK/mo2024.shp" combine-files -merge-layers force name=districts \
  -filter '/^\d\d$/.test(CD)' \
  -each 'state=F[STATEFP]; id=state+"-"+(CD=="00"?"AL":CD); plan=(STATEFP=="29"?"119":"120")' \
  -filter-fields id,state,STATEFP,plan \
  -clip "$WORK/land.shp" \
  -simplify weighted 6% keep-shapes \
  -clean \
  -dissolve STATEFP + name=states copy-fields=state \
  -o "$OUT" format=topojson quantization=100000 target=districts,states
echo "Wrote $OUT"
