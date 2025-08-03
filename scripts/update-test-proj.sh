#!/usr/bin/env bash
set -euo pipefail

# ─── 0) CONFIG ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
EXT_DIR="$REPO_ROOT/hosts/test-project"
EXT_LIB="$EXT_DIR/lib"

# List of all packages under packages/ that we want to pack
declare -a PKGS=(repo core lang-service react common testing)
# npm scope prefix
SCOPE="@jb6"

# ─── 0.1) CLEAN & PREPARE EXT_LIB ──────────────────────────────
rm -rf "$EXT_LIB"
mkdir -p "$EXT_LIB"

# ─── 2) PACK EACH PACKAGE INTO EXT_LIB ─────────────────────────
echo "📦 Packing packages into lib/…"
declare -a TGZS=()
for pkg in "${PKGS[@]}"; do
  PKG_DIR="$REPO_ROOT/packages/$pkg"
  if [ ! -d "$PKG_DIR" ]; then
    echo "⚠️  Warning: directory $PKG_DIR does not exist; skipping $pkg"
    TGZS+=("")  # keep array alignment
    continue
  fi

  pushd "$PKG_DIR" > /dev/null
  echo "  • Packing ${SCOPE}/${pkg}…"
  TGZ_NAME=$(npm pack --pack-destination "$EXT_LIB")
  popd > /dev/null

  echo "    → lib/$TGZ_NAME"
  TGZS+=("$TGZ_NAME")
done

# ─── 3) UPDATE EXTENSION DEPENDENCIES in package.json ─────────
echo "✏️  Updating hosts/test-project/package.json…"
pushd "$EXT_DIR" > /dev/null

# Convert PKGS and TGZS bash arrays to JavaScript array literals:
#   ["repo","core","lang-service",...]
JS_ARRAY_OF_PKG_NAMES="$(printf '%s\n' "${PKGS[@]}" | jq -R . | jq -s .)"
#   ["repo-1.0.0.tgz","core-1.2.3.tgz",...]
JS_ARRAY_OF_TGZ_NAMES="$(printf '%s\n' "${TGZS[@]}" | jq -R . | jq -s .)"

node <<EOF
const fs = require("fs");
const pkg = require("./package.json");

const PKGS = $JS_ARRAY_OF_PKG_NAMES;
const TGZS = $JS_ARRAY_OF_TGZ_NAMES;
const SCOPE = "$SCOPE";

for (let i = 0; i < PKGS.length; i++) {
  const name = PKGS[i];
  const tgz  = TGZS[i];
  if (!tgz) continue;  // skip if directory was missing or packing failed
  pkg.dependencies[\`\${SCOPE}/\${name}\`] = \`file:lib/\${tgz}\`;
}

fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("  ✔ package.json updated for all PKGS");
EOF

# ─── 4) CLEAN, INSTALL & BUILD VSIX ────────────────────────────
echo "🧹 Cleaning previous install…"
rm -rf node_modules
rm -f package-lock.json

echo "🔧 Installing extension dependencies…"
npm install

popd > /dev/null

echo "✅ Done!"
