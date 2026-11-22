#!/usr/bin/env bash
# publish jb6/react + a react comp to a public GCS bucket, so the page runs with no server of ours:
#   https://storage.googleapis.com/$BUCKET/$VERSION/jb6_packages/react/react-comp-page.html?cmpId=<comp>&urlsToLoad=<file>
# the page's import map is rewritten from jb6's own import map (/jb6_packages/... -> the upload's base url) and
# cut down to the uploaded packages, so an alias in the map means the files are really there, at this version.
#
#   DRY_RUN=yes ...   stages the exact artifact under .tmp/upload-stage/$VERSION with a localhost base url and
#                     touches no cloud: the jb6 web server serves it at /upload-stage/$VERSION, so playwright
#                     and the loggers can test the real thing before it goes up
#
# reads are public, writes stay private - see packages/react/how-to-upload-jb-react-to-the-cloud.md
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-me-west1}"
VERSION="${VERSION:-$(date +%y%m%d-%H%M)}"
DRY_RUN="${DRY_RUN:-no}"
PACKAGES="${PACKAGES:-repo core common react}"
REACT_LIB_FILES="${REACT_LIB_FILES:-react-all-19.2.0-prod.mjs tailwindcss-3.4.17.js lucide-0.5.mjs}"
PAGES="${PAGES:-packages/react/react-comp-page.html}"
BUCKET_DATA="${BUCKET_DATA:-packages/react/cities.json}"
BUCKET_DATA_DIR="${BUCKET_DATA_DIR:-metadata}"   # reference data the page reads; the submissions line lives in data/
DATA_URL="${DATA_URL:-}"
DEMO_COMP="${DEMO_COMP:-bucketForm}"
DEMO_URLS_TO_LOAD="${DEMO_URLS_TO_LOAD:-jb6_packages/react/form-sample.js}"
LOCAL_SERVER="${LOCAL_SERVER:-http://localhost:8083}"

DATA_MAX_AGE="${DATA_MAX_AGE:-300}"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"
if [ "$DRY_RUN" = yes ]; then
  OUT="$ROOT/.tmp/upload-stage/$VERSION"
  STAGED_DATA="$ROOT/.tmp/upload-stage/$BUCKET_DATA_DIR"
  DATA_URL="${DATA_URL:-${LOCAL_SERVER}/bucket}"   # the dry run writes to the localhost bucket simulation
  BASE_URL="${LOCAL_SERVER}/upload-stage/${VERSION}"
  # react-utils picks the react build by hostname: the dry run is served from localhost, so it needs the dev one
  REACT_LIB_FILES="${REACT_LIB_FILES} react-all-19.2.0-dev.mjs"
  rm -rf "$OUT"
else
  BUCKET="${BUCKET:?set BUCKET, e.g. BUCKET=artwaresoft-jb6}"
  OUT="$(mktemp -d)/upload"
  STAGED_DATA="$(dirname "$OUT")/data"
  BASE_URL="https://storage.googleapis.com/${BUCKET}/${VERSION}"
  DATA_URL="${DATA_URL:-https://storage.googleapis.com/${BUCKET}}"   # the bucket root: metadata/ and data/ both hang off it
  trap 'rm -rf "$(dirname "$OUT")"' EXIT
fi

