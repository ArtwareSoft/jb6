#!/usr/bin/env bash
set -euo pipefail

# ─── 0) CONFIG ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
CORE_DIR="$REPO_ROOT/packages/core"
LS_DIR="$REPO_ROOT/packages/lang-service"
EXT_DIR="$REPO_ROOT/hosts/vscode-tgp-lang"
EXT_LIB="$EXT_DIR/lib"

# clean & recreate extension-local lib folder (gitignored)
rm -rf "$EXT_LIB"
mkdir -p "$EXT_LIB"

# ─── 1) BUMP EXTENSION VERSION ────────────────────────────────
echo "🔧 Bumping extension patch version…"
pushd "$EXT_DIR" > /dev/null
npm version patch --no-git-tag-version
EXT_VERSION=$(node -p "require('./package.json').version")
echo " → Extension is now at v$EXT_VERSION"
popd > /dev/null

# ─── 2) PACK CORE & LANG-SERVICE into EXT_LIB ─────────────────
echo "📦 Packing @jb6/core into lib/…"
pushd "$CORE_DIR" > /dev/null
CORE_TGZ=$(npm pack --pack-destination "$EXT_LIB")
popd > /dev/null
echo " → lib/$CORE_TGZ"

echo "📦 Packing @jb6/lang-service into lib/…"
pushd "$LS_DIR" > /dev/null
LS_TGZ=$(npm pack --pack-destination "$EXT_LIB")
popd > /dev/null
echo " → lib/$LS_TGZ"

# ─── 3) UPDATE EXTENSION DEPENDENCIES ────────────────────────
echo "✏️  Updating hosts/vscode-tgp-lang/package.json…"
pushd "$EXT_DIR" > /dev/null

node <<EOF
const fs = require('fs');
const pkg = require('./package.json');
pkg.dependencies['@jb6/core']         = 'file:lib/${CORE_TGZ}';
pkg.dependencies['@jb6/lang-service'] = 'file:lib/${LS_TGZ}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
console.log('  ✔ package.json updated');
EOF

# ─── 4) CLEAN & INSTALL & BUILD VSIX ─────────────────────────
echo "🧹 Cleaning previous install…"
rm -rf node_modules
rm -f package-lock.json

echo "🔧 Installing extension dependencies…"
npm install

echo "📦 Building VSIX…"
npx vsce package
VSIX_FILE=$(ls *.vsix)
echo " → Created $VSIX_FILE"

popd > /dev/null

echo "✅ Done! Extension v$EXT_VERSION is ready."
