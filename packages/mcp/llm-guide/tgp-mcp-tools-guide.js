import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'

const { 
  tgp: { Const }, 
  'llm-guide': { Doclet,
    doclet: { principle },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { explanation, syntax, whenToUse }
  } 
} = dsls

Doclet('mcpToolsOverview', {
  impl: principle('critical', 'Use the right MCP tool for each development task: explore → test → implement', {
    rationale: 'TGP MCP tools enable systematic development workflows that prevent bugs and ensure quality',
    guidance: [
      solution({
        code: `// CORE MCP TOOLS:
// Exploration
jb6_mcp:dslDocs({dsl: "common", repoRoot: "/path/to/repo"})        // Get component docs
jb6_mcp:getFilesContent({filesPaths: "file1.js,file2.js", repoRoot: "/path/to/repo"})

// Testing  
jb6_mcp:runSnippet({compText: "count('%$data%')", filePath: "test.js", repoRoot: "/path/to/repo"})

// Implementation
jb6_mcp:appendToFile({content: "new content", filePath: "file.js", repoRoot: "/path/to/repo"})
jb6_mcp:replaceComponent({oldCompText: "old", newCompText: "new", filePath: "file.js", repoRoot: "/path/to/repo"})
jb6_mcp:overrideFileContent({newContent: "entire file", filePath: "file.js", repoRoot: "/path/to/repo"})`,
        points: [
          explanation('Always explore existing components before implementing new ones'),
          explanation('Test component behavior with runSnippet before making changes'),
          syntax('repoRoot', 'absolute path to repository root'),
          syntax('filePath', 'relative path from repoRoot'),
          whenToUse('this workflow for any development task from debugging to new features')
        ]
      })
    ]
  })
})

Doclet('toolSelection', {
  impl: principle({
    importance: 'critical',
    rule: 'Choose modification tools based on change scope: appendToFile for additions, replaceComponent for changes, overrideFileContent for rewrites',
    rationale: 'Wrong tool choice leads to data loss or unnecessarily risky operations',
    guidance: [
      solution({
        code: `// TOOL SELECTION GUIDE:

// ✅ Adding new components safely
jb6_mcp:appendToFile({
  content: "Data('newComponent', {impl: 'new functionality'})",
  filePath: "packages/common/my-file.js"
})

// ✅ Modifying existing components precisely  
jb6_mcp:replaceComponent({
  oldCompText: "filter('%status% == \\"old\\"')",
  newCompText: "filter('%status% == \\"new\\"')",
  filePath: "packages/common/my-file.js"
})

// ✅ Complete file rewrites for new/small files
jb6_mcp:overrideFileContent({
  newContent: "import { dsls } from '@jb6/core'\\n\\n// new file content",
  filePath: "packages/common/new-file.js"
})`,
        points: [
          explanation('appendToFile preserves all existing content while adding new'),
          explanation('replaceComponent makes surgical changes to specific components'),
          explanation('overrideFileContent replaces entire file - use carefully'),
          whenToUse('choose based on whether you need to add, change, or rewrite')
        ]
      }),
      doNot({
        badCode: `// ❌ Using overrideFileContent for small changes
jb6_mcp:overrideFileContent({newContent: "...entire large file just to change one line..."})`,
        reason: 'risky and overwrites concurrent changes unnecessarily'
      }),
      doNot({
        badCode: `// ❌ Wrong path formats  
jb6_mcp:getFilesContent({
  filesPaths: "/absolute/path/file.js",  // ❌ should be relative
  repoRoot: "relative/path"              // ❌ should be absolute  
})`,
        reason: 'incorrect paths cause file not found errors'
      })
    ]
  })
})

Doclet('testingAndDebugging', {
  impl: principle({
    importance: 'critical',
    rule: 'Use runSnippet with probes to test and debug component behavior before implementation',
    rationale: 'Testing prevents bugs and validates understanding of component behavior',
    guidance: [
      solution({
        code: `// TESTING WORKFLOW:

// Step 1: Test component behavior
jb6_mcp:runSnippet({
  compText: "pipeline('%$people%', filter('%age% < 30'), count())",
  setupCode: "Const('people', [{name: 'John', age: 25}, {name: 'Jane', age: 35}])",
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// Step 2: Debug with probes if needed
jb6_mcp:runSnippet({
  compText: "pipeline('%$people%', filter('%age% < 30'), __)",  // __ shows data here
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"  
})

// Step 3: Implement after testing confirms behavior
jb6_mcp:replaceComponent({...})`,
        points: [
          explanation('Always test component logic before implementing changes'),
          syntax('__', 'probe marker shows intermediate data in pipelines'),
          syntax('setupCode', 'provides test data and context variables'),
          whenToUse('before any component changes or when debugging unexpected behavior')
        ]
      }),
      bestPractice({
        suboptimalCode: 'making changes without testing first',
        better: 'testing component behavior with runSnippet before implementation',
        reason: 'prevents bugs and builds confidence in changes'
      })
    ]
  })
})
