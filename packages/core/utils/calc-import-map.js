import { jb } from './core-utils.js'
import {} from './jb-cli.js'
const { coreUtils } = jb
const { logCli, runCliInContext } = coreUtils
Object.assign(coreUtils, { calcImportMap, resolveWithImportMap, fetchByEnv, logByEnv, 
  studioAndProjectImportMaps, calcRepoRoot, absPathToUrl, calcImportMapOfRepoRoot })

// async function importMapByEnv() {
//   if (globalThis.calcImportMapsFromVSCodeExt) {
//     return calcImportMapsFromVSCodeExt()
//   } else if (globalThis.window) {
//     return fetch('/import-map.json').then(r=>r.json())
//   } else { // node
//     return calcImportMap()
//   }
// }

async function studioAndProjectImportMaps(filePath) {
  if (globalThis.document && !globalThis.VSCodeStudioExtensionRoot) {
        const script = `
  import { coreUtils } from '@jb6/core'
  ;(async()=>{
    try {
      const result = await coreUtils.studioAndProjectImportMaps('${filePath}')
      process.stdout.write(JSON.stringify(result,null,2))
    } catch (e) {
      console.error(e)
    }
  })()`
    return await coreUtils.runNodeCliViaJbWebServer(script)
  }
  const repoRoot = globalThis.VSCodeWorkspaceProjectRoot || await calcRepoRoot()
  const studioRoot = globalThis.VSCodeStudioExtensionRoot || `${repoRoot}/hosts/vscode-tgp-lang`
  const projectRoot = await findProjectRoot(filePath, repoRoot)

  return { 
      studioImportMap: await calcImportMapOfRepoRoot(studioRoot, { servingRoot: repoRoot }), 
      projectImportMap: {projectRoot, ...await calcImportMapOfRepoRoot(projectRoot, { servingRoot: repoRoot, includeTesting: true, useCli: globalThis.VSCodeStudioExtensionRoot }) },
    }
}

async function findProjectRoot(filePath, repoRoot) {
  const path = await import('path')
  const { access } = await import('fs/promises')
  
  let currentDir = path.dirname(filePath)
  //currentDir = currentDir.replace(/^\/hosts\//, `${repoRoot}/hosts/`) // used by tests
  
  while (currentDir != repoRoot && currentDir != '/') {
    try {
      await access(path.join(currentDir, 'package.json'))
      return currentDir
    } catch (e) {}
    currentDir = path.dirname(currentDir)
  }
  return repoRoot
}

function resolveWithImportMap(specifier, { imports, serveEntries }) {
  let winner = ''               // longest matching key
  for (const key in imports) {
    if (
      (specifier === key || specifier.startsWith(key)) &&
      key.length > winner.length
    ) {
      winner = key
    }
  }
  if (!winner) return

  const target = imports[winner]
  const rest   = specifier.slice(winner.length) // part after the prefix
  const urlToBeServed = target.endsWith('/') ? target + rest : target
  const dirEntry = (serveEntries || []).find(({dir}) => urlToBeServed.startsWith(dir))
  if (dirEntry) {
    const restPath = urlToBeServed.slice(dirEntry.dir.length)
    return pathJoin(dirEntry.pkgDir, restPath)
  }
  return urlToBeServed

  function pathJoin(a, b) {
    return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
  }
}

async function calcImportMap() {
  const { readdir } = await import('fs/promises')

  const path = await import('path')
  const repoRoot = await calcRepoRoot()
  const devMode  = await isJB6Dev()
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
    const serveEntries = [{dir: '', pkgId: '@jb6/packages', pkgDir: pkgsDir}]    
    const res = { imports: { ...runtime, '#jb6/': '/packages/' }, serveEntries }
    logCli('JB6 dev mode: calcImportMap', res)
    return res
  } else {
    return calcImportMapOfRepoRoot(repoRoot)
  }
}