# the page imports bare specifiers, so the import map must carry the base urls of the uploaded packages
IMPORT_MAP="$(BASE_URL="$BASE_URL" PACKAGES="$PACKAGES" REACT_LIB_CDN="${REACT_LIB_CDN:-}" node --import ./packages/core/misc/nodejs-importmap.js --input-type=module -e '
import { coreUtils } from "@jb6/core"
import "@jb6/core/misc/import-map-services.js"
const uploaded = process.env.PACKAGES.split(" ").filter(Boolean)
const { importMap } = await coreUtils.getStaticServeConfig(process.cwd())
const imports = Object.entries(importMap.imports)
  .filter(([alias]) => uploaded.includes(alias.replace(/^@jb6\//, "").replace(/\/$/, "")))
  .map(([alias, url]) => [alias, url.replace(/^\/jb6_packages\//, `${process.env.BASE_URL}/jb6_packages/`)])
// the vendored runtime is not ours: a longer alias wins in an import map, so this one key moves react/tailwind/
// lucide off the bucket onto the shared cdn (free egress) while every @jb6 package stays at this version prefix
if (process.env.REACT_LIB_CDN) imports.push(["@jb6/react/lib/", process.env.REACT_LIB_CDN])
console.log(JSON.stringify({ imports: Object.fromEntries(imports) }))
')"

for package in $PACKAGES; do
  mkdir -p "$OUT/jb6_packages/$package"
  rsync -a --exclude node_modules --exclude lib --exclude tests --exclude '*.tgz' --exclude '*.md' --exclude '*.sh' "packages/$package/" "$OUT/jb6_packages/$package/"
done
if [ -z "${REACT_LIB_CDN:-}" ]; then
  mkdir -p "$OUT/jb6_packages/react/lib"
  for libFile in $REACT_LIB_FILES; do cp "packages/react/lib/$libFile" "$OUT/jb6_packages/react/lib/"; done
fi
# the data is staged outside the version package: code versions are immutable snapshots, data has its own life
mkdir -p "$STAGED_DATA"
for dataFile in $BUCKET_DATA; do cp "$dataFile" "$STAGED_DATA/$(basename "$dataFile")"; done
for page in $PAGES; do
  IMPORT_MAP="$IMPORT_MAP" PAGE_SRC="$page" node -e '
    const fs = require("fs")
    fs.writeFileSync(process.argv[1], fs.readFileSync(process.env.PAGE_SRC, "utf8").split("JB_IMPORT_MAP").join(process.env.IMPORT_MAP))
  ' "$OUT/jb6_packages/${page#packages/}"
done

# every alias in the map must point at a file that was actually staged
BASE_URL="$BASE_URL" OUT="$OUT" node -e '
const fs = require("fs")
const map = JSON.parse(process.argv[1]).imports
const missing = Object.entries(map).filter(([, url]) => url.endsWith(".js"))
  .map(([alias, url]) => [alias, `${process.env.OUT}/${url.slice(process.env.BASE_URL.length + 1)}`])
  .filter(([, path]) => !fs.existsSync(path))
if (missing.length) { console.error("import map points at files that were not staged:", missing); process.exit(1) }
console.log(`import map: ${Object.keys(map).length} aliases, all staged`)
' "$IMPORT_MAP"
echo "staged $(find "$OUT" -type f | wc -l) files, $(du -sh "$OUT" | cut -f1) for version ${VERSION}"

PAGE_URL="${BASE_URL}/jb6_packages/$(echo "$PAGES" | cut -d' ' -f1 | sed 's|^packages/||')?cmpId=${DEMO_COMP}&urlsToLoad=${BASE_URL}/${DEMO_URLS_TO_LOAD}&ctx-bucketUrl=${DATA_URL}"

if [ "$DRY_RUN" = yes ]; then
  echo "dry run - nothing uploaded. the staged artifact is served by the jb6 web server at:"
  echo "  ${PAGE_URL}&logger=uiLogger,bucketLogger"
  echo "harvest it with playwrightHarvest (loggers + network), then rerun without DRY_RUN"
  exit 0
fi

if ! gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" --project "$PROJECT_ID" --location "$REGION" --uniform-bucket-level-access
fi
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" --member=allUsers --role=roles/storage.objectViewer >/dev/null
printf '%s\n' '[{"maxAgeSeconds":3600,"method":["GET","HEAD"],"origin":["*"],"responseHeader":["Content-Type","Content-Length","ETag"]}]' > "$OUT/../cors.json"
gcloud storage buckets update "gs://${BUCKET}" --cors-file="$OUT/../cors.json" >/dev/null

cd "$OUT"
gcloud storage cp -r jb6_packages "gs://${BUCKET}/${VERSION}/" \
  --project "$PROJECT_ID" --gzip-in-flight-all --cache-control="public, max-age=31536000, immutable"

# the data lives beside the versions, not inside one: gs://<bucket>/data/, cached for a window you choose,
# so a data change does not need a code upload and a code upload does not touch the data
gcloud storage cp "$STAGED_DATA"/* "gs://${BUCKET}/${BUCKET_DATA_DIR}/" \
  --project "$PROJECT_ID" --gzip-in-flight-all --cache-control="public, max-age=${DATA_MAX_AGE}"

echo "uploaded ${VERSION}:"
echo "  ${PAGE_URL}"
echo "  form writes need a bucketUrl that accepts PUT, e.g. &ctx-bucketUrl=${LOCAL_SERVER}/bucket"
