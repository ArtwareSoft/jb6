import { execSync } from 'child_process'
import { createRequire } from 'module'
import path from 'path'
import dotenv from 'dotenv'
const __dirname = path.dirname(new URL(import.meta.url).pathname);
dotenv.config()

import { readdir, readFile } from 'fs/promises'
import express from 'express'

export async function serveImportMap(app) {
  const devMode  = await isJB6Dev()

  if (devMode) {
    console.log('JB6 dev mode: serving mono-repo packages/')
    const pkgsDir = path.resolve(__dirname, '..')
    app.use('/packages', express.static(pkgsDir))
    app.get('/import-map.json', async (_req, res) => {
      const entries = await readdir(pkgsDir, { withFileTypes: true })
      const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
      const runtime = Object.fromEntries(
        folders.flatMap(f => [
          [`@jb6/${f}`,  `/packages/${f}/index.js`],
          [`@jb6/${f}/`, `/packages/${f}/`]          // enables sub-path imports
        ])
      )    
      res.json({ imports: { ...runtime, '#jb6/': '/packages/' } })
    })  
  } else {
    let rootPkgName = '', repoRoot = ''
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
      const root_pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
      rootPkgName = root_pkg.name
      app.use(`/${rootPkgName}`, express.static(repoRoot))
      console.log(`Mounting client rep: /${rootPkgName} at ${repoRoot}/`)
    } catch (e) {}
  
    const packages = await discoverPkgNames()
    const requirePkg = createRequire(import.meta.url)
    const imports = Object.fromEntries([[`@${rootPkgName}/`, `/${rootPkgName}/`], ...packages.flatMap(name => {
        const pkgId    = `@jb6/${name}`
        const pkgDir = path.dirname(requirePkg.resolve(pkgId))
        // mount this package
        app.use(`/packages/${name}`, express.static(pkgDir)) // , { dotfiles: 'allow' }
        console.log(`Mounting package: /packages/${name} at ${pkgDir}/`)
        return [
          [`${pkgId}`,  `/packages/${name}/index.js`],
          [`${pkgId}/`,  `/packages/${name}/`]
        ]
      })
    ])
    console.log('Client mode: serving installed @jb6/* packages', imports)
    app.get('/import-map.json', (_req, res) => res.json({ imports }))
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



