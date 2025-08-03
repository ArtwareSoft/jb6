import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import './calc-import-map.js'  // Keep old implementation available

const { coreUtils } = jb
const { isNode, logException, pathJoin, calcRepoRoot, unique } = coreUtils

Object.assign(coreUtils, { getStaticServeConfig, getExecutionContext, getFileContext })

// ============================================================================= 
// NEW PACKAGE SERVICES API
// =============================================================================

export async function getStaticServeConfig(repoRoot, {includeHidden = false} = {}) {
  try {
    const environment = await detectEnvironment(repoRoot)
    
    if (environment === 'jb6-monorepo') {
      return await getMonorepoStaticConfig(repoRoot, {includeHidden})
    } else if (environment === 'extension') {
      return await getExtensionStaticConfig(repoRoot, {includeHidden})
    } else {
      return await getAppStaticConfig(repoRoot, {includeHidden})
    }
  } catch (error) {
    throw new ServiceError(`Failed to get static serve config: ${error.message}`, 'CRAWL_ERROR', { repoRoot, error })
  }
}

export async function getExecutionContext(
  entryPointPaths,  // string | string[] - file path(s) to start from
  {forDsls, includeTestFiles = true, includeHidden = false} = {}
) {
  // TODO: Implement after TGP Model Builder is working
  throw new Error('getExecutionContext not implemented yet')
}

export async function getFileContext(
  entryPointPaths,  // string | string[] | null - file path(s) to start from, or null for DSL-based discovery
  {forDsls, includeTestFiles = true, includeLlmGuides = true, includeHidden = false, maxDepth = 10} = {}
) {
  try {
    // Normalize entryPointPaths to entry point array
    const validEntryPoints = await normalizeToValidEntryPoints(entryPointPaths, {forDsls})
    if (validEntryPoints.length === 0) {
      throw new ServiceError('No valid entry points found', 'INVALID_INPUT', { entryPointPaths, forDsls })
    }

    // Detect environment from first entry point
    const repoRoot = await calcRepoRootFromPath(validEntryPoints[0])
    const environment = await detectEnvironment(repoRoot)
    
    // Generate import map
    const importMapData = await generateImportMap(repoRoot, environment)
    
    // Discover files from entry points
    const discoveredFiles = await discoverFilesFromEntryPoints(
      validEntryPoints, 
      importMapData, 
      environment, 
      {includeTestFiles, includeLlmGuides, includeHidden, maxDepth}
    )
    
    // Create resolver function
    const resolver = createResolver(importMapData)
    
    // Create content fetcher function
    const contentFetcher = createContentFetcher(importMapData)
    
    return {
      importMap: importMapData,
      sourceFiles: discoveredFiles.sourceFiles,
      testFiles: discoveredFiles.testFiles,
      llmGuideFiles: discoveredFiles.llmGuideFiles,
      entryFiles: validEntryPoints,
      resolver,
      contentFetcher,
      environment
    }
  } catch (error) {
    throw new ServiceError(`Failed to get file context: ${error.message}`, 'CRAWL_ERROR', { entryPointPaths, forDsls, error })
  }
}

// ============================================================================= 
// ENVIRONMENT DETECTION
// =============================================================================

async function detectEnvironment(repoRoot) {
  const { readFile } = await import('fs/promises')
  const path = await import('path')
  
  try {
    const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
    const isJB6Monorepo = pkg.name === 'jb6-monorepo'
    const hasJB6Deps = Object.keys(pkg.dependencies || {}).some(dep => dep.startsWith('@jb6/'))
    
    if (isJB6Monorepo) return 'jb6-monorepo'
    if (hasJB6Deps) return 'extension'
    return 'app'
  } catch (error) {
    throw new ServiceError(`Cannot read package.json at ${repoRoot}`, 'INVALID_INPUT', { repoRoot })
  }
}

// ============================================================================= 
// JB6 MONOREPO STATIC CONFIG
// =============================================================================

