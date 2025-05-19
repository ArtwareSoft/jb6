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
    console.log('Client mode: serving installed @jb6/* packages')
    const packages = await discoverPkgNames()
    const requirePkg = createRequire(import.meta.url)
    app.get('/import-map.json', (_req, res) => {
      const imports = Object.fromEntries(
        packages.flatMap(name => {
          const pkgId    = `@jb6/${name}`
          const pkgJson  = requirePkg.resolve(`${pkgId}/package.json`)
          const pkgDir   = path.dirname(pkgJson)
          const mainFile = requirePkg(`${pkgId}/package.json`).main || 'index.js'
          // mount this package
          app.use(`/packages/${name}`, express.static(pkgDir))
          return [
            [pkgId,         `/packages/${name}/${mainFile}`],
            [`${pkgId}/`,  `/packages/${name}/`]
          ]
        })
      )
      res.json({ imports })
    })
  }
}

async function isJB6Dev() {
  try {
    // assume server lives in packages/server-utils/
    const repoRoot = path.resolve(__dirname, '../..')
    const pkgJson  = await readFile(path.join(repoRoot, 'package.json'), 'utf8')
    const { name } = JSON.parse(pkgJson)
    return name === 'jb6-monorepo'
  }
  catch {
    return false
  }
}

async function discoverPkgNames() {
  const pkgJson = await readFile(path.resolve(process.cwd(), 'package.json'), 'utf8')
  const { dependencies = {}, devDependencies = {} } = JSON.parse(pkgJson)

  return Object
    .keys({ ...dependencies, ...devDependencies })
    .filter(name => name.startsWith('@jb6/'))
    .map(name => name.slice('@jb6/'.length))
}

