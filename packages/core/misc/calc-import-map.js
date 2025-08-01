import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import './jb-cli.js'
const { coreUtils } = jb
const { isNode, logException, logVsCode, pathJoin } = coreUtils
Object.assign(coreUtils, { calcImportMap, resolveWithImportMap, studioAndProjectImportMaps, calcRepoRoot, 
  calcImportMapOfRepoRoot, filePathsForDsls, listRepoFiles })

jb.importMapCache = {
  studioAndProjectImportMaps: {}

}

async function filePathsForDsls(_dsls) {
  if (!isNode) {
        const script = `import { coreUtils } from '@jb6/core'
    import '@jb6/core/misc/calc-import-map.js'
    ;(async()=>{
    try {
      const result = await coreUtils.filePathsForDsls('${_dsls}')
      process.stdout.write(JSON.stringify(result,null,2))
    } catch (e) { console.error(e) }
    })()`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }
  const path = await import('path')
  const dsls = Array.isArray(_dsls) ? _dsls : (_dsls||'').split(',').map(x=>x.trim()).filter(Boolean)
  const repoRoot = await calcRepoRoot()
  const listRepo = await listRepoFiles(repoRoot)
  let jb6NodeModulesList = { files: []}
  try {
      const jb6CorePath = createRequire(path.join(repoRoot, 'package.json')).resolve('@jb6/core')
      if (jb6CorePath.includes('node_modules/@jb6'))
        jb6NodeModulesList = await listRepoFiles(path.dirname(path.dirname(jb6CorePath)))
  } catch (e) {}

  const files = [...listRepo.files, ...jb6NodeModulesList.files].map(x=>x.path)
  return dsls.flatMap(dsl=> files.filter(f=>f.endsWith(`${dsl}/index.js`))).map(localPath=>path.join(repoRoot,localPath))
}

async function studioAndProjectImportMaps(filePath) {
  if (jb.importMapCache.studioAndProjectImportMaps[filePath])
    return jb.importMapCache.studioAndProjectImportMaps[filePath]
  if (!isNode) {
        const script = `
  import { coreUtils } from '@jb6/core'
  import '@jb6/core/misc/calc-import-map.js'

  ;(async()=>{
    try {
      const result = await coreUtils.studioAndProjectImportMaps('${filePath}')
      process.stdout.write(JSON.stringify(result,null,2))
    } catch (e) {
      console.error(e)
    }
  })()`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }
  const repoRoot = globalThis.VSCodeWorkspaceProjectRoot || await calcRepoRoot()
  const studioRoot = globalThis.VSCodeStudioExtensionRoot || `${repoRoot}/hosts/vscode-tgp-lang`
  const projectRoot = await findProjectRoot(filePath, repoRoot)
  const projectRootImportMap = await calcImportMapOfRepoRoot(projectRoot, { repoRoot, includeTesting: true })
  const testFiles = projectRootImportMap.serveEntries.flatMap(({tests}) => tests).filter(Boolean)
  const llmGuideFiles = projectRootImportMap.serveEntries.flatMap(({llmGuides}) => llmGuides).filter(Boolean)

  return jb.importMapCache.studioAndProjectImportMaps[filePath] = { 
      studioImportMap: await calcImportMapOfRepoRoot(studioRoot, { repoRoot }), 
      projectImportMap: {projectRoot, ...await calcImportMapOfRepoRoot(projectRoot, { repoRoot, includeTesting: true }) },
      testFiles,
      llmGuideFiles
    }
}

async function findProjectRoot(filePath, repoRoot) {
  const path = await import('path')
  const { access } = await import('fs/promises')
  
  let currentDir = path.dirname(filePath)
  
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
  const dirEntry = (serveEntries || []).find(({urlPath}) => urlToBeServed.startsWith(urlPath))
  if (dirEntry) {
    const restPath = urlToBeServed.slice(dirEntry.urlPath.length)
    return pathJoin(dirEntry.pkgDir, restPath)
  }
  return urlToBeServed

  // function pathJoin(a, b) {
  //   return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
  // }
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
    const imports = Object.fromEntries(
      folders.flatMap(f => [
        [`@jb6/${f}`,  `/packages/${f}/index.js`],
        [`@jb6/${f}/`, `/packages/${f}/`]          // enables sub-path imports
      ])
    )    
    const serveEntries = [{urlPath: '/packages', pkgId: '@jb6/packages', pkgDir: pkgsDir}, {urlPath: '/hosts', pkgDir: path.resolve(repoRoot, 'hosts')}]    
    const res = { imports: { ...imports, '#jb6/': '/packages/' }, serveEntries }
    logVsCode('calcImportMap', res)
    return res
  } else {
    return calcImportMapOfRepoRoot(repoRoot)
  }
}

