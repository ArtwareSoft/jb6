#!/usr/bin/env bash
set -euo pipefail

# ─── CONFIG ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
CORE_DIR="$REPO_ROOT/packages/core"
LS_DIR="$REPO_ROOT/packages/lang-service"
EXT_DIR="$REPO_ROOT/hosts/vscode-tgp-lang"


# ─── 1) BUMP EXTENSION VERSION ────────────────────────────────
echo "🔧 Bumping extension patch version…"
pushd "$EXT_DIR" > /dev/null
npm version patch --no-git-tag-version
EXT_VERSION=$(node -p "require('./package.json').version")
echo " → Extension is now at v$EXT_VERSION"
popd > /dev/null

# ─── 2) PACK CORE & LANG-SERVICE ─────────────────────────────
echo "📦 Packing @jb6/core…"
pushd "$CORE_DIR" > /dev/null
CORE_TGZ=$(npm pack)    # e.g. jb6-core-0.1.2.tgz
popd > /dev/null
echo " → $CORE_DIR/$CORE_TGZ"

echo "📦 Packing @jb6/lang-service…"
pushd "$LS_DIR" > /dev/null
LS_TGZ=$(npm pack)
popd > /dev/null
echo " → $LS_DIR/$LS_TGZ"

# ─── 3) UPDATE EXTENSION DEPENDENCIES ────────────────────────
echo "✏️  Updating hosts/vscode-tgp-lang/package.json…"
pushd "$EXT_DIR" > /dev/null

node <<EOF
const fs = require('fs');
const pkg = require('./package.json');
// bump @jb6 deps to the new tarballs:
pkg.dependencies['@jb6/core']         = 'file:../../packages/core/${CORE_TGZ}';
pkg.dependencies['@jb6/lang-service'] = 'file:../../packages/lang-service/${LS_TGZ}';
// write back:
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
console.log('  ✔ package.json updated');
EOF

# ─── 4) INSTALL & BUILD VSIX ─────────────────────────────────
echo "🔧 Installing extension dependencies…"
npm install

echo "📦 Building VSIX…"
npx vsce package
VSIX_FILE=$(ls *.vsix)
echo " → Created $VSIX_FILE"

# ─── 5) (Optional) SIDE-LOAD INTO CURSOR ───────────────────────
read -p "▶️  Install $VSIX_FILE into Cursor now? [y/N] " yn
if [[ "$yn" =~ ^[Yy] ]]; then
  cursor --install-extension "$VSIX_FILE"
  echo "  ✔ Installed into Cursor"
fi

popd > /dev/null

echo "✅ All done! Extension v$EXT_VERSION is ready."
