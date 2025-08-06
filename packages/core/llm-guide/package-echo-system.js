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


Doclet('repositoryTypes', {
  impl: principle('critical', 'JB6 ecosystem supports both JB6 MonoRepo and local packages using it and 3rd parties jb6 extensions. local repos can be also mono repos', {
    rationale: 'Understanding repository types is essential for file discovery, import resolution, and service configuration.',
    guidance: [
      solution({
        code: `// Repository Types:

// 1. JB6 MONOREPO - Framework Development
/jb6-monorepo/
  packages/
    core/index.js           ← Source files
    common/index.js
    testing/index.js

// 2. LOCAL PACKAGE for simple extension - Uses jb6 and can Extends JB6 with Custom Components,  
/ui/
  node_modules/@jb6/       ← Published jb6 dependencies
    core/index.js
    common/index.js
  package.json
  index.js
  ui.js                  ← ui dsl components
  ui-testers.js          ← ui testers components (using the testing dsl)
  ui-tests.js
  ui-llm-guide.js

// 3. LOCAL PACKAGE mono repo - Uses jb6 and other jb6 extension, can Extends JB6 with dsls and Custom Components and app,  
/app1/
  node_modules/@jb6/
    core/index.js
    common/index.js
    3rdPartyDsl/
        package.json ← contains jb6 dependency
  package.json
  packages/
    app1/ - optional app
        main.js
    ui/
        index.js
        ui.js                  
        ui-testers.js          
        ui-tests.js
        ui-llm-guide.js
    report/
        index.js
        report.js             ← reporting dsl components    
        report-testers.js         
        report-tests.js
        report-llm-guide.js
`,
        points: [
          explanation('JB6 Monorepo contains source packages for framework development'),
          explanation('Local Package adds custom TGP components while depending on published jb6, and maybe on other extension packages'),
          explanation('Detect that a package is using jb6 by looking at its package.json for @jb6 dependecy'),
          whenToUse('JB6 Monorepo for framework development and contribution'),
          whenToUse('Local Package as extension for building custom DSLs and components'),
          whenToUse('Local Package as app using jb6 and maybe some extension packages used by the app')
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

Doclet('hybridResolutionStrategy', {
  impl: principle({
    importance: 'critical',
    rule: 'Extension packages require hybrid resolution combining jb6, 3rd party, and local content discovery',
    rationale: 'unified access to both framework packages, 3rd party and local repos with different serving strategies.',
    guidance: [
      solution({
        code: `// Hybrid Resolution for Extension Packages:

// IMPORT MAP GENERATION
{
  "imports": {
    "@jb6/core": "/@jb6/core/index.js",     ← jb6 packages (from node_modules)
    "@jb6/core/": "/@jb6/core/",
    "@jb6/common": "/@jb6/common/index.js",     ← common dsl from @jb6 repo in node_modules
    "@jb6/common/": "/@jb6/common/",

    "3rdPartyDsl": "3rdPartyDsl/index.js",     ← 3rdPartyDsl with @jb6 dependency (from node_modules)
    "3rdPartyDsl/": "3rdPartyDsl/",

    "ui": "/app1/ui/index.js",     ← ui dsl from local repo (named app1)
    "ui/": "/app1/ui/",

    "app1/": "/app1/", - other jb6 dependent packages in local repo
    "app1": "/app1/index.js",     ← will appear only if index.js exists
  }
}

// STATIC SERVING MAPPINGS  
[
  {urlPath: "/@jb6", diskPath: "/home/user1/projects/app1/node_modules/@jb6"},  ← jb6 content
  {urlPath: "/3rdPartyDsl", diskPath: "/home/user1/projects/app1/node_modules/3rdPartyDsl"},  ← 3rdPartyDsl with @jb6 dependency
  {urlPath: "/app1", diskPath: "/home/user1/projects/app1"}                        ← local content  
]

// FILE DISCOVERY RESULTS
// todo - add examples from 3rdparty and local
{
  llmGuideFiles: [
    "/home/user1/projects/app1/node_modules/@jb6/core/llm-guide/extending-dsls.js",
    ...
  ],
  testFiles: [
    "/home/user1/projects/app1/node_modules/@jb6/packages/core/tests/core-tests.js",
    ..
  ]
}`
      })
    ]
  })
})

Doclet('jb6Package', {
  impl: principle({
    importance: 'high',
    rule: 'Package strucutre is important for proper discovery and resolution. package structure is the same in jb6 monorepo and local packages',
    guidance: [
      solution({
        code: `
myDsl/       ← Published package - usually suggests a new dsl. e.g: ui, common, report
  package.json 
  index.js      ← DSL Component definitions entry point for basic dsl usage import 'myDsl'
  misc/         ← more dsl services entry points not covered by index.js, e.g. core/misc/pretty-print.js
  tests/[tests.js,testers.js]         ← dsl tests folder
  llm-guide/primer.js         ← llm-guide folder
  myDsl-testers.js ← In place testers,tests, and llm-guides (alternative to tests/ and llm-guide for tiny dsls)
  myDsl-A-tests.js
  myDsl-B-tests.js
  myDsl-llm-guide.js

package.json :
{
    "name": "@jb6/myDsl", or just "myDsl" if 3rd party repo
    "type": "module",
    "exports": {
      ".": "./index.js",
      "./misc/*.js": "./misc/*.js"
    },
    "dependencies": {
      "@jb6/core": "1.250803.1"
    },
    ...
  }`
      })
    ]
  })
})