async function calcImportMapOfRepoRoot(projectRoot, { repoRoot = '', includeTesting } = {}) {
  logVsCode('calcImportMapOfRepoRoot start', projectRoot)
  const { readFile, realpath, readdir, access } = await import('fs/promises')
  try {
    await access(projectRoot)
  } catch (err) {
    return { repoRoot, imports : {}, serveEntries: [], error: `${repoRoot} does not exist` }
  }
  const path = await import('path')
  const { createRequire } = await import('module')

  const monorepo  = await isMonorepo(projectRoot)
  if (monorepo) {
    const monoRepoShortcut = '@jb6'
    const pkgsDir = path.resolve(projectRoot, 'packages')
    const entries = await readdir(pkgsDir, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
    const res = await Promise.all(folders.map(f => calcImportMapOfRepoRoot(path.join(pkgsDir, f), { repoRoot, includeTesting })))
    const selfImports = Object.fromEntries(folders.flatMap(f => [[`${monoRepoShortcut}/${f}`,  `${pkgsDir}/${f}/index.js`], 
      [`${monoRepoShortcut}/${f}/`, `${pkgsDir}/${f}/`] ]))
    const serveEntries = { 'monoRepo' : {urlPath: '/packages', pkgDir: pkgsDir, pkgId: monoRepoShortcut} }
    for (const f of folders) {
      const supportingFiles = await calcSupportingFiles(path.join(pkgsDir, f),`${monoRepoShortcut}/${f}`)
      serveEntries[`/${f}`] = { urlPath: `/packages/${f}`, pkgDir: path.join(pkgsDir, f), pkgId: `${monoRepoShortcut}/${f}`, ...supportingFiles }
    }
    res.forEach(r => r.serveEntries.forEach(x=> serveEntries[x.urlPath] = {
      ...serveEntries[x.urlPath], ...x
    }))
    const result = {
      imports: { ...selfImports, ...Object.fromEntries(res.flatMap(r => Object.entries(r.imports))) },
      serveEntries: Object.values(serveEntries)
    }
    logVsCode('calcImportMapOfRepoRoot mono repo', projectRoot, result)
    return result
  }

  const pkg = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
  const serveEntries = []
  const [pkgDir,pkgId,indexPath] = [projectRoot,pkg.name,`${projectRoot}/index.js`]
  const supportingFiles = await calcSupportingFiles(pkgDir,pkgId)
  const packages = { [pkgId] : {pkgDir, indexPath, ...supportingFiles}}
  const visited = new Set()
  await crawl(projectRoot)
  const moreRoots = resolvePkgIds(projectRoot,(includeTesting ? ['@jb6/testing','@jb6/llm-guide'] : []))
  await Promise.all(Object.entries(moreRoots).map( async ([pkgId, indexPath]) => {
    const pkgDir = await realpath(path.dirname(indexPath))
    packages[pkgId] = {pkgDir, indexPath}
    await crawl(pkgDir,pkgId,indexPath)
  }))

  const imports = Object.fromEntries(Object.entries(packages).flatMap(([pkgId, {pkgDir, indexPath, ...rest}]) => {
      const localDir = pkgDir.replace(repoRoot,'')
      serveEntries.push({urlPath: localDir, pkgDir, pkgId, ...rest})
      return [
        [ pkgId, indexPath.replace(repoRoot,'')],
        [`${pkgId}/`, `${localDir}/`]
      ]
    }))
  serveEntries.push({urlPath: '/packages', pkgDir: path.join(repoRoot, 'packages'), pkgId: 'repoRoot'})
        
  const result = { repoRoot, imports, serveEntries }
  logVsCode('calcImportMapOfRepoRoot', projectRoot, result)
  return result

  async function crawl(pkgDir) {
    if (visited.has(pkgDir)) return
    visited.add(pkgDir)
    const pkg = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'))
    const dependencies = Object.keys(pkg.dependencies || {}).filter(d=>d.startsWith('@jb6/'))
    const resolved = resolvePkgIds(pkgDir,dependencies)
    await Promise.all(Object.entries(resolved).map( async ([pkgId, indexPath]) => {
      const pkgDir = await realpath(path.dirname(indexPath))
      packages[pkgId] = {pkgDir, indexPath}
      await crawl(pkgDir,pkgId,indexPath)
    }))
  }

  function resolvePkgIds(pkgDir, ids) {
    const localCreateRequire = createRequire(path.join(pkgDir, 'package.json'))
    return Object.fromEntries(ids.flatMap(d=>{ 
      try {
        return [[d,localCreateRequire.resolve(d)]]
      } catch (e) {
        console.error(`Error resolving ${d} in ${pkgDir}`, e)
        return []
      }
    }))
  }

  async function calcSupportingFiles(pkgDir,pkgId) {
    const pkgPrefix = pkgDir
    const files = await readdir(pkgDir, { withFileTypes: true })
    const listFiles = async (subDir) => (await readdir(subDir, { withFileTypes: true }).catch(() => []))
      .filter(file => file.isFile()).map(file => path.join(pkgPrefix, path.join(subDir, file.name).replace(pkgDir,'')))  

    const testsDirFiles = await listFiles(path.join(pkgDir, 'tests'))
    const llmGuideDirFiles = await listFiles(path.join(pkgDir, 'llm-guide'))
    const tests = files.filter(file => file.isFile() && file.name.match(/test/)).map(file => path.join(pkgPrefix, file.name))
    const llmGuides = files.filter(file => file.isFile() && file.name.endsWith('llm-guide.js')).map(file => path.join(pkgPrefix, file.name))
    return { tests: [...tests, ...testsDirFiles], llmGuides: [...llmGuides, ...llmGuideDirFiles] }
  }
}


let _repoRoot
async function calcRepoRoot() {
  if (_repoRoot) return _repoRoot
  if (!isNode) {
    const script = `
    import { coreUtils } from '@jb6/core'
    import '@jb6/core/misc/calc-import-map.js'
    try {
      const result = await coreUtils.calcRepoRoot()
      process.stdout.write(JSON.stringify(result,null,2))
    } catch (e) {
      process.stdout.write(JSON.stringify(e,null,2))
    }`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return _repoRoot = res.result
  }
  const { execSync } = await import('child_process')
  if (jb.coreRegistry.repoRoot)
    return jb.coreRegistry.repoRoot
  return _repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

async function isMonorepo(repoRoot) {
  const { readFile } = await import('fs/promises')
  const path = await import('path')
  const rootPkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  return rootPkg.workspaces
}

async function isJB6Dev() {
  const { readFile } = await import('fs/promises')
  const path = await import('path')

  try {
    const repoRoot = await calcRepoRoot()
    const rootPkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
    return rootPkg.name == 'jb6-monorepo'
  } catch (e) { 
    logException(e, 'Error checking JB6 repo')
    return false
  }
}

async function listRepoFiles(repoRoot, {includeHidden } = {}) {
    try {
      const { readdirSync, statSync, readFileSync } = await import('fs')
      const { join, relative, sep } = await import('path')
      
      let gitignorePatterns = []
      try {
        const gitignoreContent = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
        gitignorePatterns = gitignoreContent.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))
      } catch (error) {}
      
      gitignorePatterns.push('.git', 'node_modules')
      const isIgnored = (filePath) => {
        const relativePath = relative(repoRoot, filePath).replace(/\\/g, '/')
        const pathParts = relativePath.split('/')
        
        return gitignorePatterns.some(pattern => {
          if (pattern.endsWith('/')) {
            const dirPattern = pattern.slice(0, -1)
            return pathParts.includes(dirPattern)
          }
          if (pattern.includes('*')) {
            const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')
            return new RegExp(`^${regexPattern}$`).test(relativePath) ||
                   pathParts.some(part => new RegExp(`^${regexPattern}$`).test(part))
          }
          return relativePath === pattern || relativePath.endsWith('/' + pattern) || pathParts.includes(pattern)
        })
      }
      
      const walkDirectory = (dirPath) => {
        const files = []
        try {
          const entries = readdirSync(dirPath)
          
          for (const entry of entries) {
            const fullPath = join(dirPath, entry)
            if (!includeHidden && entry.startsWith('.') && entry !== '.gitignore')  continue
            if (isIgnored(fullPath)) continue
            
            try {
              const stats = statSync(fullPath)              
              if (stats.isFile()) {
                const relativePath = relative(repoRoot, fullPath)
                files.push({
                  path: relativePath,
                  size: stats.size,
                  sizeFormatted: formatBytes(stats.size),
                  modified: stats.mtime.toISOString()
                })
              } else if (stats.isDirectory()) {
                files.push(...walkDirectory(fullPath))
              }
            } catch (statError) {
              continue
            }
          }
        } catch (readError) {}
        return files
      }
      
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }
      
      const files = walkDirectory(repoRoot)
      files.sort((a, b) => a.path.localeCompare(b.path))
      const totalSize = files.reduce((sum, file) => sum + file.size, 0)
      const summary = `Total: ${files.length} files, ${formatBytes(totalSize)}`
      return { files, totalSize, summary }
    } catch (error) {
      return {error}
    }
}
