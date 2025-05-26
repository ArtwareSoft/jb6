import { coreUtils } from './core-utils.js'

const { logCli } = coreUtils
coreUtils.calcImportMap = calcImportMap

async function calcImportMap() {
  const devMode  = await isJB6Dev()
  const { readdir, readFile } = await import('fs/promises')
  const path = await import('path')
  const repoRoot = await calcRepoRoot()
  if (devMode) {
    const pkgsDir = path.resolve(repoRoot, 'packages')
    const entries = await readdir(pkgsDir, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
    const runtime = Object.fromEntries(
      folders.flatMap(f => [
        [`@jb6/${f}`,  `/packages/${f}/index.js`],
        [`@jb6/${f}/`, `/packages/${f}/`]          // enables sub-path imports
      ])
    )    
    const dirEntriesToServe = [{dir: '', pkgId: '@jb6/packages', pkgDir: pkgsDir}]    
    const res = { imports: { ...runtime, '#jb6/': '/packages/' }, dirEntriesToServe }
    logCli('JB6 dev mode: calcImportMap', res)
    return res
  } else {
    let rootPkgName = ''
    const dirEntriesToServe = []
    try {
      const root_pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
      rootPkgName = root_pkg.name
      dirEntriesToServe.push({dir: rootPkgName, pkgId: `@${rootPkgName}/`, pkgDir: repoRoot})
      //logCli(`client rep: /${rootPkgName} at ${repoRoot}/`)
    } catch (e) {}
  
    const packages = await discoverPkgNames()
    const requirePkg = await createRequireFn()
    const imports = Object.fromEntries([[`@${rootPkgName}/`, `/${rootPkgName}/`], ...packages.flatMap(name => {
        const pkgId    = `@jb6/${name}`
        const pkgDir = path.dirname(requirePkg.resolve(pkgId))
        // mount this package
        dirEntriesToServe.push({dir: name, pkgId, pkgDir})
        return [
          [`${pkgId}`,  `/packages/${name}/index.js`],
          [`${pkgId}/`,  `/packages/${name}/`]
        ]
      })
    ])
    const res = { imports, dirEntriesToServe }
    logCli('client mode: calcImportMap', res)
    return res
  }
}

async function calcRepoRoot() {
  const { execSync } = await import('child_process')
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

async function isJB6Dev() {
  const { readFile } = await import('fs/promises')
  const path = await import('path')

  try {
    const repoRoot = await calcRepoRoot()
    const rootPkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
    return rootPkg.name == 'jb6-monorepo'
  } catch (e) { 
    logCli('Error checking JB6 repo', e)
    return false
  }
}

async function createRequireFn() {
  const { createRequire } = await import('module')
  return createRequire(import.meta.url)
}

async function discoverPkgNames(root) {
  const { readFile } = await import('fs/promises')
  const path = await import('path')
  if (!root) root = await calcRepoRoot()
  const req = await createRequireFn(), seen = new Set()

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