async function getMonorepoStaticConfig(repoRoot, {includeHidden}) {
  const { readdir } = await import('fs/promises')
  const path = await import('path')
  
  const pkgsDir = path.resolve(repoRoot, 'packages')
  const entries = await readdir(pkgsDir, { withFileTypes: true })
  const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
  
  // Generate import map
  const imports = Object.fromEntries(
    folders.flatMap(f => [
      [`@jb6/${f}`,  `/packages/${f}/index.js`],
      [`@jb6/${f}/`, `/packages/${f}/`]
    ])
  )
  imports['#jb6/'] = '/packages/'
  
  // Generate static mappings
  const staticMappings = [
    { urlPath: '/packages', diskPath: pkgsDir, pkgId: '@jb6/packages' },
    { urlPath: '/hosts', diskPath: path.resolve(repoRoot, 'hosts'), pkgId: 'hosts' }
  ]
  
  return {
    importMap: { imports },
    staticMappings,
    environment: 'jb6-monorepo'
  }
}

// ============================================================================= 
// EXTENSION PACKAGE STATIC CONFIG
// =============================================================================

async function getExtensionStaticConfig(repoRoot, {includeHidden}) {
  const path = await import('path')
  const { readFile } = await import('fs/promises')
  
  // Read package.json to get dependencies
  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  const jb6Deps = Object.keys(pkg.dependencies || {}).filter(dep => dep.startsWith('@jb6/'))
  
  // Generate import map for JB6 packages
  const imports = Object.fromEntries(
    jb6Deps.flatMap(dep => {
      const name = dep.replace('@jb6/', '')
      return [
        [dep, `/@jb6/${name}/index.js`],
        [`${dep}/`, `/@jb6/${name}/`]
      ]
    })
  )
  
  // Add local package entry if it exists
  if (pkg.main) {
    imports[pkg.name] = `/${pkg.main}`
  }
  
  // Generate static mappings
  const staticMappings = [
    { 
      urlPath: '/@jb6', 
      diskPath: path.join(repoRoot, 'node_modules/@jb6'), 
      pkgId: '@jb6' 
    },
    { 
      urlPath: '/', 
      diskPath: repoRoot, 
      pkgId: pkg.name 
    }
  ]
  
  return {
    importMap: { imports },
    staticMappings,
    environment: 'extension'
  }
}

// ============================================================================= 
// APP PACKAGE STATIC CONFIG
// =============================================================================

async function getAppStaticConfig(repoRoot, {includeHidden}) {
  const path = await import('path')
  const { readFile } = await import('fs/promises')
  
  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  const jb6Deps = Object.keys(pkg.dependencies || {}).filter(dep => dep.startsWith('@jb6/'))
  
  // Generate import map for JB6 packages only
  const imports = Object.fromEntries(
    jb6Deps.flatMap(dep => {
      const name = dep.replace('@jb6/', '')
      return [
        [dep, `/@jb6/${name}/index.js`],
        [`${dep}/`, `/@jb6/${name}/`]
      ]
    })
  )
  
  // Static mappings - only JB6 packages, no local serving
  const staticMappings = [
    { 
      urlPath: '/@jb6', 
      diskPath: path.join(repoRoot, 'node_modules/@jb6'), 
      pkgId: '@jb6' 
    }
  ]
  
  return {
    importMap: { imports },
    staticMappings,
    environment: 'app'
  }
}

// ============================================================================= 
// FILE CONTEXT IMPLEMENTATION
// =============================================================================

async function normalizeToValidEntryPoints(entryPointPaths, {forDsls}) {
  const path = await import('path')
  const { access, stat } = await import('fs/promises')
  
  let entryPoints = []
  
  // Handle different input types
  if (Array.isArray(entryPointPaths)) {
    entryPoints = entryPointPaths
  } else if (typeof entryPointPaths === 'string') {
    entryPoints = [entryPointPaths]
  } else if (forDsls) {
    // DSL-based discovery
    entryPoints = await discoverDslEntryPoints(forDsls)
  } else {
    throw new ServiceError('Must provide either entryPointPaths or forDsls option', 'INVALID_INPUT', { entryPointPaths, forDsls })
  }
  
  // Validate and normalize entry points
  const validEntryPoints = []
  for (const entryPointPath of entryPoints) {
    try {
      await access(entryPointPath)
      const stats = await stat(entryPointPath)
      
      if (stats.isDirectory()) {
        // Find main entry in directory
        const mainEntry = await findMainEntryInDirectory(entryPointPath)
        if (mainEntry) validEntryPoints.push(mainEntry)
      } else {
        validEntryPoints.push(entryPointPath)
      }
    } catch (error) {
      console.warn(`Warning: Entry point not accessible: ${entryPointPath}`)
    }
  }
  
  return validEntryPoints
}

