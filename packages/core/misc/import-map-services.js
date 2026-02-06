import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import './jb-cli.js'

const { coreUtils } = jb
const { isNode, logException, pathJoin,pathParent, unique, asArray } = coreUtils

jb.importMapCache = {
  fileContext: {}
}
Object.assign(coreUtils, { getStaticServeConfig, calcImportData, resolveWithImportMap, fetchByEnv, calcRepoRoot, calcJb6RepoRootAndImportMapsInCli, discoverDslEntryPoints, absPathToImportUrl })

const ignoreDirs = [ 'node_modules', '3rd-party', '.git'] 
async function calcRepoRoot(options) {
  if (jb.coreRegistry.repoRoot || globalThis.__repoRoot) return jb.coreRegistry.repoRoot || globalThis.__repoRoot

  if (globalThis.VSCodeWorkspaceProjectRoot)
    return jb.coreRegistry.repoRoot = globalThis.VSCodeWorkspaceProjectRoot

  if (!isNode) {
    const script = `
    import { coreUtils } from '@jb6/core'
    import '@jb6/core/misc/import-map-services.js'
    try {
      const result = await coreUtils.calcRepoRoot()
      await coreUtils.writeServiceResult(result)
    } catch (e) {
      await coreUtils.writeServiceResult(e.message || e)
    }`
    const res = await coreUtils.runNodeCliViaJbWebServer(script,options)
    return jb.coreRegistry.repoRoot = res.result
  }
  const { fileURLToPath } = await import('url')
  const path = await import('path')
  let dir = path.dirname(path.resolve(fileURLToPath(import.meta.url)))
  while (dir !== path.dirname(dir)) {
    if (await exists(path.join(dir, '.git'))) return jb.coreRegistry.repoRoot = dir
    dir = path.dirname(dir)
  }
}

async function calcJb6RepoRootAndImportMapsInCli() {
  if (jb.coreRegistry.jb6Root)
    return jb.coreRegistry.jb6Root
  if (!isNode) {
    try {
      jb.coreRegistry.jb6Root = pathParent(JSON.parse(globalThis.document.head.querySelector('[type="importmap"]').innerText).staticMappings
        .find(x=>x.urlPath == '/jb6_packages').diskPath)
    } catch(e) {
      debugger
    }
  } else {
    const path = await import('path')
    const repoRoot = await calcRepoRoot()
    const pkgJson = await packageJson(repoRoot)
    jb.coreRegistry.jb6Root = pkgJson.name == 'jb6-monorepo' && repoRoot
      || pkgJson.jb6Root && path.resolve(repoRoot,pkgJson.jb6Root)
      || `${repoRoot}/node_modules/@jb6`
    jb.coreRegistry.importMapsInCli = pkgJson.importMapsInCli && path.resolve(repoRoot,pkgJson.importMapsInCli)
  }
  return jb.coreRegistry.jb6Root
}

async function discoverDslEntryPoints({forDsls, repoRoot}) {
  if (!isNode) {
    const script = `import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
;(async()=>{
try {
  const result = await coreUtils.discoverDslEntryPoints(${JSON.stringify({forDsls, repoRoot})})
  await coreUtils.writeServiceResult(result)
} catch (e) { console.error(e) }
})()`
      const res = await coreUtils.runNodeCliViaJbWebServer(script)
      return res.result
  }
  return doDiscover()

  async function doDiscover() {
    debugger
    const { readdir, readFile } = await import('fs/promises')
    const path = await import('path')
    const files = []
    jb.coreRegistry.repoRoot = jb.coreRegistry.repoRoot || repoRoot // for genieTest

    try {
      const dsls = Array.isArray(forDsls) ? forDsls : (forDsls||'').split(',').map(x=>x.trim()).filter(Boolean)
      const jb6RepoRoot = await calcJb6RepoRootAndImportMapsInCli()
      await walkDir(jb6RepoRoot)

      const repoRoot = await calcRepoRoot()
      if (repoRoot != jb6RepoRoot) {
        let jb6Dirs = []
        try {
          const content = await readFile(`${repoRoot}/.jb6/settings.json`)
          jb6Dirs = JSON.parse(content).jb6Dirs
        } catch(e) {}
        for(const jb6Dir of jb6Dirs)
            await walkDir(`${repoRoot}/${jb6Dir}`)
      }
      return dsls.flatMap(dsl=> files.filter(f=>f.endsWith(`${dsl}/index.js`)))
    } catch (error) {
      return { error: `Failed to discover DSL entry points: ${error.message}` }
    }

    async function walkDir(dir) {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (ignoreDirs.includes(entry.name)) continue
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) 
            await walkDir(fullPath)
          else 
            files.push(fullPath)
        }
      } catch (error) {}
    }
  }
}

