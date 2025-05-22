import { execSync } from 'child_process'
import { createRequire } from 'module'
import path from 'path'
import dotenv from 'dotenv'
const __dirname = path.dirname(new URL(import.meta.url).pathname);
dotenv.config()

import { readdir, readFile } from 'fs/promises'
import express from 'express'

export async function serveImportMap(app) {
  const {imports, dirEntriesToServe} = await calcImportMap()
  for (const {dir, pkgId, pkgDir} of dirEntriesToServe) {
    app.use(`/packages/${dir}`, express.static(pkgDir))
  }
  app.get('/import-map.json', (_req, res) => res.json({ imports }))
}

export async function calcImportMap() {
  const devMode  = await isJB6Dev()
  if (devMode) {
    console.log('JB6 dev mode: serving mono-repo packages/')
    const pkgsDir = path.resolve(__dirname, '..')
    const entries = await readdir(pkgsDir, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
    const runtime = Object.fromEntries(
      folders.flatMap(f => [
        [`@jb6/${f}`,  `/packages/${f}/index.js`],
        [`@jb6/${f}/`, `/packages/${f}/`]          // enables sub-path imports
      ])
    )    
    const dirEntriesToServe = [{dir: 'packages', pkgId: '@jb6/packages', pkgDir: pkgsDir}]    
    return { imports: { ...runtime, '#jb6/': '/packages/' }, dirEntriesToServe }
  } else {
    let rootPkgName = '', repoRoot = ''
    const dirEntriesToServe = []
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
      const root_pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
      rootPkgName = root_pkg.name
      dirEntriesToServe.push({dir: rootPkgName, pkgId: `@${rootPkgName}/`, pkgDir: repoRoot})
      console.log(`Mounting client rep: /${rootPkgName} at ${repoRoot}/`)
    } catch (e) {}
  
    const packages = await discoverPkgNames()
    const requirePkg = createRequire(import.meta.url)
    const imports = Object.fromEntries([[`@${rootPkgName}/`, `/${rootPkgName}/`], ...packages.flatMap(name => {
        const pkgId    = `@jb6/${name}`
        const pkgDir = path.dirname(requirePkg.resolve(pkgId))
        // mount this package
        dirEntriesToServe.push({dir: name, pkgId, pkgDir})
        console.log(`Mounting package: /packages/${name} at ${pkgDir}/`)
        return [
          [`${pkgId}`,  `/packages/${name}/index.js`],
          [`${pkgId}/`,  `/packages/${name}/`]
        ]
      })
    ])
    console.log('Client mode: serving installed @jb6/* packages', imports)
    return { imports, dirEntriesToServe }
  }
}

async function isJB6Dev() {
  try {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
    const rootPkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
    return rootPkg.name == 'jb6-monorepo'
  } catch {
    return false
  }
}


async function discoverPkgNames(root = process.cwd()) {
  const req = createRequire(import.meta.url), seen = new Set()

  async function crawl(dir) {
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
    for (const t of ['dependencies', 'devDependencies'])
      for (const full of Object.keys(pkg[t] || {}))
        if (full.startsWith('@jb6/')) {
          const name = full.slice(5)
          if (!seen.has(name)) {
            seen.add(name)
            const pkgDir = path.dirname(req.resolve(full))
            await crawl(pkgDir)
          }
        }
  }

  await crawl(root)
  return [...seen]
}



