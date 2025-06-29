#!/usr/bin/env bash
set -euo pipefail

# ─── CONFIG ───────────────────────────────────────────────────
# adjust this array if you add/remove packages
PKGS=(common core lang-service server-utils testing react mcp llm-guide)
SCOPE="@jb6"

# ─── PUBLISH LOOP ─────────────────────────────────────────────
for pkg in "${PKGS[@]}"; do
  PKG_DIR="packages/${pkg}"
  echo "📦 Publishing ${SCOPE}/${pkg} from ${PKG_DIR}…"
  (
    cd "$PKG_DIR"
    # ensure you’ve built/transpiled before publishing if needed
    # npm run build

    # publish to npm (uses publishConfig.access if scoped)
    npm publish --access public
  )
  echo "✔ ${SCOPE}/${pkg} published"
done

echo
echo "🎉 All done!"