async function getStaticServeConfig(repoRoot) {
  if (!isNode) {
    const script = `import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
;(async()=>{
try {
  const result = await coreUtils.getStaticServeConfig('${repoRoot}')
  await coreUtils.writeServiceResult(result)
} catch (e) { console.error(e) }
})()`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }
  const pkgJson = await packageJson(repoRoot)
  return await getStaticConfig(repoRoot, pkgJson)
}

async function calcImportData(resources = {}) {
  const {entryPointPaths, forRepo, forDsls} = resources
  const cacheKey = JSON.stringify(resources)
  if (jb.importMapCache.fileContext[cacheKey]) return jb.importMapCache.fileContext[cacheKey]
  
  if (!isNode) {
    const script = `import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
;(async()=>{
try {
  const result = await coreUtils.calcImportData(${JSON.stringify(resources)})
  await coreUtils.writeServiceResult(result)
} catch (e) { console.error(e) }
})()`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }
  const validEntryPoints = forRepo ? [] : await normalizeToValidEntryPoints({entryPointPaths, forDsls})
  if (validEntryPoints.error) return createErrorResult(validEntryPoints.error)
  if (validEntryPoints.length === 0 && !forRepo) return createErrorResult('No valid entry points found')

  const {repoRoot, projectDir} = forRepo ? {repoRoot: forRepo} : await calcRepoRootAndProjectDir(validEntryPoints[0])
  if (repoRoot?.error) return createErrorResult(repoRoot.error, validEntryPoints)

  const pkgJson = await packageJson(repoRoot)
  if (pkgJson.error) return createErrorResult(pkgJson.error, validEntryPoints)

  const importMapData = await getStaticConfig(repoRoot, pkgJson, {})
  if (importMapData.error) return createErrorResult(importMapData.error, validEntryPoints, pkgJson)

  const projectPkgJson = await packageJson(projectDir || repoRoot)
  const discoveredFiles = await discoverFiles(importMapData.staticMappings, projectPkgJson, {projectDir: projectDir || repoRoot, maxDepth: 10})
  
  return jb.importMapCache.fileContext[cacheKey] = { repoRoot, projectDir, ...importMapData, ...discoveredFiles, entryFiles: validEntryPoints, 
    repoRootName: pkgJson.name }
}

function createErrorResult(error, entryFiles = [], pkgJson = {}) {
  return { pkgJson, entryFiles, error, testFiles: [], llmGuideFiles: [] }
}

async function packageJson(packageDir) {
  try {
    const { readFile } = await import('fs/promises')
    const path = await import('path')
    return JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'))
  } catch (error) {
    return { error: `Cannot read package.json at ${packageDir}: ${error.message}` }
  }
}

