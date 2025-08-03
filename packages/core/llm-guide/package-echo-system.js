import { dsls } from '@jb6/core'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { whenToUse, performance, comparison, syntax, explanation, methodology, evidence, impact },
    problemStatement: { problem }
  } 
} = dsls

// ===== JB6 PACKAGE ECOSYSTEM TERMINOLOGY =====

Doclet('repositoryTypes', {
  impl: principle('critical', 'JB6 ecosystem supports three distinct repository types with specific purposes and structures', {
    rationale: 'Understanding repository types is essential for file discovery, import resolution, and service configuration. Each type requires different handling strategies.',
    guidance: [
      solution({
        code: `// Three Repository Types:

// 1. JB6 MONOREPO - Framework Development
/jb6-monorepo/
  packages/
    core/index.js           ← Source files
    common/index.js
    testing/index.js

// 2. EXTENSION PACKAGE - Extends JB6 with Custom Components  
/my-extension/
  node_modules/@jb6/       ← Published jb6 dependencies
    core/index.js
    common/index.js
  main.js                  ← Custom components
  my-tests.js              ← Custom tests

// 3. APP PACKAGE - Consumes JB6 Only
/my-app/
  node_modules/@jb6/       ← Published jb6 dependencies only
  src/app.js               ← Application code (no TGP components)`,
        points: [
          explanation('JB6 Monorepo contains source packages for framework development'),
          explanation('Extension Package adds custom TGP components while depending on published jb6'),
          explanation('App Package only consumes jb6 components without extending the system'),
          whenToUse('JB6 Monorepo for framework development and contribution'),
          whenToUse('Extension Package for building custom DSLs and components'),
          whenToUse('App Package for end applications using jb6 without extension')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Repository Detection Pattern
const rootPkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
const isJB6Monorepo = rootPkg.name === 'jb6-monorepo'
const hasJB6Deps = Object.keys(rootPkg.dependencies || {}).some(dep => dep.startsWith('@jb6/'))
const hasLocalPackages = await fs.access(path.join(repoRoot, 'packages')).then(() => true, () => false)`,
        explain: 'Services detect repository type through package.json analysis and filesystem structure'
      })
    ]
  })
})

Doclet('packageContentTypes', {
  impl: principle('high', 'Package content is categorized by origin and purpose for proper discovery and resolution', {
    rationale: 'File discovery services must distinguish between jb6 framework content and local extensions to provide correct import maps and file listings.',
    guidance: [
      solution({
        code: `// Package Content Categories:

// JB6 PACKAGES - Framework Components
node_modules/@jb6/core/       ← Published framework packages
  index.js                    ← Component definitions
  tests/core-tests.js         ← Framework tests
  llm-guide/primer.js         ← Framework documentation

// LOCAL PACKAGE CONTENT - Custom Extensions  
main.js                       ← Custom component definitions
my-tests.js                   ← Custom component tests
docs/my-guide.js              ← Custom documentation`,
        points: [
          explanation('JB6 packages provide framework components and utilities'),
          explanation('Local content extends jb6 with domain-specific components'),
          syntax('node_modules/@jb6/*', 'framework packages location in extension repos'),
          syntax('/packages/*', 'framework packages location in jb6 monorepo'),
          whenToUse('Hybrid discovery for extension packages requiring both content types')
        ]
      }),
      bestPractice({
        suboptimalCode: 'treating all packages identically during file discovery',
        better: 'categorizing by origin (jb6 vs local) for proper resolution',
        reason: 'different content types require different serving strategies and import prefixes'
      })
    ]
  })
})

Doclet('fileCategorization', {
  impl: principle('high', 'Files are categorized by purpose across all package types for targeted discovery', {
    rationale: 'Services need to discover specific file types (source, test, guide) across both jb6 and local content for proper functionality.',
    guidance: [
      solution({
        code: `// File Categories Across Package Types:

// SOURCE FILES - Component Definitions
/packages/core/index.js           ← jb6 monorepo
node_modules/@jb6/core/index.js   ← extension/app packages  
main.js                           ← local extensions

// TEST FILES - Component Validation
/packages/core/tests/core-tests.js     ← jb6 tests
node_modules/@jb6/core/tests/*.js      ← published tests
my-tests.js                            ← local tests

// GUIDE FILES - Documentation  
/packages/core/llm-guide/primer.js     ← jb6 guides
node_modules/@jb6/*/llm-guide/*.js     ← published guides
docs/my-guide.js                       ← local guides`,
        points: [
          explanation('Source files define TGP components and DSL implementations'),
          explanation('Test files validate component behavior and integration'),
          explanation('Guide files provide component usage documentation'),
          syntax('*-tests.js or /tests/', 'test file discovery patterns'),
          syntax('*-llm-guide.js or /llm-guide/', 'guide file discovery patterns'),
          methodology('Services discover each category separately then merge results')
        ]
      })
    ]
  })
})

Doclet('environmentContexts', {
  impl: principle('critical', 'Execution environments determine file resolution and serving strategies', {
    rationale: 'Node.js and browser environments have fundamentally different module resolution and file access patterns that services must accommodate.',
    guidance: [
      solution({
        code: `// Environment-Specific Handling:

// NODE.JS EXECUTION
// - Direct filesystem access
// - Standard require.resolve() and ES modules  
// - No import maps needed
const resolved = require.resolve('@jb6/core')  // Works directly

// BROWSER EXECUTION  
// - HTTP requests to web server
// - ES Module import maps required
// - URL-based resolution
<script type="importmap">
{
  "imports": {
    "@jb6/core": "/@jb6/core/index.js"
  }
}
</script>`,
        points: [
          explanation('Node.js uses native module resolution without import maps'),
          explanation('Browser requires import maps for module resolution'),
          explanation('Web serving needs URL-to-filesystem mappings'),
          comparison('Node.js direct access', {
            advantage: 'simpler resolution, no server setup required'
          }),
          comparison('Browser HTTP serving', {
            advantage: 'enables web-based development tools and testing'
          })
        ]
      }),
      doNot('using same resolution strategy for both environments', {
        reason: 'Node.js and browser have incompatible module resolution mechanisms'
      })
    ]
  })
})

Doclet('hybridResolutionStrategy', {
  impl: principle('critical', 'Extension packages require hybrid resolution combining jb6 and local content discovery', {
    rationale: 'Extension packages are the most complex scenario, needing unified access to both framework packages and local extensions with different serving strategies.',
    guidance: [
      solution({
        code: `// Hybrid Resolution for Extension Packages:

// IMPORT MAP GENERATION
{
  "imports": {
    "@jb6/core": "/@jb6/core/index.js",     ← jb6 packages (from node_modules)
    "@jb6/core/": "/@jb6/core/",
    "my-extension": "/main.js"               ← local entry (from repo root)
  }
}

// STATIC SERVING MAPPINGS  
[
  {urlPath: "/@jb6", diskPath: "/repo/node_modules/@jb6"},  ← jb6 content
  {urlPath: "/", diskPath: "/repo"}                        ← local content  
]

// FILE DISCOVERY RESULTS
{
  sourceFiles: [
    "/repo/node_modules/@jb6/core/index.js",    ← jb6 sources
    "/repo/main.js"                             ← local sources
  ],
  testFiles: [
    "/repo/node_modules/@jb6/core/tests/*.js",  ← jb6 tests
    "/repo/my-tests.js"                         ← local tests
  ]
}`,
        points: [
          explanation('Extension packages serve jb6 content with /@jb6/ URL prefix'),
          explanation('Local content served from root / URL prefix'),
          explanation('Import maps unify access to both content types'),
          syntax('/@jb6/', 'URL prefix for framework packages in extension environments'),
          methodology('Services discover jb6 and local content separately then merge'),
          performance('Hybrid serving enables both framework and custom component access')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Service Implementation Pattern
async function getHybridContext(repoRoot) {
  // Discover jb6 packages from node_modules
  const jb6Content = await discoverNodeModulesJB6(repoRoot)
  
  // Discover local content from repo root
  const localContent = await discoverLocalFiles(repoRoot)
  
  // Merge with different URL prefixes
  return {
    importMap: {...jb6Content.imports, ...localContent.imports},
    staticMappings: [
      {urlPath: "/@jb6", diskPath: path.join(repoRoot, "node_modules/@jb6")},
      {urlPath: "/", diskPath: repoRoot}
    ]
  }
}`,
        explain: 'Extension services implement hybrid discovery by separately processing jb6 and local content then merging with appropriate URL prefixes'
      })
    ]
  })
})

Doclet('serviceSpecialization', {
  impl: principle('high', 'Three specialized services handle distinct client scenarios with optimized file discovery', {
    rationale: 'Different clients need different combinations of file discovery and resolution. Specialized services provide exactly what each client requires.',
    guidance: [
      solution({
        code: `// Three Core Services:

// 1. getStaticServeConfig(repoRoot) - HTTP Server Client
// Returns: {importMap, staticMappings}
// Purpose: Configure Express middleware for file serving

// 2. getExecutionContext(filePath) - Probe/Testing Clients  
// Returns: {importMap, testFiles, entryFiles, resolver}
// Purpose: Prepare environment for code execution

// 3. getFileContext(filePath) - TGP Model/Booklet Clients
// Returns: {importMap, sourceFiles, testFiles, llmGuideFiles, resolver}  
// Purpose: Comprehensive file discovery for analysis and processing`,
        points: [
          explanation('Static serve config optimized for web server setup'),
          explanation('Execution context optimized for runtime file loading'),
          explanation('File context optimized for comprehensive file discovery'),
          whenToUse('getStaticServeConfig for HTTP servers'),
          whenToUse('getExecutionContext for code execution (tests, probes)'),
          whenToUse('getFileContext for analysis tools (TGP model, documentation)'),
          methodology('Services share import map generation while specializing file discovery')
        ]
      }),
      bestPractice({
        suboptimalCode: 'single universal service returning all possible data',
        better: 'specialized services returning exactly what each client needs',
        reason: 'reduces over-fetching and provides clearer semantic intent'
      })
    ]
  })
})

Doclet('importMapUniversality', {
  impl: principle('critical', 'Import maps provide universal module resolution across all clients and environments', {
    rationale: 'Import maps are the web standard for module resolution. All clients need identical import map structure for consistent module resolution.',
    guidance: [
      solution({
        code: `// Universal Import Map Structure:
{
  "imports": {
    "@jb6/core": "/packages/core/index.js",      ← jb6 monorepo
    "@jb6/core": "/@jb6/core/index.js",         ← extension package
    "@jb6/core/": "/packages/core/",             ← subpath imports
    "@jb6/core/": "/@jb6/core/"
  }
}

// Used By All Clients:
// - HTTP Server: HTML injection for browser module resolution
// - TGP Model Builder: import crawling and resolution  
// - Probe/Testing: execution context module loading
// - Booklet Generator: content fetching with path resolution
// - Test Runner: module loading in both Node.js and browser`,
        points: [
          explanation('Import maps are web standard terminology across all contexts'),
          explanation('All clients use import maps for module resolution'),
          explanation('Structure identical across clients, only generation differs'),
          syntax('"@jb6/core": "/path/to/index.js"', 'standard ES module import map format'),
          evidence('No client-specific abstraction needed - import maps are universal'),
          methodology('Services generate appropriate import maps for each environment')
        ]
      }),
      doNot('creating client-specific abstractions over import maps', {
        reason: 'import maps are already the correct abstraction level for all clients'
      })
    ]
  })
})

Booklet('packageEcosystemTerminology', {
  impl: booklet('repositoryTypes,packageContentTypes,fileCategorization,environmentContexts,hybridResolutionStrategy,serviceSpecialization,importMapUniversality,threeServiceRequirements,clientServiceMapping,clientInputPatterns,clientPreferencesAndEntryPoints,preciseServiceInterfaces')
})



Doclet('threeServiceRequirements', {
  impl: principle('critical', 'Each service has specific requirements that differ between JB6 monorepo and extension environments', {
    rationale: 'Services must adapt their file discovery and serving strategies based on repository type while maintaining consistent return structures.',
    guidance: [
      solution({
        code: `// SERVICE 1: getStaticServeConfig(repoRoot)
// Purpose: Configure Express middleware for file serving

// JB6 MONOREPO ENVIRONMENT:
{
  importMap: {
    "@jb6/core": "/packages/core/index.js",
    "@jb6/core/": "/packages/core/"
  },
  staticMappings: [
    {urlPath: "/packages", diskPath: "/repo/packages"}
  ]
}

// EXTENSION ENVIRONMENT:  
{
  importMap: {
    "@jb6/core": "/@jb6/core/index.js", 
    "@jb6/core/": "/@jb6/core/",
    "my-extension": "/main.js"              // Local entry if exists
  },
  staticMappings: [
    {urlPath: "/@jb6", diskPath: "/repo/node_modules/@jb6"},
    {urlPath: "/", diskPath: "/repo"}
  ]
}`,
        points: [
          explanation('JB6 monorepo serves directly from /packages directory'),
          explanation('Extension environment serves jb6 from node_modules with /@jb6/ prefix'),
          explanation('Extension environment adds local file serving from repo root'),
          syntax('/packages', 'monorepo serving path for framework packages'),
          syntax('/@jb6/', 'extension serving prefix for framework packages'),
          methodology('Static mappings configure Express.static middleware')
        ]
      }),
      solution({
        code: `// SERVICE 2: getExecutionContext(filePath) 
// Purpose: Prepare environment for code execution (tests, probes)

// JB6 MONOREPO ENVIRONMENT:
{
  importMap: {"@jb6/core": "/packages/core/index.js"},
  testFiles: [
    "/repo/packages/core/tests/core-tests.js",
    "/repo/packages/common/common-tests.js"
  ],
  entryFiles: [
    "/repo/packages/core/index.js",
    "/repo/packages/common/index.js"  
  ],
  resolver: (specifier) => "/repo/packages/core/index.js"
}

// EXTENSION ENVIRONMENT:
{
  importMap: {"@jb6/core": "/@jb6/core/index.js"},
  testFiles: [
    "/repo/node_modules/@jb6/core/tests/core-tests.js",    // jb6 tests
    "/repo/my-tests.js",                                   // local tests
    "/repo/tests/integration-tests.js"                     // local test dir
  ],
  entryFiles: [
    "/repo/node_modules/@jb6/core/index.js",              // jb6 entries
    "/repo/main.js"                                        // local entry
  ],
  resolver: (specifier) => resolveHybrid(specifier)
}`,
        points: [
          explanation('JB6 monorepo finds test files in /packages/*/tests/ directories'),
          explanation('Extension environment finds jb6 tests in node_modules/@jb6/*/tests/'),
          explanation('Extension environment adds local test file discovery'),
          syntax('/packages/*/tests/', 'monorepo test file pattern'),
          syntax('node_modules/@jb6/*/tests/', 'extension jb6 test file pattern'),
          methodology('Execution context merges framework and local test files')
        ]
      }),
      solution({
        code: `// SERVICE 3: getFileContext(filePath)
// Purpose: Comprehensive file discovery for analysis and processing

// JB6 MONOREPO ENVIRONMENT:
{
  importMap: {"@jb6/core": "/packages/core/index.js"},
  sourceFiles: [
    "/repo/packages/core/index.js",
    "/repo/packages/core/jb-core.js", 
    "/repo/packages/common/index.js"
  ],
  testFiles: ["/repo/packages/core/tests/core-tests.js"],
  llmGuideFiles: ["/repo/packages/core/llm-guide/primer.js"],
  resolver: (specifier) => "/repo/packages/core/index.js"
}

// EXTENSION ENVIRONMENT:
{
  importMap: {"@jb6/core": "/@jb6/core/index.js"},
  sourceFiles: [
    "/repo/node_modules/@jb6/core/index.js",              // jb6 sources
    "/repo/node_modules/@jb6/common/index.js",
    "/repo/main.js",                                       // local sources
    "/repo/src/custom-dsl.js"
  ],
  testFiles: [
    "/repo/node_modules/@jb6/core/tests/core-tests.js",   // jb6 tests
    "/repo/my-tests.js"                                    // local tests
  ],
  llmGuideFiles: [
    "/repo/node_modules/@jb6/core/llm-guide/primer.js",   // jb6 guides  
    "/repo/docs/custom-guide.js"                          // local guides
  ],
  resolver: (specifier) => resolveHybrid(specifier)
}`,
        points: [
          explanation('JB6 monorepo finds source files in /packages/*/ directories'),
          explanation('Extension environment finds jb6 sources in node_modules/@jb6/*/'),
          explanation('Extension environment adds local source file discovery'),
          explanation('All file categories require hybrid discovery in extension environment'),
          syntax('/packages/*/', 'monorepo source file pattern'),
          syntax('node_modules/@jb6/*/', 'extension jb6 source file pattern'),
          methodology('File context provides comprehensive discovery for TGP model building')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Environment Detection and Adaptation
async function detectEnvironment(repoRoot) {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  const isJB6Monorepo = pkg.name === 'jb6-monorepo'
  const hasJB6Deps = Object.keys(pkg.dependencies || {}).some(dep => dep.startsWith('@jb6/'))
  
  if (isJB6Monorepo) return 'jb6-monorepo'
  if (hasJB6Deps) return 'extension'
  return 'app'
}

// Service Adaptation Pattern
async function getFileContext(filePath) {
  const repoRoot = await calcRepoRoot(filePath)
  const env = await detectEnvironment(repoRoot)
  
  switch (env) {
    case 'jb6-monorepo':
      return await discoverMonorepoFiles(repoRoot)
    case 'extension':
      return await discoverHybridFiles(repoRoot)
    case 'app':
      return await discoverNodeModulesOnly(repoRoot)
  }
}`,
        explain: 'Each service detects environment type and adapts discovery strategy while maintaining consistent return structure'
      })
    ]
  })
})



Doclet('clientServiceMapping', {
  impl: principle('critical', 'Five distinct clients use the three services based on their specific file system and execution needs', {
    rationale: 'Each client has distinct responsibilities requiring different combinations of file discovery, module resolution, and serving capabilities.',
    guidance: [
      solution({
        code: `// CLIENT-TO-SERVICE MAPPING:

// CLIENT 1: HTTP SERVER (serve-import-map.js)
// Uses: getStaticServeConfig(repoRoot)
// Purpose: Express middleware setup for serving static files + import map injection
// Needs: URL-to-disk mappings, import map for HTML placeholder replacement

const {imports, staticMappings} = await getStaticServeConfig(repoRoot)
for (const {urlPath, pkgDir} of staticMappings) {
  app.use(urlPath, express.static(pkgDir))
  // Replace JB_IMPORT_MAP in HTML files
}

// CLIENT 2: TGP MODEL BUILDER (tgp-model-data.js) 
// Uses: getFileContext(filePath)
// Purpose: Language service - build component model for intellisense/completion
// Needs: All source files, import resolution, AST parsing context

const {sourceFiles, testFiles, llmGuideFiles, resolver} = await getFileContext(filePath)
// Crawl files, parse AST, build TGP component model

// CLIENT 3: PROBE/TESTING EXECUTION (tgp-snippet.js, probe.js)
// Uses: getExecutionContext(filePath) 
// Purpose: Execute code snippets and probe component behavior
// Needs: Test files, execution imports, script generation context

const {importMap, testFiles, entryFiles} = await getExecutionContext(filePath)
// Generate execution script, run in Node.js or browser

// CLIENT 4: BOOKLET GENERATOR (bookletsContent Data component)
// Uses: getFileContext(filePath)
// Purpose: Compile documentation from LLM guide files
// Needs: LLM guide file discovery, content fetching with path resolution

const {llmGuideFiles, resolver} = await getFileContext(repoRoot)
// Find booklet/doclet components, fetch and concatenate content

// CLIENT 5: TEST RUNNER (run-tests-cli.js, tests.html)
// Uses: getExecutionContext(filePath)
// Purpose: Discover and run test files in both Node.js and browser
// Needs: Test file discovery, module loading, execution environment setup

const {importMap, testFiles} = await getExecutionContext(filePath)
// Load test modules, execute in chosen environment`,
        points: [
          explanation('HTTP Server configures Express routes and static file serving'),
          explanation('TGP Model Builder creates intellisense data for language services'),
          explanation('Probe/Testing executes code snippets for debugging and validation'),
          explanation('Booklet Generator compiles documentation from scattered guide files'),
          explanation('Test Runner discovers and executes tests across environments'),
          methodology('Two clients share getExecutionContext for different execution purposes'),
          methodology('Two clients share getFileContext for different analysis purposes')
        ]
      }),
      solution({
        code: `// CLIENT ENVIRONMENT REQUIREMENTS:

// HTTP SERVER - Node.js Only
// - Runs Express web server 
// - Serves files to browsers
// Environment: Node.js (servers don't run in browsers)

// TGP MODEL BUILDER - Node.js + Browser  
// - VSCode extension (Node.js process)
// - Web-based language service (browser)
// Environment: Both (language services run in multiple contexts)

// PROBE/TESTING - Node.js + Browser
// - CLI probe execution (Node.js)
// - Browser probe UI (probe.html)  
// Environment: Both (testing needs both execution contexts)

// BOOKLET GENERATOR - Node.js + Browser
// - CLI documentation generation (Node.js)
// - Web-based doc compilation (browser MCP tools)
// Environment: Both (documentation tools run everywhere)

// TEST RUNNER - Node.js + Browser
// - CLI test execution (run-tests-cli.js)
// - Browser test UI (tests.html)
// Environment: Both (tests must run in target environments)`,
        points: [
          explanation('HTTP Server only runs in Node.js as web servers'),
          explanation('Four clients need both Node.js and browser execution support'),
          explanation('Browser execution requires import maps for module resolution'),
          explanation('Node.js execution uses standard module resolution'),
          whenToUse('Browser execution for interactive development tools'),
          whenToUse('Node.js execution for CLI tools and automation')
        ]
      }),
      solution({
        code: `// CLIENT COMPLEXITY AND SERVICE GROUPING:

// SIMPLE CLIENTS (Single Service):
// - HTTP Server: Only needs getStaticServeConfig()
//   Purpose: Web server setup, no complex file analysis

// EXECUTION CLIENTS (Shared Service):
// - Probe/Testing: getExecutionContext()  
// - Test Runner: getExecutionContext()
//   Purpose: Code execution with test file inclusion

// ANALYSIS CLIENTS (Shared Service):  
// - TGP Model Builder: getFileContext()
// - Booklet Generator: getFileContext()
//   Purpose: Comprehensive file discovery for processing

// Service Consolidation Rationale:
// - Execution clients both need test files + runtime context
// - Analysis clients both need comprehensive file discovery
// - HTTP Server has unique static serving requirements`,
        points: [
          explanation('HTTP Server stands alone with unique serving requirements'),
          explanation('Execution clients share needs for test files and runtime setup'),
          explanation('Analysis clients share needs for comprehensive file discovery'),
          methodology('Service grouping reduces API surface while meeting client needs'),
          performance('Shared services eliminate duplicate file discovery logic')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Client Usage Patterns in Code:

// HTTP Server Pattern:
export async function serveImportMap(app, {express}) {
  const {imports, serveEntries} = await getStaticServeConfig()
  for (const {urlPath, pkgDir} of serveEntries) {
    app.use(urlPath, express.static(pkgDir))
  }
}

// TGP Model Builder Pattern:  
export async function calcTgpModelData(filePaths, forDsls) {
  const {sourceFiles, testFiles, resolver} = await getFileContext(filePaths[0])
  // Parse files, build component model
}

// Probe Execution Pattern:
async function runSnippetCli({compText, filePath, setupCode}) {
  const {importMap, testFiles} = await getExecutionContext(filePath)
  // Generate and execute script
}`,
        explain: 'Each client uses its service to get exactly the file discovery and resolution data needed for its specific responsibilities'
      })
    ]
  })
})



Doclet('clientInputPatterns', {
  impl: principle('high', 'Clients specify their working scope using three different input patterns: DSL lists, entry points, or both', {
    rationale: 'Different clients have different ways to define what they want to work with. Services must handle these input variations while providing appropriate file discovery.',
    guidance: [
      solution({
        code: `// CLIENT INPUT PATTERN 1: DSL SPECIFICATION
// Clients: TGP Model Builder (sometimes)
// Pattern: Specify comma-separated DSL names to work with specific DSLs

export async function calcTgpModelData(filePaths, forDsls) {
  const filePath = Array.isArray(filePaths) ? filePaths[0] : filePaths
  const filePathToUse = filePath || await filePathsForDsls(forDsls)  // <-- DSL-based discovery
  // ...
}

// filePathsForDsls Implementation:
async function filePathsForDsls(_dsls) {
  const dsls = Array.isArray(_dsls) ? _dsls : (_dsls||'').split(',').map(x=>x.trim()).filter(Boolean)
  const files = [...listRepo.files, ...jb6NodeModulesList.files].map(x=>x.path)
  return dsls.flatMap(dsl=> files.filter(f=>f.endsWith(\`\${dsl}/index.js\`))).map(localPath=>path.join(repoRoot,localPath))
}

// Usage Examples:
// calcTgpModelData(null, 'common,testing')     ← Find common and testing DSL entry points
// calcTgpModelData(null, 'rx,llm-api')        ← Find rx and llm-api DSL entry points`,
        points: [
          explanation('DSL specification finds entry points by DSL name patterns'),
          explanation('Searches for files matching {dsl}/index.js pattern'),
          explanation('Works across both monorepo (/packages/) and extension (node_modules/@jb6/) environments'),
          syntax('forDsls: "common,testing"', 'comma-separated DSL names'),
          methodology('filePathsForDsls converts DSL names to actual file paths'),
          whenToUse('When client wants to work with specific DSLs regardless of project structure')
        ]
      }),
      solution({
        code: `// CLIENT INPUT PATTERN 2: ENTRY POINT SPECIFICATION  
// Clients: Most clients most of the time
// Pattern: Specify exact file paths to start discovery from

// HTTP Server:
const serverConfig = await getStaticServeConfig(repoRoot)  // <-- Repository root

// Probe/Testing:
const executionContext = await getExecutionContext(filePath)  // <-- Specific file path

// Booklet Generator (from bookletsContent):
const { llmGuideFiles, projectImportMap } = await projectInfo(repoRoot)  // <-- Repository root

// Usage Examples:
// getExecutionContext('/repo/packages/core/tests/core-tests.js')
// getFileContext('/repo/hosts/test-project/main.js')  
// projectInfo('/repo/packages/common/index.js')`,
        points: [
          explanation('Entry point specification starts from known file or directory'),
          explanation('Services discover related files from the entry point context'),
          explanation('Most common pattern across all clients'),
          syntax('filePath: "/path/to/entry.js"', 'specific file entry point'),
          syntax('repoRoot: "/path/to/repo"', 'repository root entry point'),
          whenToUse('When client knows exactly what file/project they want to work with')
        ]
      }),
      solution({
        code: `// CLIENT INPUT PATTERN 3: HYBRID SPECIFICATION
// Clients: TGP Model Builder (flexible usage)  
// Pattern: Accept both file paths AND DSL specifications with fallback logic

export async function calcTgpModelData(filePaths, forDsls) {
  const filePath = Array.isArray(filePaths) ? filePaths[0] : filePaths
  const filePathToUse = filePath || await filePathsForDsls(forDsls)  // <-- Fallback pattern
  
  const rootFilePaths = unique([
    importModule,
    filePathToUse,
    ...(Array.isArray(filePaths) ? filePaths : []),  // <-- Additional file paths
    ...testFiles
  ].filter(Boolean))
  // ...
}

// Usage Patterns:
// calcTgpModelData(['/specific/file.js'])                    ← File paths only
// calcTgpModelData(null, 'common,testing')                  ← DSL names only  
// calcTgpModelData(['/main.js'], 'rx,common')               ← Both (file paths + DSL discovery)
// calcTgpModelData(['/a.js', '/b.js', '/c.js'])             ← Multiple file paths`,
        points: [
          explanation('Hybrid pattern provides maximum flexibility for different use cases'),
          explanation('Supports arrays of file paths for multiple entry points'),
          explanation('Falls back to DSL discovery when no file paths provided'),
          explanation('Combines specified files with discovered DSL entry points'),
          methodology('Services handle parameter validation and fallback logic'),
          whenToUse('When client needs flexibility to specify scope in different ways')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Service Input Handling Pattern
async function getFileContext(input, options = {}) {
  let entryPoints = []
  
  // Handle different input types
  if (typeof input === 'string') {
    // Single file path or repo root
    entryPoints = [input]
  } else if (Array.isArray(input)) {
    // Multiple file paths
    entryPoints = input
  } else if (options.forDsls) {
    // DSL-based discovery
    entryPoints = await filePathsForDsls(options.forDsls)
  }
  
  // Convert repo roots to appropriate entry files
  entryPoints = await Promise.all(entryPoints.map(async (path) => {
    const stats = await fs.stat(path)
    if (stats.isDirectory()) {
      // Find index.js or main entry in directory
      return await findMainEntry(path)
    }
    return path
  }))
  
  // Proceed with file discovery from entry points
  return await discoverFromEntryPoints(entryPoints)
}`,
        explain: 'Services normalize different input patterns into consistent entry point arrays for unified file discovery processing'
      })
    ]
  })
})



Doclet('clientPreferencesAndEntryPoints', {
  impl: principle('critical', 'Clients have distinct preferences for scope specification based on their use case context and working knowledge', {
    rationale: 'Different client contexts naturally lead to different ways of specifying scope. Understanding these preferences helps design appropriate service APIs.',
    guidance: [
      solution({
        code: `// CLIENT PREFERENCE PATTERNS BY CONTEXT:

// EDITOR/IDE CLIENTS - File-Centric Context
// Preference: Start from current working file
// Reason: User is editing specific file, wants context for that file

// VSCode Extension (TGP Model Builder):
const tgpModel = await calcTgpModelData([currentFile])  // <-- Working file entry point
// Language service builds model from current file context

// VSCode Probe/Debugging:
const probeResult = await runProbe(probePath, currentFile)  // <-- Current file context
// Debugging starts from where user is working

// LEARNING/DISCOVERY CLIENTS - DSL-Centric Context  
// Preference: Specify DSLs to explore
// Reason: Want to learn about specific DSL capabilities

// MCP Services for LLM:
const dslModel = await getFileContext(null, {forDsls: 'common,rx'})  // <-- DSL exploration
// LLM wants to understand specific DSL components

// Booklet Generation:
const docContext = await getFileContext(repoRoot, {forDsls: 'llm-guide'})  // <-- Documentation DSL
// Generate docs about specific DSL documentation

// SERVER/RUNTIME CLIENTS - Repository-Centric Context
// Preference: Repository root or specific entry points  
// Reason: Need to serve or execute entire project context

// HTTP Server:
const serverConfig = await getStaticServeConfig(repoRoot)  // <-- Whole repo context
// Serve entire project structure`,
        points: [
          explanation('Editor clients start from user\'s current working file'),
          explanation('Learning clients start from DSL names they want to explore'),
          explanation('Server clients start from repository or project root'),
          methodology('Client context determines most natural entry point specification'),
          whenToUse('File entry points for editor/IDE workflows'),
          whenToUse('DSL entry points for learning and documentation workflows'),
          whenToUse('Repository entry points for server and runtime workflows')
        ]
      }),
      solution({
        code: `// MULTIPLE ENTRY POINTS IN HYBRID EXTENSION CONTEXT:

// SCENARIO: Extension package with multiple custom DSLs
/my-extension-monorepo/
  packages/
    my-dsl/index.js           ← Custom DSL package
    my-app/main.js            ← Application using custom DSL
  node_modules/@jb6/         ← JB6 framework dependencies

// MULTIPLE ENTRY POINT DISCOVERY:
// TGP Model Builder in extension monorepo:
const tgpModel = await calcTgpModelData([
  '/repo/packages/my-dsl/index.js',     ← Custom DSL entry
  '/repo/packages/my-app/main.js',      ← App entry using DSL
  '/repo/tests/integration.js'          ← Test entry
])

// Result: Comprehensive model including:
// - JB6 framework components (from node_modules/@jb6/*)
// - Custom DSL components (from /packages/my-dsl/)  
// - Application components (from /packages/my-app/)
// - Test components (from /tests/)

// HYBRID DISCOVERY PROCESS:
// 1. Start from multiple specified entry points
// 2. Crawl imports from each entry point
// 3. Discover JB6 dependencies via node_modules
// 4. Discover local packages via monorepo structure
// 5. Merge all discovered components into unified model`,
        points: [
          explanation('Extension monorepos can have multiple local packages plus JB6 dependencies'),
          explanation('Multiple entry points enable comprehensive discovery across all packages'),
          explanation('Each entry point provides different component perspectives'),
          explanation('Import crawling from multiple entries discovers more complete dependency graph'),
          methodology('Services crawl from each entry point then merge discovery results'),
          performance('Multiple entry points reduce risk of missing isolated component trees')
        ]
      }),
      solution({
        code: `// ENTRY POINT STRATEGY BY CLIENT TYPE:

// EDITOR WORKFLOW - Single File Focus
// User editing: /repo/packages/my-app/components.js  
const context = await getFileContext('/repo/packages/my-app/components.js')
// Discovers: my-app components + imported JB6 + imported custom DSL

// MCP/LEARNING WORKFLOW - DSL Focus
// LLM wants to learn about custom DSL:
const context = await getFileContext(null, {forDsls: 'my-dsl'})  
// Discovers: /repo/packages/my-dsl/index.js + dependencies

// TESTING WORKFLOW - Multiple Entry Points
// Running tests across entire extension:
const context = await getExecutionContext([
  '/repo/packages/my-dsl/tests/dsl-tests.js',
  '/repo/packages/my-app/tests/app-tests.js',  
  '/repo/tests/integration-tests.js'
])
// Discovers: All test files + all dependencies from multiple starting points

// DOCUMENTATION WORKFLOW - Comprehensive Discovery
// Generating docs for entire extension:
const context = await getFileContext([
  '/repo/packages/my-dsl/index.js',      ← DSL entry
  '/repo/packages/my-app/index.js',      ← App entry
  '/repo'                                ← Repo root for additional discovery
])
// Discovers: All packages + all guides + all dependencies`,
        points: [
          explanation('Single entry point works for focused editor workflows'),
          explanation('DSL specification works for learning and exploration workflows'),
          explanation('Multiple entry points work for comprehensive testing and documentation'),
          explanation('Repository root entry point captures additional loose files'),
          methodology('Different workflows benefit from different entry point strategies'),
          whenToUse('Multiple entry points when working across package boundaries')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Service Implementation for Multiple Entry Points
async function getFileContext(input, options = {}) {
  let entryPoints = []
  
  // Normalize input to entry point array
  if (Array.isArray(input)) {
    entryPoints = input  // Multiple explicit entry points
  } else if (input) {
    entryPoints = [input]  // Single entry point
  } else if (options.forDsls) {
    entryPoints = await filePathsForDsls(options.forDsls)  // DSL-based discovery
  }
  
  // Parallel discovery from each entry point
  const discoveries = await Promise.all(entryPoints.map(async (entryPoint) => {
    return await crawlFromEntryPoint(entryPoint)
  }))
  
  // Merge discovery results
  const mergedContext = {
    sourceFiles: unique(discoveries.flatMap(d => d.sourceFiles)),
    testFiles: unique(discoveries.flatMap(d => d.testFiles)), 
    llmGuideFiles: unique(discoveries.flatMap(d => d.llmGuideFiles)),
    importMap: Object.assign({}, ...discoveries.map(d => d.importMap))
  }
  
  return mergedContext
}

// Multiple entry points enable comprehensive discovery:
// - Reduces risk of missing isolated component trees
// - Captures different perspectives on the same codebase  
// - Enables cross-package dependency discovery in monorepos`,
        explain: 'Multiple entry points are processed in parallel then merged, ensuring comprehensive discovery across complex package structures'
      })
    ]
  })
})



Doclet('preciseServiceInterfaces', {
  impl: principle('critical', 'The three services must have precisely defined interfaces with clear input parameters, return structures, and error handling', {
    rationale: 'Implementation requires exact function signatures, parameter validation, return type definitions, and error handling specifications.',
    guidance: [
      solution({
        code: `// SERVICE 1: getStaticServeConfig
// Purpose: Configure Express middleware for static file serving
// Used by: HTTP Server client

interface StaticServeConfig {
  async getStaticServeConfig(
    repoRoot: string,
    options?: {
      includeHidden?: boolean
    }
  ): Promise<{
    importMap: {
      imports: Record<string, string>  // {"@jb6/core": "/packages/core/index.js"}
    },
    staticMappings: Array<{
      urlPath: string,     // "/packages" or "/@jb6"
      diskPath: string,    // "/repo/packages" or "/repo/node_modules/@jb6"
      pkgId?: string       // "@jb6/core" (optional package identifier)
    }>,
    environment: 'jb6-monorepo' | 'extension' | 'app'
  }>
}

// Input validation:
// - repoRoot must be valid directory path
// - repoRoot must contain package.json
// Error handling:
// - Throws if repoRoot doesn't exist
// - Throws if package.json malformed
// - Returns empty mappings if no packages found`,
        points: [
          explanation('Single repoRoot parameter - simplest service interface'),
          explanation('Returns import map + static mappings for Express configuration'),
          explanation('Environment detection included in return for client debugging'),
          syntax('importMap.imports', 'standard ES Module import map format'),
          syntax('staticMappings[]', 'array of URL-to-disk path mappings'),
          methodology('Validates input directory and package.json before processing')
        ]
      }),
      solution({
        code: `// SERVICE 2: getExecutionContext
// Purpose: Prepare environment for code execution (tests, probes)
// Used by: Probe/Testing client, Test Runner client

interface ExecutionContext {
  async getExecutionContext(
    input: string | string[],  // file path(s) or repo root
    options?: {
      forDsls?: string,        // "common,testing" for DSL-based discovery
      includeTestFiles?: boolean,  // default: true
      includeHidden?: boolean      // default: false
    }
  ): Promise<{
    importMap: {
      imports: Record<string, string>
    },
    testFiles: string[],       // Absolute paths to test files
    entryFiles: string[],      // Absolute paths to main entry files
    sourceFiles: string[],     // Absolute paths to source files (for reference)
    resolver: (specifier: string) => string | undefined,  // Module resolution function
    environment: 'jb6-monorepo' | 'extension' | 'app'
  }>
}

// Input validation:
// - If string: must be valid file path or directory
// - If array: each element must be valid file path
// - options.forDsls: comma-separated DSL names if provided
// Fallback logic:
// - If input is directory, finds main entry files
// - If no input and forDsls provided, uses DSL discovery
// Error handling:
// - Throws if no valid entry points found
// - Warns if DSL names in forDsls not found
// - Returns empty arrays if no files of specific type found`,
        points: [
          explanation('Flexible input: single file, file array, or DSL specification'),
          explanation('Returns execution context with test files and entry points'),
          explanation('Includes resolver function for runtime module resolution'),
          explanation('Source files included for reference but not primary purpose'),
          methodology('Input validation with fallback to DSL discovery'),
          methodology('Resolver function enables runtime import resolution')
        ]
      }),
      solution({
        code: `// SERVICE 3: getFileContext
// Purpose: Comprehensive file discovery for analysis and processing
// Used by: TGP Model Builder client, Booklet Generator client

interface FileContext {
  async getFileContext(
    input: string | string[],  // file path(s) or repo root
    options?: {
      forDsls?: string,           // "common,testing" for DSL-based discovery
      includeTestFiles?: boolean, // default: true
      includeLlmGuides?: boolean, // default: true
      includeHidden?: boolean,    // default: false
      maxDepth?: number           // crawling depth limit, default: 10
    }
  ): Promise<{
    importMap: {
      imports: Record<string, string>
    },
    sourceFiles: string[],        // Absolute paths to source files
    testFiles: string[],          // Absolute paths to test files  
    llmGuideFiles: string[],      // Absolute paths to documentation files
    entryFiles: string[],         // Absolute paths to main entry files
    resolver: (specifier: string) => string | undefined,  // Module resolution function
    contentFetcher: (filePath: string, lineStart?: number, lineEnd?: number) => Promise<string>,
    environment: 'jb6-monorepo' | 'extension' | 'app'
  }>
}

// Input validation:
// - Same as getExecutionContext
// Additional features:
// - contentFetcher function for reading file sections (used by booklet generator)
// - maxDepth prevents infinite crawling in complex import graphs
// - Comprehensive file categorization across all types
// Error handling:
// - Same as getExecutionContext
// - contentFetcher handles file read errors gracefully`,
        points: [
          explanation('Most comprehensive service - all file types included'),
          explanation('ContentFetcher function enables reading file sections by line numbers'),
          explanation('MaxDepth option prevents infinite crawling in complex projects'),
          explanation('Primary service for analysis and documentation generation'),
          methodology('Comprehensive file categorization for all client analysis needs'),
          performance('Depth limiting prevents performance issues in complex import graphs')
        ]
      }),
      solution({
        code: `// SHARED PATTERNS ACROSS ALL SERVICES:

// Common Input Pattern:
type ServiceInput = string | string[]
type ServiceOptions = {
  forDsls?: string,           // DSL-based discovery fallback
  includeTestFiles?: boolean,
  includeLlmGuides?: boolean, 
  includeHidden?: boolean,
  maxDepth?: number           // getFileContext only
}

// Common Return Pattern:
interface BaseServiceReturn {
  importMap: { imports: Record<string, string> },
  environment: 'jb6-monorepo' | 'extension' | 'app'
}

// Error Types:
class ServiceError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_INPUT' | 'NOT_FOUND' | 'PARSE_ERROR' | 'CRAWL_ERROR',
    public details?: any
  ) {}
}

// Common Validation:
function validateInput(input: ServiceInput, options: ServiceOptions): void {
  // Validates file paths exist
  // Validates DSL names format
  // Validates options ranges
}`,
        points: [
          explanation('Consistent input/output patterns across all three services'),
          explanation('Structured error handling with specific error codes'),
          explanation('Common validation logic reduces implementation duplication'),
          syntax('ServiceInput', 'unified input type for all services'),
          syntax('BaseServiceReturn', 'shared return structure elements'),
          methodology('Error codes enable specific error handling in clients')
        ]
      })
    ]
  })
})
