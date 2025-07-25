import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'

const { 
  tgp: { Const }, 
  'llm-guide': { Doclet,
    doclet: { principle },
    guidance: { solution }, 
    explanationPoint: { explanation, syntax, whenToUse }
  } 
} = dsls

Doclet('mcpToolsQuickReference', {
  impl: principle({
    importance: 'critical',
    rule: 'TGP MCP Tools Quick Reference - Essential commands for jb6 development',
    rationale: 'Quick access to the most commonly used MCP tools for efficient development workflows',
    guidance: [
      solution({
        code: `// === EXPLORATION TOOLS ===

// Get comprehensive DSL documentation
jb6_mcp:dslDocs({
  dsl: "common",  // or "ui", "testing", etc.
  repoRoot: "/home/shaiby/projects/jb6"
})

// Get TGP model for file context
jb6_mcp:tgpModel({
  repoRoot: "/home/shaiby/projects/jb6",
  filePath: "packages/common/components.js"  // optional - gets repo model if omitted
})

// Read file contents  
jb6_mcp:getFilesContent({
  filesPaths: "packages/common/jb-common.js,packages/ui/ui-core.js",  // comma-separated
  repoRoot: "/home/shaiby/projects/jb6"
})

// === TESTING TOOLS ===

// Test single component snippet
jb6_mcp:runSnippet({
  compText: "pipeline('%$data%', filter('%active%'), count())",
  setupCode: "Const('data', [{active: true}, {active: false}])",
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// Debug with probe markers
jb6_mcp:runSnippet({
  compText: "pipeline('%$data%', filter('%active%'), __)",  // __ shows data at this point
  setupCode: "Const('data', [{active: true}])",
  filePath: "packages/common/test.js", 
  repoRoot: "/home/shaiby/projects/jb6"
})

// Test multiple variations in parallel
jb6_mcp:runSnippets({
  compTexts: [
    "filter('%active% == true')",
    "filter('%active% == false')", 
    "filter('%status% == \"ready\"')"
  ],
  setupCode: "Const('data', [{active: true, status: 'ready'}])",
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// === MODIFICATION TOOLS ===

// Replace specific component
jb6_mcp:replaceComponent({
  filePath: "packages/common/my-components.js",
  repoRoot: "/home/shaiby/projects/jb6",
  oldCompText: "filter('%age% > 30')",
  newCompText: "filter('%age% < 30')"
})

// Add new component to file
jb6_mcp:addComponent({
  filePath: "packages/common/my-components.js",
  repoRoot: "/home/shaiby/projects/jb6", 
  newCompText: "Data('newHelper', { impl: '%$input%' })"
})

// Replace entire file content
jb6_mcp:overrideFileContent({
  filePath: "packages/common/new-module.js",
  repoRoot: "/home/shaiby/projects/jb6",
  newContent: "import { dsls } from '@jb6/core'\\n\\n// New module content"
})

// === UTILITY TOOLS ===

// Execute raw JavaScript
jb6_mcp:evalJs({
  code: "import { readFileSync } from 'fs'; process.stdout.write('Hello World')"
})`,
        points: [
          explanation('Essential MCP tools organized by function: exploration, testing, and modification'),
          syntax('jb6_mcp:toolName', 'All TGP MCP tools use this prefix pattern'),
          syntax('repoRoot', 'Always absolute path to repository root'),
          syntax('filePath', 'Always relative path from repoRoot'), 
          syntax('compText', 'TGP component expression to execute'),
          syntax('setupCode', 'Context setup like Const() definitions'),
          syntax('__', 'Probe marker shows intermediate data at that point'),
          whenToUse('Use exploration tools first, then testing, then modification for safe development')
        ]
      })
    ]
  })
})