async function getStaticConfig(repoRoot, pkgJson) {
  const repoName = pkgJson.name  
  try {
    // consider lookup in package jsons for pkgJson.jb6Root pkgJson.importMap
    const path = await import('path')
    const { readdir } = await import('fs/promises') 
    const pkgsDir = pkgJson.name == 'jb6-monorepo' && path.resolve(repoRoot, 'packages')
      || pkgJson.jb6Root && path.resolve(repoRoot,pkgJson.jb6Root)
      || `${repoRoot}/node_modules/@jb6`
    let entries = []
    try {
      entries = await readdir(pkgsDir, { withFileTypes: true })
    } catch(e) {}
    const folders = entries.filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name)
    const imports = {...pkgJson.importMap, ... Object.fromEntries(folders.flatMap(f => [[`@jb6/${f}`,  `/jb6_packages/${f}/index.js`], [`@jb6/${f}/`, `/jb6_packages/${f}/`]])) }
    const staticMappings = repoName == 'jb6-monorepo' ? [
      { urlPath: '/packages', diskPath: pkgsDir },
      { urlPath: '/jb6_packages', diskPath: pkgsDir },
      { urlPath: '/hosts', diskPath: path.resolve(repoRoot, 'hosts') }
    ] : [
      { urlPath: `/${repoName}`, diskPath: repoRoot },
      { urlPath: '/jb6_packages', diskPath: pkgsDir },
    ]
    const importMapsInCli = pkgJson.importMapsInCli && path.resolve(repoRoot,pkgJson.importMapsInCli)
    return { importMap: { imports, staticMappings, importMapsInCli }, staticMappings, repoRootName: pkgJson.name }
    // staticMappings is needed in client so it is also passed inside importMap
  } catch (error) {
    return { error: `Failed to configure ${repoName}: ${error.message}` }
  }
}

async function normalizeToValidEntryPoints({entryPointPaths, forDsls}) {
  const dslEntryPoints = forDsls ? await discoverDslEntryPoints(forDsls) : []
  const entryPoints = [...asArray(entryPointPaths),...dslEntryPoints]

  const { stat } = await import('fs/promises')
  const path = await import('path')

  const validEntryPoints = []
  for (const entryPointPath of entryPoints) {
      if (await exists(entryPointPath)) {
        if ((await stat(entryPointPath)).isDirectory()) {
          const indexJs = path.join(entryPointPath, 'index.js')
          if (await exists(indexJs))
            validEntryPoints.push(indexJs);
        } else {
          validEntryPoints.push(entryPointPath)
        }
      } else {
        console.warn(`Warning: Entry point not accessible: ${entryPointPath}`)
      }
  }
  return validEntryPoints
}

async function calcRepoRootAndProjectDir(filePath) {
  const path = await import('path')
  let currentDir = path.dirname(filePath), repoRoot = null, projectDir = null
  while (currentDir !== '/' && currentDir !== '.') {
    if (!repoRoot && await exists(path.join(currentDir, '.git'))) repoRoot = currentDir
    if (!projectDir && await exists(path.join(currentDir, 'package.json'))) projectDir = currentDir
    if (repoRoot && projectDir) break
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }
  return { repoRoot: repoRoot || projectDir, projectDir }
}

async function discoverFiles(staticMappings, pkgJson, {projectDir}) {
  const { readdir,readFile } = await import('fs/promises')
  const path = await import('path')

  const discoveredFiles = { testFiles: [], llmGuideFiles: [] }
  const discoveredInJb6Repo = { testFiles: [], llmGuideFiles: [] }
  if (pkgJson.name === 'jb6-monorepo') {
    const packagesEntry = staticMappings.find(entry => entry.urlPath === '/packages')
    if (packagesEntry) await walkDirectory(packagesEntry.diskPath, discoveredFiles)
    discoveredFiles.testFiles = unique(discoveredFiles.testFiles)
    discoveredFiles.llmGuideFiles = unique(discoveredFiles.llmGuideFiles)
  } else {
    let jb6Dirs = []
    try {
      const content = await readFile(`${projectDir}/.jb6/settings.json`)
      jb6Dirs = JSON.parse(content).jb6Dirs
    } catch(e) {}
    for(const jb6Dir of jb6Dirs)
      await walkDirectory(`${projectDir}/${jb6Dir}`, discoveredFiles)
    
    const jb6Entry = staticMappings.find(entry => entry.urlPath === '/jb6_packages')
    if (jb6Entry) {
      await walkDirectory(jb6Entry.diskPath, discoveredInJb6Repo)
      discoveredFiles.jb6_testFiles = unique(discoveredInJb6Repo.testFiles)
      discoveredFiles.jb6_llmGuideFiles = unique(discoveredInJb6Repo.llmGuideFiles)
    }
  }

  return discoveredFiles

  async function walkDirectory(dirPath, discoveredFiles) {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (ignoreDirs.includes(entry.name)) continue
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          await walkDirectory(fullPath, discoveredFiles)
        } else if (entry.isFile()) {
          categorizeFile(fullPath)
        }
      }
    } catch (error) {
      console.warn(`Warning: Cannot read directory ${dirPath}:`, error.message)
    }
    return discoveredFiles

    function categorizeFile(filePath) {
      const fileName = path.basename(filePath)
      const dirName = path.basename(path.dirname(filePath))
      const isTestFile = fileName.match(/-tests?\.js$/) || dirName === 'tests' && fileName.match(/\.js$/)
      const isTesterFile = fileName.match(/-testers\.js$/)
      const isLlmGuideFile = fileName.match(/-llm-guide\.js$/) || (dirName === 'llm-guide' && fileName.endsWith('.js'))
      
      if ((isTestFile || isTesterFile)) discoveredFiles.testFiles.push(filePath)
      else if (isLlmGuideFile) discoveredFiles.llmGuideFiles.push(filePath)
    }  
  }
}


