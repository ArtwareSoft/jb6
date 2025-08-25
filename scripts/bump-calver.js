#!/usr/bin/env node
/**
 * Usage:
 *   # optional: pass the patch number (default 0)
 *   node scripts/bump-calver.js  ✕PATCH→"1.YYMMDD.PATCH"
 */

import fs from 'fs/promises'
import path from 'path'
import { globby } from 'globby'

async function main() {
  // 1. build the version string
  const [ major = "1", patch = "1" ] = process.argv.slice(2)
  const now = new Date()
  const YY = String(now.getFullYear()).slice(2)
  const MM = String(now.getMonth()+1).padStart(2, "0")
  const DD = String(now.getDate()).padStart(2, "0")
  const version = `${major}.${YY}${MM}${DD}.${patch}`

  console.log(`⬢ Bumping to CalVer ${version}`)

  // 2. find all package.json (customize the glob / ignores as needed)
  const pkgFiles = await globby([
    "package.json",
    "packages/*/package.json",
    "!packages/**/node_modules/**",
    "!packages/repo/**",
    "!packages/**/.*/**"
  ])

  for (let pkgFile of pkgFiles) {
    const raw  = await fs.readFile(pkgFile, "utf8")
    const json = JSON.parse(raw)

    // 3. set the new version
    json.version = version

    // 4. bump any @jb6/* deps
    for (let depType of ["dependencies","devDependencies","peerDependencies","optionalDependencies"]) {
      if (!json[depType]) continue
      for (let [dep, val] of Object.entries(json[depType])) {
        if (dep.startsWith("@jb6/") && dep != "@jb6/repo") {
          json[depType][dep] = version
        }
      }
    }

    // 5. write it back
    await fs.writeFile(pkgFile, JSON.stringify(json, null, 2) + "\n")
    console.log(`  ✔ updated ${pkgFile}`)
  }

  console.log("✅ Done. Now run your installer (npm/yarn/pnpm) to update lockfiles.")
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