Doclet('commonWorkflowPatterns', {
  impl: principle({
    importance: 'high',
    rule: 'Common workflow patterns using MCP tools for typical development tasks',
    rationale: 'Standardized patterns help achieve common development goals efficiently and safely',
    guidance: [
      solution({
        code: `// === PATTERN 1: Understanding New DSL ===
// 1. Get DSL overview
jb6_mcp:dslDocs({ dsl: "ui", repoRoot: "/home/shaiby/projects/jb6" })

// 2. See what's available in context  
jb6_mcp:tgpModel({ 
  repoRoot: "/home/shaiby/projects/jb6",
  filePath: "packages/ui/my-component.js" 
})

// 3. Read examples from existing code
jb6_mcp:getFilesContent({
  filesPaths: "packages/ui/ui-core.js,packages/ui/examples.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// === PATTERN 2: Testing New Component Logic ===
// 1. Test basic functionality
jb6_mcp:runSnippet({
  compText: "myNewComponent('%$testData%')",
  setupCode: "Const('testData', {id: 1, name: 'test'})",
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 2. Debug step by step with probes
jb6_mcp:runSnippet({
  compText: "pipeline('%$testData%', transform(), __)",
  setupCode: "Const('testData', [1, 2, 3])",
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 3. Test edge cases in parallel
jb6_mcp:runSnippets({
  compTexts: [
    "myComponent([])",           // empty array
    "myComponent([1])",         // single item  
    "myComponent([1,2,3,4,5])", // multiple items
    "myComponent(null)"         // null input
  ],
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// === PATTERN 3: Safe Component Refactoring ===
// 1. Understand current implementation
jb6_mcp:getFilesContent({
  filesPaths: "packages/common/target-component.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 2. Test new implementation
jb6_mcp:runSnippet({
  compText: "newImprovedComponent('%$sampleData%')",
  setupCode: "Const('sampleData', {test: 'data'})",
  filePath: "packages/common/target-component.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 3. Replace old with new
jb6_mcp:replaceComponent({
  filePath: "packages/common/target-component.js",
  repoRoot: "/home/shaiby/projects/jb6",
  oldCompText: "Data('oldComponent', { impl: '...' })",
  newCompText: "Data('newImprovedComponent', { impl: '...' })"
})

// 4. Verify integration works
jb6_mcp:runSnippet({
  compText: "testIntegrationWorkflow('%$realData%')",
  filePath: "packages/common/target-component.js", 
  repoRoot: "/home/shaiby/projects/jb6"
})

// === PATTERN 4: Creating New Module ===
// 1. Check what already exists
jb6_mcp:dslDocs({ dsl: "common", repoRoot: "/home/shaiby/projects/jb6" })

// 2. Create and test components
jb6_mcp:runSnippets({
  compTexts: [
    "helper1('%$data%')",
    "helper2('%$data%')", 
    "mainComponent(helper1('%$data%'), helper2('%$data%'))"
  ],
  setupCode: "Const('data', {sample: 'test'})",
  filePath: "packages/common/new-module.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 3. Create the actual file
jb6_mcp:overrideFileContent({
  filePath: "packages/common/new-module.js",
  repoRoot: "/home/shaiby/projects/jb6",
  newContent: "import { dsls } from '@jb6/core'\\n\\n// Complete module with tested components"
})`,
        points: [
          explanation('Four common patterns cover most development scenarios in jb6'),
          syntax('Pattern structure', 'Each pattern follows explore → test → implement → verify cycle'),
          whenToUse('Choose pattern based on your goal: learning, testing, refactoring, or creating'),
          explanation('Always test components before implementation to catch errors early'),
          explanation('Use parallel testing for comprehensive validation of edge cases')
        ]
      })
    ]
  })
})

Doclet('troubleshootingGuide', {
  impl: principle({
    importance: 'important',
    rule: 'Common MCP tool issues and their solutions',
    rationale: 'Quick problem resolution keeps development flow smooth and productive',
    guidance: [
      solution({
        code: `// === COMMON ISSUES & SOLUTIONS ===

// ❌ "File not found" errors
// Problem: Incorrect path format
// Solution: Check path patterns
jb6_mcp:getFilesContent({
  filesPaths: "packages/common/file.js",  // ✅ Relative to repoRoot
  repoRoot: "/home/shaiby/projects/jb6"   // ✅ Absolute path
})
// NOT: filesPaths: "/full/absolute/path"  // ❌
// NOT: repoRoot: "relative/path"          // ❌

// ❌ "Component not found" in runSnippet
// Problem: Missing imports or wrong file context
// Solution: Check file context and setup
jb6_mcp:runSnippet({
  compText: "pipeline('%$data%', count())",     // This component needs imports
  filePath: "packages/common/context-file.js", // ✅ File with proper imports
  setupCode: "import '@jb6/common'",          // ✅ Ensure imports available
  repoRoot: "/home/shaiby/projects/jb6"
})

// ❌ "Old component text not found" in replaceComponent
// Problem: Text doesn't match exactly
// Solution: Get exact text first
jb6_mcp:getFilesContent({
  filesPaths: "packages/common/target.js",
  repoRoot: "/home/shaiby/projects/jb6"
})
// Then copy exact text for oldCompText parameter

// ❌ Setup data not available in component
// Problem: Variable not defined in setupCode
// Solution: Proper Const definition
jb6_mcp:runSnippet({
  compText: "count('%$myData%')",
  setupCode: "Const('myData', [1, 2, 3])",  // ✅ Define variable first
  filePath: "packages/common/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// === DEBUGGING WORKFLOW ===

// Step 1: Check if data is available
jb6_mcp:runSnippet({
  compText: "%$myVariable%",  // Just the variable
  setupCode: "Const('myVariable', 'test')",
  filePath: "packages/common/debug.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// Step 2: Test each operation separately  
jb6_mcp:runSnippet({
  compText: "filter('%active% == true')",  // Just the filter
  setupCode: "const testItem = {active: true}",
  filePath: "packages/common/debug.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// Step 3: Combine with probe markers
jb6_mcp:runSnippet({
  compText: "pipeline('%$data%', filter('%active%'), __)",
  setupCode: "Const('data', [{active: true}, {active: false}])",
  filePath: "packages/common/debug.js", 
  repoRoot: "/home/shaiby/projects/jb6"
})

// Step 4: Test full pipeline
jb6_mcp:runSnippet({
  compText: "pipeline('%$data%', filter('%active%'), count())",
  setupCode: "Const('data', [{active: true}, {active: false}])",
  filePath: "packages/common/debug.js",
  repoRoot: "/home/shaiby/projects/jb6"
})`,
        points: [
          explanation('Most issues stem from incorrect paths, missing context, or exact text matching'),
          syntax('Debugging strategy', 'Isolate each piece: data → operations → combinations'),
          whenToUse('Use this guide when MCP tools produce unexpected errors or results'),
          explanation('Always verify paths and setup before blaming the component logic'),
          explanation('Copy exact text from getFilesContent for replaceComponent operations')
        ]
      })
    ]
  })
})
