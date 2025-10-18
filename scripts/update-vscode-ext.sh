#!/usr/bin/env bash
set -euo pipefail

echo "🔧 ensure you bumped the calver of the extension version in hosts/vscode-tgp-lang/package.json"
# ─── 0) CONFIG ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
EXT_DIR="$REPO_ROOT/hosts/vscode-tgp-lang"
EXT_LIB="$EXT_DIR/lib"

# List of all packages under packages/ that we want to pack
declare -a PKGS=(repo core lang-service react)
# npm scope prefix
SCOPE="@jb6"

# ─── 0.1) CLEAN & PREPARE EXT_LIB ──────────────────────────────
rm -rf "$EXT_LIB"
mkdir -p "$EXT_LIB"

# ─── 1) BUMP EXTENSION VERSION ────────────────────────────────
echo "🔧 Bumping extension patch version…"
pushd "$EXT_DIR" > /dev/null
npm version patch --no-git-tag-version
EXT_VERSION=$(node -p "require('./package.json').version")
echo " → Extension is now at v$EXT_VERSION"
popd > /dev/null

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
echo "✏️  Updating hosts/vscode-tgp-lang/package.json…"
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

echo "📦 Building VSIX…"
npx vsce package

#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob
vsix=( *.vsix )
((${#vsix[@]})) || { echo "No .vsix files found" >&2; exit 1; }
echo " → Created ${vsix[*]}"
mkdir -p "$HOME/projects/Genie/.jb6"
cp -- "${vsix[@]}" "$HOME/projects/Genie/.jb6/"

popd > /dev/null

echo "✅ Done! Extension v$EXT_VERSION is ready."
