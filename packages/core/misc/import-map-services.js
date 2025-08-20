import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import './jb-cli.js'

const { coreUtils } = jb
const { isNode, logException, pathJoin,pathParent, unique, asArray } = coreUtils

jb.importMapCache = {
  fileContext: {}
}
Object.assign(coreUtils, { getStaticServeConfig, calcImportData, resolveWithImportMap, fetchByEnv, calcRepoRoot, calcJb6RepoRoot, discoverDslEntryPoints })

const ignoreDirs = [ 'node_modules', '3rd-party', '.git'] 
async function calcRepoRoot() {
  if (jb.coreRegistry.repoRoot) return jb.coreRegistry.repoRoot

  if (globalThis.VSCodeWorkspaceProjectRoot)
    return jb.coreRegistry.repoRoot = globalThis.VSCodeWorkspaceProjectRoot

  if (!isNode) {
    const script = `
    import { coreUtils } from '@jb6/core'
    import '@jb6/core/misc/import-map-services.js'
    try {
      const result = await coreUtils.calcRepoRoot()
      await coreUtils.writeToStdout(result)
    } catch (e) {
      await coreUtils.writeToStdout(e.message || e)
    }`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return jb.coreRegistry.repoRoot = res.result
  }
  const { execSync } = await import('child_process')
  if (jb.coreRegistry.repoRoot)
    return jb.coreRegistry.repoRoot
    
  try {
    return jb.coreRegistry.repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch (gitError) {}
}

async function calcJb6RepoRoot() {
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
    const { readFile } = await import('fs/promises')
    const path = await import('path')
    const repoRoot = await calcRepoRoot()
    try {
      const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
      jb.coreRegistry.jb6Root = pkg.name == 'jb6-monorepo' ? repoRoot: `${repoRoot}/node_modules/@jb6`  
    } catch(e) {}
  }
  return jb.coreRegistry.jb6Root
}

async function discoverDslEntryPoints(forDsls) {
  if (!isNode) {
    const script = `import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
;(async()=>{
try {
  const result = await coreUtils.discoverDslEntryPoints(${JSON.stringify(forDsls)})
  await coreUtils.writeToStdout(result)
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

    try {
      const dsls = Array.isArray(forDsls) ? forDsls : (forDsls||'').split(',').map(x=>x.trim()).filter(Boolean)
      const jb6RepoRoot = await calcJb6RepoRoot()
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
  await coreUtils.writeToStdout(result)
} catch (e) { console.error(e) }
})()`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }
  const environment = await detectEnvironment(repoRoot)
  return await getStaticConfig(repoRoot, environment)
}

