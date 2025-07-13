import { jb } from '@jb6/repo'
import '../utils/core-utils.js'
import './jb-cli.js'
const { coreUtils } = jb
const { isNode, logException } = coreUtils
Object.assign(coreUtils, { calcImportMap, resolveWithImportMap, studioAndProjectImportMaps, calcRepoRoot, calcImportMapOfRepoRoot, dslDocs })

jb.importMapCache = {
  studioAndProjectImportMaps: {}

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
  const projectRootImportMap = await calcImportMapOfRepoRoot(projectRoot, { servingRoot: projectRoot, includeTesting: true })
  const testFiles = projectRootImportMap.serveEntries.flatMap(({tests}) => tests).filter(Boolean)
  const llmGuideFiles = projectRootImportMap.serveEntries.flatMap(({llmGuides}) => llmGuides).filter(Boolean)

  return jb.importMapCache.studioAndProjectImportMaps[filePath] = { 
      studioImportMap: await calcImportMapOfRepoRoot(studioRoot, { servingRoot: repoRoot }), 
      projectImportMap: {projectRoot, ...await calcImportMapOfRepoRoot(projectRoot, { servingRoot: repoRoot, includeTesting: true }) },
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
    //logCli('JB6 dev mode: calcImportMap', res)
    return res
  } else {
    return calcImportMapOfRepoRoot(repoRoot)
  }
}