async function discoverDslEntryPoints(forDsls) {
  // Use existing filePathsForDsls logic
  const path = await import('path')
  const dsls = Array.isArray(forDsls) ? forDsls : (forDsls||'').split(',').map(x=>x.trim()).filter(Boolean)
  const repoRoot = await calcRepoRoot()
  
  // List files in repo and node_modules
  const listRepo = await listRepoFiles(repoRoot)
  let jb6NodeModulesList = { files: []}
  
  try {
    const { createRequire } = await import('module')
    const jb6CorePath = createRequire(path.join(repoRoot, 'package.json')).resolve('@jb6/core')
    if (jb6CorePath.includes('node_modules/@jb6')) {
      jb6NodeModulesList = await listRepoFiles(path.dirname(path.dirname(jb6CorePath)))
    }
  } catch (e) {}
  
  const files = [...listRepo.files, ...jb6NodeModulesList.files].map(x=>x.path)
  return dsls.flatMap(dsl=> files.filter(f=>f.endsWith(`${dsl}/index.js`))).map(localPath=>path.join(repoRoot,localPath))
}

async function findMainEntryInDirectory(dirPath) {
  const path = await import('path')
  const { access } = await import('fs/promises')
  
  // Try common entry file names
  const candidates = ['index.js', 'main.js']
  
  for (const candidate of candidates) {
    const candidatePath = path.join(dirPath, candidate)
    try {
      await access(candidatePath)
      return candidatePath
    } catch (error) {
      // Continue to next candidate
    }
  }
  
  return null
}

async function calcRepoRootFromPath(filePath) {
  const path = await import('path')
  
  // Walk up from file path to find git root or package.json
  let currentDir = path.dirname(filePath)
  const { access } = await import('fs/promises')
  
  while (currentDir !== '/' && currentDir !== '.') {
    try {
      // Check for .git directory or package.json
      await access(path.join(currentDir, '.git'))
      return currentDir
    } catch (error) {
      try {
        await access(path.join(currentDir, 'package.json'))
        // Found package.json, but continue looking for git root
        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) break // Reached filesystem root
        currentDir = parentDir
      } catch (error2) {
        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) break // Reached filesystem root
        currentDir = parentDir
      }
    }
  }
  
  // Fallback to calcRepoRoot if available
  try {
    return await calcRepoRoot()
  } catch (error) {
    throw new ServiceError('Cannot determine repository root', 'INVALID_INPUT', { filePath })
  }
}

async function generateImportMap(repoRoot, environment) {
  // Reuse logic from getStaticServeConfig but return more complete structure
  if (environment === 'jb6-monorepo') {
    const config = await getMonorepoStaticConfig(repoRoot, {})
    return {
      imports: config.importMap.imports,
      serveEntries: config.staticMappings.map(mapping => ({
        urlPath: mapping.urlPath,
        pkgDir: mapping.diskPath,
        pkgId: mapping.pkgId
      }))
    }
  } else if (environment === 'extension') {
    const config = await getExtensionStaticConfig(repoRoot, {})
    return {
      imports: config.importMap.imports,
      serveEntries: config.staticMappings.map(mapping => ({
        urlPath: mapping.urlPath,
        pkgDir: mapping.diskPath,
        pkgId: mapping.pkgId
      }))
    }
  } else {
    const config = await getAppStaticConfig(repoRoot, {})
    return {
      imports: config.importMap.imports,
      serveEntries: config.staticMappings.map(mapping => ({
        urlPath: mapping.urlPath,
        pkgDir: mapping.diskPath,
        pkgId: mapping.pkgId
      }))
    }
  }
}

async function discoverFilesFromEntryPoints(entryPointPaths, importMapData, environment, fileOptions) {
  const discoveredFiles = {
    sourceFiles: [],
    testFiles: [],
    llmGuideFiles: []
  }
  
  // Start with entry points as source files
  discoveredFiles.sourceFiles.push(...entryPointPaths)
  
  // Discover additional files based on environment
  if (environment === 'jb6-monorepo') {
    await discoverMonorepoFiles(discoveredFiles, importMapData, fileOptions)
  } else if (environment === 'extension') {
    await discoverExtensionFiles(discoveredFiles, importMapData, fileOptions)
  } else {
    await discoverAppFiles(discoveredFiles, importMapData, fileOptions)
  }
  
  // Remove duplicates and filter
  discoveredFiles.sourceFiles = unique(discoveredFiles.sourceFiles)
  discoveredFiles.testFiles = unique(discoveredFiles.testFiles)
  discoveredFiles.llmGuideFiles = unique(discoveredFiles.llmGuideFiles)
  
  return discoveredFiles
}

