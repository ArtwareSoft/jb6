#!/usr/bin/env bash
set -euo pipefail

# 1. Create the workspace directory
mkdir -p packages/server-utils

# 2. package.json
cat > packages/server-utils/package.json << 'JSON'
{
  "name": "@jb6/server-utils",
  "version": "0.1.0",
  "description": "Server-side utilities (import-map and more) for JB6",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "dotenv": "^16.1.0"
  }
}
JSON

# 3. index.js — re-export the calcImportMap function
cat > packages/server-utils/index.js << 'JS'
export { calcImportMap } from './calc-import-map.js'
JS

# 4. calc-import-map.js — the core logic (no semicolons in JS)
cat > packages/server-utils/calc-import-map.js << 'JS'
import { createRequire } from 'module'
import path from 'path'
import { existsSync } from 'fs'
import dotenv from 'dotenv'
dotenv.config()

const requirePkg = createRequire(import.meta.url)

export function calcImportMap() {
  const PKG_NAMES = (process.env.PKG_NAMES || 'repo,common,core,testers')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const JB_MONO_ROOT = process.env.JB_MONO_ROOT || path.resolve(__dirname, '..')
  const imports = {}
  const mounts = []

  for (const name of PKG_NAMES) {
    const pkgId = \`@jb6/\${name}\`
    let pkgDir

    const localDir = path.join(JB_MONO_ROOT, 'packages', name)
    if (existsSync(path.join(localDir, 'package.json'))) {
      pkgDir = localDir
    } else {
      const pkgJsonPath = requirePkg.resolve(\`\${pkgId}/package.json\`)
      pkgDir = path.dirname(pkgJsonPath)
    }

    mounts.push({ url: \`/packages/\${name}\`, dir: pkgDir })

    const pkgJson = requirePkg(\`\${pkgId}/package.json\`)
    const mainFile = pkgJson.main || 'index.js'

    imports[pkgId] = \`/packages/\${name}/\${mainFile}\`
    imports[\`\${pkgId}/*\`] = \`/packages/\${name}/*\`
  }

  imports['#jb6/*'] = '/packages/*'

  return { imports, mounts }
}
JS

# Make the bootstrap script executable
chmod +x scripts/bootstrap-server-utils.sh

echo "✅ scripts/bootstrap-server-utils.sh created and scaffolded packages/server-utils"