async function calcImportMapOfRepoRoot(repoRoot, { servingRoot = '', includeTesting } = {}) {
  const { readFile, realpath, readdir } = await import('fs/promises')
  const path = await import('path')
  const { createRequire } = await import('module')

  const monorepo  = await isMonorepo(repoRoot)
  if (monorepo) {
    const monoRepoShortcut = '@jb6'
    const pkgsDir = path.resolve(repoRoot, 'packages')
    const entries = await readdir(pkgsDir, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
    const res = await Promise.all(folders.map(f => calcImportMapOfRepoRoot(path.join(pkgsDir, f), { servingRoot, includeTesting })))
    const selfImports = Object.fromEntries(folders.flatMap(f => [[`${monoRepoShortcut}/${f}`,  `${pkgsDir}/${f}/index.js`], 
      [`${monoRepoShortcut}/${f}/`, `${pkgsDir}/${f}/`] ]))
    const serveEntries = {}
    for (const f of folders) {
      const supportingFiles = await calcSupportingFiles(path.join(pkgsDir, f),`${monoRepoShortcut}/${f}`)
      serveEntries[`/${f}`] = { dir: `/packages/${f}`, pkgDir: path.join(pkgsDir, f), pkgId: `${monoRepoShortcut}/${f}`, ...supportingFiles }
    }
    res.forEach(r => r.serveEntries.forEach(x=> serveEntries[x.dir] = {
      ...serveEntries[x.dir], ...x
    }))
    return {
      imports: { ...selfImports, ...Object.fromEntries(res.flatMap(r => Object.entries(r.imports))) },
      serveEntries: Object.values(serveEntries)
    }
  }

  const serveEntries = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')).serveEntries || []
  const supportingFiles = await calcSupportingFiles(repoRoot, '@currentProject')
  serveEntries.push({dir: repoRoot, pkgDir: repoRoot, pkgId: '@currentProject', ...supportingFiles})
  const packages = {}
  const visited = new Set()
  await crawl(repoRoot)

  const imports = Object.fromEntries(Object.entries(packages).flatMap(([pkgId, {pkgDir, pkgPath, ...rest}]) => {
      const localDir = pkgDir.replace(servingRoot,'')
      serveEntries.push({dir: localDir, pkgDir, pkgId, ...rest})
      return [
        [ pkgId, pkgPath.replace(servingRoot,'')],
        [`${pkgId}/`, `${localDir}/`]
      ]
    }))
        
  return { repoRoot, imports, serveEntries }

  async function crawl(dir) {
    if (visited.has(dir)) return
    visited.add(dir)
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
    const dependencies = [...Object.keys(pkg.dependencies || {}), 
      ...(dir == repoRoot && includeTesting ? ['@jb6/testing','@jb6/llm-guide'] : [])].filter(d=>d.startsWith('@jb6/'))
    const localCreateRequire = createRequire(path.join(dir, 'package.json'))
    const resolved = Object.fromEntries(dependencies.flatMap(d=>{ 
      try {
        return [[d,localCreateRequire.resolve(d)]]
      } catch (e) {
        console.error(`Error resolving ${d} in ${dir}`, e)
        return []
      }
    }))
    await Promise.all(Object.entries(resolved).map( async ([pkgId, pkgPath]) => {
      const pkgDir = await realpath(path.dirname(pkgPath))
      const supportingFiles = await calcSupportingFiles(pkgDir,pkgId)
      packages[pkgId] = {pkgDir, pkgPath, ...supportingFiles}
      await crawl(pkgDir)
    }))
  }

  async function calcSupportingFiles(pkgDir,pkgId) {
    const pkgPrefix = pkgDir
    const files = await readdir(pkgDir, { withFileTypes: true })
    const listFiles = async (subDir) => (await readdir(subDir, { withFileTypes: true }).catch(() => []))
      .filter(file => file.isFile()).map(file => path.join(pkgPrefix, path.join(subDir, file.name).replace(pkgDir,'')))  

    const testsDirFiles = await listFiles(path.join(pkgDir, 'tests'))
    const llmGuideDirFiles = await listFiles(path.join(pkgDir, 'llm-guide'))
    const tests = files.filter(file => file.isFile() && file.name.endsWith('test.js')).map(file => path.join(pkgPrefix, file.name))
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
  const cwd = jb.coreRegistry.repoRoot
  return _repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', cwd }).trim()
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

async function dslDocs(args) {
  const {dsl, repoRoot} = args
  if (!isNode) {
    const script = `
    import { coreUtils } from '@jb6/core'
    import '@jb6/core/misc/calc-import-map.js'
    import '@jb6/lang-service'
    console.log = () => {}

    try {
      const result = await coreUtils.dslDocs(${JSON.stringify(args)})
      process.stdout.write(JSON.stringify(result,null,2))
    } catch (e) {
      process.stdout.write(JSON.stringify(e,null,2))
    }`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return _repoRoot = res.result
  }
  const { readFileSync } = await import('fs')
  const { join } = await import('path')

  try {
    const { llmGuideFiles } = await studioAndProjectImportMaps(repoRoot)
    const tgpModel = await coreUtils.calcTgpModelData()
    const dslPackage = `@jb6/\${dsl}`
    const corePackage = '@jb6/core'
    const llmGuidePackage = '@jb6/llm-guide'
    const includeDsls = [dsl,'llm-guide','core','testing']
    const relevantGuides = llmGuideFiles.filter(file => includeDsls.some(dsl=>file.indexOf(dsl)) != -1)
    
    const llmGuides = await Promise.all(relevantGuides.map(async (filePath) => {
        try {
            const content = readFileSync(filePath, 'utf8')
            return { filePath, content, tokens: coreUtils.estimateTokens(content) }
        } catch (e) {}
    })).then(results => results.filter(Boolean))
    const filePaths = coreUtils.unique(Object.values(tgpModel.dsls[dsl])
        .flatMap(t=>Object.values(t).map(c=>c.$location?.path))).filter(x=>x && x.indexOf(`/${dsl}/`) != -1)
    const testingFiles = ['packages/testing/tester.js']
    const allFiles = [...filePaths, ...testingFiles]
    const componentFiles = await Promise.all(allFiles.map(async (filePath) => {
        try {
            const content = readFileSync(filePath, 'utf8')
            return { filePath, content, tokens: coreUtils.estimateTokens(content) }
        } catch (e) {}
    })).then(results => results.filter(Boolean))
        
    const result = {
      dsl,
      tgpModel: {
        description: 'System architecture, imports, and package structure',
        content: tgpModel,
        tokens: coreUtils.estimateTokens(JSON.stringify(tgpModel))
      },
      llmGuides: {
        description: 'All documentation: DSL-specific, core TGP guides, and generic LLM principles',
        files: llmGuides,
        totalFiles: llmGuides.length,
        tokens: llmGuides.reduce((sum, f) => sum + f.tokens, 0),
        breakdown: {
          dslSpecific: llmGuides.filter(f => f.package === dslPackage).length,
          coreGuides: llmGuides.filter(f => f.package === corePackage).length,
          genericGuides: llmGuides.filter(f => f.package === llmGuidePackage).length
        }
      },
      componentSource: {
        description: 'All component definitions, implementations, and source code',
        files: componentFiles,
        totalFiles: componentFiles.length,
        tokens: componentFiles.reduce((sum, f) => sum + f.tokens, 0)
      }
    }
    
    const totalTokens = result.tgpModel.tokens + result.llmGuides.tokens + result.componentSource.tokens
    result.summary = {
      totalTokens: totalTokens,
      totalFiles: result.llmGuides.totalFiles + result.componentSource.totalFiles,
      tokens: {
        capacity: 200000,
        used: totalTokens,
        percentageUsed: ((totalTokens / 200000) * 100).toFixed(1) + '%',
        remaining: 200000 - totalTokens,
        status: totalTokens < 20000 ? 'EXCELLENT' : totalTokens < 50000 ? 'GOOD' : 'LARGE'
      }
    }
    return result    
  } catch (error) {
    return { error: error.message }
  }
}