function resolveWithImportMap(specifier, importMap, staticMappings) {
  if (specifier[0] == '/') return specifier
  const imports = importMap?.imports
  if (!imports || !staticMappings) return undefined
  
  let winner = ''
  for (const key in imports) {
    if ((specifier === key || specifier.startsWith(key)) && key.length > winner.length) winner = key
  }
  if (!winner) return undefined
  
  const target = imports[winner]
  const rest = specifier.slice(winner.length)
  const urlToBeServed = target.endsWith('/') ? target + rest : target
  const dirEntry = staticMappings.find(({urlPath}) => urlToBeServed.startsWith(urlPath))
  if (dirEntry) return pathJoin(dirEntry.diskPath, urlToBeServed.slice(dirEntry.urlPath.length))
  return urlToBeServed
}

function absPathToUrl(path, staticMappings = []) {
  const servedEntry = staticMappings.find(x => x.diskPath != x.urlPath && path.indexOf(x.diskPath) == 0)
  return servedEntry ? path.replace(servedEntry.diskPath, servedEntry.urlPath) : path
}

function absPathToImportUrl(path, imports, staticMappings) {
  if (path.startsWith('@')) return path
  if (path == './') return
  const absPaths = staticMappings.filter(x => x.diskPath != x.urlPath && path.indexOf(x.diskPath) == 0)
    .map(servedEntry => path.replace(servedEntry.diskPath, servedEntry.urlPath))
  let res = absPaths.map(path=>Object.entries(imports).find(e=>e[1] == path)).filter(Boolean).map(e=>e[0])[0]
  if (!res && path) {
    const pathIsDir = path.slice(-1)[0] == '/'
    const suffix = pathIsDir ? path.split('/').slice(-2)[0] + '/' : path.split('/').pop()
    res = absPathToImportUrl(pathParent(path)+'/', imports, staticMappings) + suffix
  }
  return res
}

async function fetchByEnv(url, staticMappings = [], httpServer = '') {
  if (!isNode) {
    const { logError } = coreUtils
    const rUrl = httpServer + absPathToUrl(url, staticMappings)
    let res
    try {
      res = await fetch(rUrl)
    } catch(error) {
      logError(`fetch ${rUrl}`)
      return { error: error.stack }
    }
    if (!res.ok) {
      logError(`fetch ${url} → ${res.status}`)
      return { error: `${rUrl} error`}
    } 
    return await res.text()
  }
  const { readFile } = await import('fs/promises')
  const { logVsCode, logError } = coreUtils
  globalThis.detailedjbVSCodeLog && logVsCode(`fetch ${url}`)
  try {
    return await readFile(url, 'utf8')
  } catch(e) {
    logError(`fetch ${url} → ${e}`)
    return ''
  }
}

async function exists(path) {
  const { access } = await import('fs/promises')
  return access(path).then(() => true, () => false)
}