async function calcImportMapOfRepoRoot(repoRoot, { servingRoot = '', includeTesting, useCli } = {}) {
  if (useCli) {
    return await calcImportMapOfRepoRootCli(repoRoot, { servingRoot, includeTesting })
  }
  let { createRequire } = await import('module')
  const { readFile } = await import('fs/promises')
  const path = await import('path')
  const root_pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  const rootPkgName = root_pkg.name
  const serveEntries = root_pkg.serveEntries || []
  const packages = await discoverPkgNames(repoRoot)
  const requirePkg = createRequire(repoRoot)
  const relativeServingRoot = repoRoot.replace(servingRoot, '')
  const rootPkgId = rootPkgName.split('@jb6/').pop()
  //serveEntries.push({dir: rootPkgId, pkgDir: repoRoot})
  const rootEntry = rootPkgName.indexOf('@jb6') == 0 
    ? [`${rootPkgName}/`, `/packages/${rootPkgId}/`] 
    : [`${rootPkgName}/`, relativeServingRoot]
  const imports = Object.fromEntries([rootEntry, ...packages.flatMap(name => {
      const pkgId    = `@jb6/${name}`
      try {
        const pkgDir = path.dirname(requirePkg.resolve(pkgId))
        serveEntries.push({dir: `/packages/${name}`, pkgDir, pkgId})
      } catch (e) {
        logCli(`calcImportMapOfRepoRoot: Can not find module ${pkgId} in ${repoRoot}/package.json`)
        return []
      }
      // mount this package
      return [
        [`${pkgId}`,  `/packages/${name}/index.js`],
        [`${pkgId}/`,  `/packages/${name}/`]
      ]
    })
  ])
  const res = { imports, serveEntries }
//  logCli('client mode: calcImportMap', res)
  return res

  async function discoverPkgNames(root) {
    const seen = new Set()
  
    async function crawl(dir) {
      const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
      const localRequire = createRequire(dir)
      for (const t of ['dependencies', 'devDependencies'])
        for (const full of Object.keys(pkg[t] || {}))
          if (full.startsWith('@jb6/')) {
            const name = full.slice(5)
            if (!seen.has(name)) {
              seen.add(name)
              try {
                const pkgDir = path.dirname(localRequire.resolve(full)) // look in node_modules
                await crawl(pkgDir)
              } catch (e) {
                logCli(`discoverPkgNames: Can not find module ${full} in ${dir}/package.json under ${root}`, e)
              }
            }
          }
    }
  
    await crawl(root)
    if (includeTesting && !seen.has('testing')) {
      seen.add('testing')
      const pkgDir = path.dirname(createRequire(root).resolve('@jb6/testing'))
      await crawl(pkgDir)
    }
    return [...seen]
  }
}

async function calcImportMapOfRepoRootCli(repoRoot, { servingRoot = '', includeTesting } = {}) {
  const script = `
    import { coreUtils } from '@jb6/core'
    ;(async()=>{
      try {
        const result = await coreUtils.calcImportMapOfRepoRoot('${repoRoot}', { servingRoot: '${servingRoot}', includeTesting: ${includeTesting ? 'true' : 'false'} })
        process.stdout.write(JSON.stringify(result,null,2))
      } catch (e) {
        console.error(e)
      }
    })()
  `

  logCli(`node --inspect-brk --input-type=module -e "${script.replace(/"/g, '\\"')}"`)

  return runCliInContext(script, {importMap : {projectRoot: repoRoot}})
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


function logByEnv(...args) {
  if (globalThis.jbVSCodeLog)
    globalThis.jbVSCodeLog(...args)
  else
    console.log(...args)
}

async function fetchByEnv(url, serveEntries = []) {
  if (globalThis.window) {
    const rUrl = absPathToUrl(url, serveEntries)
    const res = await fetch(rUrl)
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`)
    return await res.text()
  }
  const { readFile } = await import('fs/promises')
  return await readFile(url, 'utf8')
}

function absPathToUrl(path, serveEntries = []) {
    const servedEntry = serveEntries.find(x => path.indexOf(x.pkgDir) == 0)
    return servedEntry ? path.replace(servedEntry.pkgDir, servedEntry.dir) : path
}