async function calcImportData(dependencies = {}) {
  const {entryPointPaths, forRepo, forDsls} = dependencies
  const cacheKey = JSON.stringify(dependencies)
  if (jb.importMapCache.fileContext[cacheKey]) return jb.importMapCache.fileContext[cacheKey]
  
  if (!isNode) {
    const script = `import { coreUtils } from '@jb6/core'
import '@jb6/core/misc/import-map-services.js'
;(async()=>{
try {
  const result = await coreUtils.calcImportData(${JSON.stringify(dependencies)})
  await coreUtils.writeToStdout(result)
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

  const environment = await detectEnvironment(repoRoot)
  if (environment.error) return createErrorResult(environment.error, validEntryPoints)

  const importMapData = await getStaticConfig(repoRoot, environment, {})
  if (importMapData.error) return createErrorResult(importMapData.error, validEntryPoints, environment)

  const discoveredFiles = await discoverFiles(importMapData.staticMappings, environment, {repoRoot, projectDir, maxDepth: 10})
  
  return jb.importMapCache.fileContext[cacheKey] = { repoRoot, projectDir, ...importMapData, ...discoveredFiles, entryFiles: validEntryPoints, environment }
}

function createErrorResult(error, entryFiles = [], environment = 'unknown') {
  return { environment, entryFiles, error, testFiles: [], llmGuideFiles: [] }
}

async function detectEnvironment(repoRoot) {
  try {
    const { readFile } = await import('fs/promises')
    const path = await import('path')
    const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
    return pkg.name
  } catch (error) {
    return { error: `Cannot read package.json at ${repoRoot}: ${error.message}` }
  }
}

async function getStaticConfig(repoRoot, environment) {
  try {
    const path = await import('path')
    const { readdir } = await import('fs/promises')  
    const repoName = environment  
    const pkgsDir = environment == 'jb6-monorepo' ? path.resolve(repoRoot, 'packages') : path.resolve(repoRoot, 'node_modules/@jb6')
    const entries = await readdir(pkgsDir, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name)
    const imports = Object.fromEntries(folders.flatMap(f => [[`@jb6/${f}`,  `/jb6_packages/${f}/index.js`], [`@jb6/${f}/`, `/jb6_packages/${f}/`]]))
    const staticMappings = environment == 'jb6-monorepo' ? [
      { urlPath: '/packages', diskPath: pkgsDir },
      { urlPath: '/jb6_packages', diskPath: pkgsDir },
      { urlPath: '/hosts', diskPath: path.resolve(repoRoot, 'hosts') }
    ] : [
      { urlPath: `/${repoName}`, diskPath: repoRoot },
      { urlPath: '/jb6_packages', diskPath: pkgsDir },
    ]
    return { importMap: { imports, staticMappings }, staticMappings, environment }
  } catch (error) {
    return { error: `Failed to configure ${environment}: ${error.message}` }
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
  return { repoRoot, projectDir }
}

async function discoverFiles(staticMappings, environment, {repoRoot, projectDir}) {
  const { readdir,readFile } = await import('fs/promises')
  const path = await import('path')
  let jb6Dirs = []
  try {
    const content = await readFile(`${projectDir}/.jb6/settings.json`)
    jb6Dirs = JSON.parse(content).jb6Dirs
  } catch(e) {}

  const discoveredFiles = { testFiles: [], llmGuideFiles: [] }
  if (environment === 'jb6-monorepo') {
    const packagesEntry = staticMappings.find(entry => entry.urlPath === '/packages')
    if (packagesEntry) await walkDirectory(packagesEntry.diskPath, discoveredFiles)
  } else {
    const jb6Entry = staticMappings.find(entry => entry.urlPath === '/jb6_packages')
    if (jb6Entry) await walkDirectory(jb6Entry.diskPath, discoveredFiles)
  }


  discoveredFiles.testFiles = unique(discoveredFiles.testFiles)
  discoveredFiles.llmGuideFiles = unique(discoveredFiles.llmGuideFiles)
  if (projectDir && repoRoot != projectDir) {
    let discoveredInProjectDir = {testFiles: [], llmGuideFiles: []}
    debugger
    for(const jb6Dir of jb6Dirs)
      await walkDirectory(`${projectDir}/${jb6Dir}`, discoveredInProjectDir)
    discoveredInProjectDir.discoveredInRepo = discoveredFiles
    return discoveredInProjectDir
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
      const isLlmGuideFile = fileName.match(/-llm-guide\.js$/) || dirName === 'llm-guide'
      
      if ((isTestFile || isTesterFile)) discoveredFiles.testFiles.push(filePath)
      else if (isLlmGuideFile) discoveredFiles.llmGuideFiles.push(filePath)
    }  
  }
}


function resolveWithImportMap(specifier, importMap, staticMappings) {
  if (specifier[0] == '/') return specifier
  const imports = importMap.imports
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

async function fetchByEnv(url, staticMappings = [], httpServer = '') {
  if (!isNode) {
    const { logError } = coreUtils
    const rUrl = httpServer + absPathToUrl(url, staticMappings)
    const res = await fetch(rUrl)
    if (!res.ok) {
      logError(`fetch ${url} → ${res.status}`)
      return ''
    } 
    return await res.text()
  }
  const { readFile } = await import('fs/promises')
  const { logVsCode, logError } = coreUtils
  logVsCode(`fetch ${url}`)
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