async function discoverMonorepoFiles(discoveredFiles, importMapData, fileOptions) {
  const path = await import('path')
  
  // Find repo root from serveEntries
  const packagesEntry = importMapData.serveEntries.find(entry => entry.urlPath === '/packages')
  if (!packagesEntry) return
  
  const packagesDir = packagesEntry.pkgDir
  
  // Discover files in packages directory
  await discoverFilesInDirectory(packagesDir, discoveredFiles, fileOptions)
}

async function discoverExtensionFiles(discoveredFiles, importMapData, fileOptions) {
  // Find both JB6 node_modules and local repo root
  const jb6Entry = importMapData.serveEntries.find(entry => entry.urlPath === '/@jb6')
  const localEntry = importMapData.serveEntries.find(entry => entry.urlPath === '/')
  
  if (jb6Entry) {
    await discoverFilesInDirectory(jb6Entry.pkgDir, discoveredFiles, fileOptions)
  }
  
  if (localEntry) {
    await discoverFilesInDirectory(localEntry.pkgDir, discoveredFiles, fileOptions, { includeRoot: true })
  }
}

async function discoverAppFiles(discoveredFiles, importMapData, fileOptions) {
  // App packages only have JB6 dependencies, no local files to discover
  const jb6Entry = importMapData.serveEntries.find(entry => entry.urlPath === '/@jb6')
  
  if (jb6Entry) {
    await discoverFilesInDirectory(jb6Entry.pkgDir, discoveredFiles, fileOptions)
  }
}

async function discoverFilesInDirectory(dirPath, discoveredFiles, fileOptions, dirOptions = {}) {
  const { readdir } = await import('fs/promises')
  const path = await import('path')
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        // Recursively discover in subdirectories
        await discoverFilesInDirectory(fullPath, discoveredFiles, fileOptions, dirOptions)
      } else if (entry.isFile()) {
        // Categorize files
        categorizeFile(fullPath, discoveredFiles, fileOptions)
      }
    }
  } catch (error) {
    console.warn(`Warning: Cannot read directory ${dirPath}:`, error.message)
  }
}

function categorizeFile(filePath, discoveredFiles, fileOptions) {
  const path = require('path')
  const fileName = path.basename(filePath)
  const dirName = path.basename(path.dirname(filePath))
  
  // Test files
  if ((fileName.includes('test') || fileName.includes('spec') || dirName === 'tests') && fileOptions.includeTestFiles) {
    discoveredFiles.testFiles.push(filePath)
  }
  // LLM Guide files
  else if ((fileName.includes('llm-guide') || dirName === 'llm-guide') && fileOptions.includeLlmGuides) {
    discoveredFiles.llmGuideFiles.push(filePath)
  }
  // Source files (JavaScript files that aren't tests or guides)
  else if (fileName.endsWith('.js') || fileName.endsWith('.mjs')) {
    discoveredFiles.sourceFiles.push(filePath)
  }
}

function createResolver(importMapData) {
  return function resolver(specifier) {
    // Find matching import map entry
    let winner = ''
    for (const key in importMapData.imports) {
      if ((specifier === key || specifier.startsWith(key)) && key.length > winner.length) {
        winner = key
      }
    }
    
    if (!winner) return undefined
    
    const target = importMapData.imports[winner]
    const rest = specifier.slice(winner.length)
    const urlToBeServed = target.endsWith('/') ? target + rest : target
    
    // Convert URL back to file path using serveEntries
    const dirEntry = importMapData.serveEntries.find(({urlPath}) => urlToBeServed.startsWith(urlPath))
    if (dirEntry) {
      const restPath = urlToBeServed.slice(dirEntry.urlPath.length)
      return pathJoin(dirEntry.pkgDir, restPath)
    }
    
    return urlToBeServed
  }
}

function createContentFetcher(importMapData) {
  return async function contentFetcher(filePath, lineStart, lineEnd) {
    // Use existing fetchByEnv but with our serveEntries
    const { fetchByEnv } = coreUtils
    const content = await fetchByEnv(filePath, importMapData.serveEntries)
    
    if (lineStart !== undefined && lineEnd !== undefined) {
      const lines = content.split('\n')
      return lines.slice(lineStart, lineEnd + 1).join('\n')
    }
    
    return content
  }
}

// Helper function to list repo files (simplified version)
async function listRepoFiles(repoRoot) {
  const { readdir } = await import('fs/promises')
  const path = await import('path')
  
  const files = []
  
  async function walkDir(dir, relativePath = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue // Skip hidden files/dirs
        if (entry.name === 'node_modules') continue // Skip node_modules
        
        const fullPath = path.join(dir, entry.name)
        const relPath = path.join(relativePath, entry.name)
        
        if (entry.isDirectory()) {
          await walkDir(fullPath, relPath)
        } else {
          files.push({ path: relPath })
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }
  
  await walkDir(repoRoot)
  return { files }
}

// ============================================================================= 
// UPDATED UTILITY FUNCTIONS FOR NEW STRUCTURE
// =============================================================================

// Update resolveWithImportMap to work with our new structure
function resolveWithImportMapNew(specifier, importMapData) {
  // importMapData can be either:
  // - Old structure: {imports: {...}, serveEntries: [...]}  
  // - New structure: same as old but from our services
  
  const imports = importMapData.imports || importMapData.importMap?.imports
  const serveEntries = importMapData.serveEntries || importMapData.staticMappings?.map(m => ({
    urlPath: m.urlPath,
    pkgDir: m.diskPath || m.pkgDir,
    pkgId: m.pkgId
  }))
  
  if (!imports || !serveEntries) {
    console.warn('resolveWithImportMap: Invalid importMapData structure', importMapData)
    return undefined
  }
  
  // Use existing logic
  let winner = ''
  for (const key in imports) {
    if ((specifier === key || specifier.startsWith(key)) && key.length > winner.length) {
      winner = key
    }
  }
  
  if (!winner) return undefined
  
  const target = imports[winner]
  const rest = specifier.slice(winner.length)
  const urlToBeServed = target.endsWith('/') ? target + rest : target
  const dirEntry = serveEntries.find(({urlPath}) => urlToBeServed.startsWith(urlPath))
  
  if (dirEntry) {
    const restPath = urlToBeServed.slice(dirEntry.urlPath.length)
    return pathJoin(dirEntry.pkgDir, restPath)
  }
  
  return urlToBeServed
}

// Update fetchByEnv to handle both old and new structures
async function fetchByEnvNew(url, serveEntriesOrImportMap = []) {
  // Handle both old and new calling patterns
  let serveEntries = serveEntriesOrImportMap
  
  // If passed an importMap object, extract serveEntries
  if (serveEntriesOrImportMap && typeof serveEntriesOrImportMap === 'object' && !Array.isArray(serveEntriesOrImportMap)) {
    serveEntries = serveEntriesOrImportMap.serveEntries || 
                   serveEntriesOrImportMap.staticMappings?.map(m => ({
                     urlPath: m.urlPath,
                     pkgDir: m.diskPath || m.pkgDir,
                     pkgId: m.pkgId
                   })) || []
  }
  
  // Use existing fetchByEnv logic
  if (globalThis.window) {
    const { absPathToUrl, logError } = coreUtils
    const rUrl = absPathToUrl(url, serveEntries)
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

// ============================================================================= 
// BACKWARD COMPATIBILITY - NEEDED because existing clients call these functions
// =============================================================================

// Store original implementations
const resolveWithImportMapOriginal = coreUtils.resolveWithImportMap
const fetchByEnvOriginal = coreUtils.fetchByEnv

// Replace existing functions to handle both old and new structures  
Object.assign(jb.coreUtils, {
  resolveWithImportMap: function(specifier, importMapData) {
    // The TGP Model Builder (and potentially other clients) call:
    // resolveWithImportMap(url, projectImportMap) 
    // 
    // We need this to work with our new importMap structure without
    // changing every call site across the codebase
    return resolveWithImportMapNew(specifier, importMapData)
  },
  
  fetchByEnv: function(url, serveEntriesOrImportMap) {
    // Multiple clients call:
    // fetchByEnv(filePath, projectImportMap.serveEntries)
    // fetchByEnv(filePath, importMap.serveEntries) 
    //
    // We need this to work with our new structure
    return fetchByEnvNew(url, serveEntriesOrImportMap)
  }
})

// ============================================================================= 
// ERROR HANDLING
// =============================================================================

class ServiceError extends Error {
  constructor(message, code, details) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.details = details
  }
}
