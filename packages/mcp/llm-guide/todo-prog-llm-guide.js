import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { howTo, principle },
    guidance: { solution, doNot, bestPractice, mechanismUnderTheHood }, 
    explanationPoint: { explanation, syntax, whenToUse, evidence, methodology, performance, comparison },
    problemStatement: { problem }
  } 
} = dsls

Doclet('todoProgOverview', {
  impl: howTo(
    problem('Systematic programming task management with persistent storage and AI integration'),
    solution({
      code: `// TodoProg provides 9 MCP tools for programming task management
// Built with common DSL components following TGP patterns

// === CORE OPERATIONS ===
jb6_mcp:todoRead({repoRoot: "/path/to/project"})
jb6_mcp:todoWrite({repoRoot: "/path/to/project", todos: [...]})
jb6_mcp:todoAdd({repoRoot: "/path/to/project", content: "Fix bug", priority: "high"})

// === LIFECYCLE MANAGEMENT ===
jb6_mcp:todoComplete({repoRoot: "/path/to/project", todoId: "todo_123"})
jb6_mcp:todoUpdate({repoRoot: "/path/to/project", todoId: "todo_123", updates: {...}})
jb6_mcp:todoDelete({repoRoot: "/path/to/project", todoId: "todo_123"})

// === ANALYSIS ===
jb6_mcp:todoStats({repoRoot: "/path/to/project"})
jb6_mcp:todoFilter({repoRoot: "/path/to/project", status: "pending", priority: "high"})
jb6_mcp:todoClear({repoRoot: "/path/to/project"})`,
      points: [
        explanation('9 MCP tools built using common DSL components for maximum reusability'),
        syntax('repoRoot', 'absolute path to project - todos stored in .jb6/todos.json'),
        syntax('TodoWrite pattern', 'replaces entire list following Claude Code behavior'),
        evidence('Based on research showing effective task management requires systematic approaches'),
        performance('Project-scoped storage prevents todo mixing between projects'),
        whenToUse('For systematic programming task management with AI integration')
      ]
    }),
    mechanismUnderTheHood({
      snippet: `// Implementation uses common DSL pipeline pattern:
Tool('todoRead', {
  impl: typeAdapter('data<common>', pipeline(
    '%$repoRoot%',
    loadTodos('%$repoRoot%'),  // Data component
    (ctx, {}, todos) => ({ success: true, todos, count: todos.length }),
    mcpSuccess('%%')           // Data component
  ))
})

// Data components handle core logic:
Data('loadTodos', {
  impl: pipeline('%$repoRoot%', todoFilePath('%%'), readJsonFile('%%'))
})`,
      explain: 'Tools use typeAdapter + pipeline with reusable Data components rather than monolithic implementations'
    })
  )
})

Doclet('todoProgDataModel', {
  impl: principle({
    importance: 'critical',
    rule: 'TodoProg uses validated data schema with automatic normalization and project isolation',
    rationale: 'Consistent data format enables reliable AI integration and prevents data corruption',
    guidance: [
      solution({
        code: `// Todo data schema with validation:
{
  id: "todo_1641234567890_abc123def",     // Auto-generated unique ID
  content: "Implement user authentication", // Required task description
  status: "pending",                       // validated: pending | in_progress | completed
  priority: "high",                        // validated: high | medium | low  
  created_at: "2024-01-03T10:30:00Z",     // ISO timestamp
  updated_at: "2024-01-03T11:45:00Z",     // ISO timestamp
  metadata: {                             // Optional custom attributes
    estimatedTime: "2 hours",
    tags: ["backend", "security"],
    issueId: "#123",
    relatedFiles: ["auth.js", "auth-tests.js"],
    assignee: "backend-team"
  }
}

// Storage location: {projectRoot}/.jb6/todos.json
// Validation handled by Data('validateTodo') component`,
        points: [
          syntax('id generation', 'Format: todo_{timestamp}_{random} ensures uniqueness'),
          syntax('status validation', 'Invalid values normalized to "pending"'),
          syntax('priority validation', 'Invalid values normalized to "medium"'),
          syntax('metadata flexibility', 'Open object for custom programming context'),
          explanation('Project isolation prevents global todo mixing'),
          evidence('Schema based on Claude Code TodoWrite research and programming workflow analysis')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Validation implemented with common DSL:
Data('validateTodo', {
  impl: pipeline(
    '%$todo%',
    async (ctx, {}, todo) => {
      const id = todo.id || await generateTodoId()
      const status = await validateTodoStatus({status: todo.status})
      const priority = await validateTodoPriority({priority: todo.priority})
      return { id, content: todo.content || '(Empty todo)', status, priority, ... }
    }
  )
})

Data('validateTodoStatus', {
  impl: pipeline('%$status%', Switch([
    {case: 'pending', value: 'pending'},
    {case: 'in_progress', value: 'in_progress'}, 
    {case: 'completed', value: 'completed'}
  ], 'pending'))
})`,
        explain: 'Switch component from common DSL handles validation with fallbacks'
      })
    ]
  })
})

Doclet('todoWritePatternGuide', {
  impl: howTo(
    problem('Using TodoWrite for AI task planning following Claude Code patterns'),
    solution({
      code: `// AI Planning: Break complex features into actionable tasks
jb6_mcp:todoWrite({
  repoRoot: "/home/shaiby/projects/jb6",
  todos: [
    {
      content: "Research OAuth 2.0 implementation options",
      status: "pending", 
      priority: "high",
      metadata: {estimatedTime: "2 hours", tags: ["research", "auth"]}
    },
    {
      content: "Design authentication flow and user stories", 
      status: "pending",
      priority: "high",
      metadata: {dependencies: ["research"], estimatedTime: "3 hours"}
    },
    {
      content: "Implement OAuth 2.0 backend integration",
      status: "pending", 
      priority: "high",
      metadata: {dependencies: ["design"], estimatedTime: "6 hours"}
    },
    {
      content: "Create login/signup UI components",
      status: "pending",
      priority: "medium", 
      metadata: {dependencies: ["backend"], estimatedTime: "4 hours"}
    },
    {
      content: "Write comprehensive authentication tests",
      status: "pending",
      priority: "medium",
      metadata: {dependencies: ["ui"], estimatedTime: "3 hours"}
    }
  ]
})`,
      points: [
        explanation('TodoWrite replaces entire list - ideal for AI planning sessions'),
        syntax('dependencies in metadata', 'track task relationships for proper sequencing'),
        syntax('estimatedTime metadata', 'enables project timeline planning'),
        syntax('tags metadata', 'categorize tasks for filtering and organization'),
        whenToUse('When AI breaks down complex features into implementable tasks'),
        evidence('Research shows effective task management requires clear prioritization and sequencing')
      ]
    }),
    doNot('Using todoWrite for single task additions', {
      reason: 'todoWrite replaces entire list - use todoAdd for individual additions to preserve existing todos'
    }),
    mechanismUnderTheHood({
      snippet: `// TodoWrite implementation:
Tool('todoWrite', {
  impl: async (ctx, args) => {
    const todos = args.todos.profile  // Extract from dynamic param
    if (!Array.isArray(todos)) return mcpError('Todos must be an array')
    
    // Validate each todo using common DSL
    const normalized = []
    for (const todo of todos) {
      normalized.push(await validateTodo({todo}))
    }
    
    const result = await saveTodos({repoRoot, todos: normalized})
    return result.success ? mcpSuccess(result) : mcpError(result.error)
  }
})`,
      explain: 'Dynamic parameter handling + common DSL validation + reusable response components'
    })
  )
})

Doclet('developmentWorkflowIntegration', {
  impl: howTo(
    problem('Integrating TodoProg with jb6 development workflow tools'),
    solution({
      code: `// PATTERN 1: Analysis → Planning → Implementation
// 1. Analyze existing code
jb6_mcp:getFilesContent({
  filesPaths: "packages/ui/button.js,packages/ui/button-tests.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 2. Create todos based on analysis
jb6_mcp:todoAdd({
  repoRoot: "/home/shaiby/projects/jb6",
  content: "Add missing hover state tests for button component",
  priority: "medium",
  metadata: {
    type: "testing",
    relatedFiles: ["packages/ui/button.js", "packages/ui/button-tests.js"],
    discoveredBy: "code-analysis"
  }
})

// 3. Test component behavior before implementation
jb6_mcp:runSnippet({
  compText: "button('Test', log('clicked'))",
  filePath: "packages/ui/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})

// 4. If issues found, update todo with findings
jb6_mcp:todoUpdate({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_button_test_id",
  updates: {
    status: "in_progress",
    metadata: {
      testResult: "button click not logging properly",
      priority: "high" // escalate due to functionality issue
    }
  }
})

// 5. After fixing implementation
jb6_mcp:replaceFileSection({
  filePath: "packages/ui/button.js",
  // ... make the actual fix
})

// 6. Mark todo complete
jb6_mcp:todoComplete({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_button_test_id"
})`,
      points: [
        explanation('Complete workflow: analyze → plan → test → implement → verify → complete'),
        syntax('relatedFiles in metadata', 'link todos to specific files for context'),
        syntax('discoveredBy in metadata', 'track how issues were identified'),
        syntax('testResult in metadata', 'document testing outcomes'),
        methodology('Integration prevents forgotten work and tracks progress systematically'),
        performance('Structured workflow reduces context switching and improves focus')
      ]
    }),
    solution({
      code: `// PATTERN 2: Daily Development Review
// Morning: Check high priority pending work
jb6_mcp:todoFilter({
  repoRoot: "/home/shaiby/projects/jb6",
  priority: "high",
  status: "pending"
})

// Throughout day: Update progress
jb6_mcp:todoUpdate({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "current_task_id",
  updates: {
    status: "in_progress",
    metadata: {progress: 50, blockers: ["waiting for API documentation"]}
  }
})

// End of day: Review completion and plan tomorrow
jb6_mcp:todoStats({repoRoot: "/home/shaiby/projects/jb6"})
// Review: completed vs pending ratio for velocity tracking`,
      points: [
        explanation('Daily patterns provide rhythm and progress visibility'),
        syntax('progress in metadata', 'track completion percentage'),
        syntax('blockers in metadata', 'document impediments for resolution'),
        whenToUse('For systematic daily development workflow management'),
        evidence('Research shows regular review cycles improve task completion rates')
      ]
    }),
    bestPractice({
      suboptimalCode: 'keeping todos in your head or scattered across different tools',
      better: 'systematic project-scoped storage with rich metadata and workflow integration',
      reason: 'persistent context enables better collaboration and reduces mental overhead'
    })
  )
})

Doclet('todoProgCommonDslPatterns', {
  impl: principle({
    importance: 'high',
    rule: 'TodoProg tools leverage common DSL components for maximum reusability and TGP consistency',
    rationale: 'Using common DSL ensures tools follow TGP patterns and can be composed with other components',
    guidance: [
      solution({
        code: `// Data components handle core business logic:
Data('loadTodos', {
  impl: pipeline(
    '%$repoRoot%',
    todoFilePath('%%'),          // Generate .jb6/todos.json path
    readJsonFile('%%'),          // Read and parse JSON
    (ctx, {}, todos) => todos || [] // Handle missing file
  )
})

Data('filterTodos', {
  impl: pipeline(
    '%$todos%',
    filter(conditionalFilter('status', '%$status%')),
    filter(conditionalFilter('priority', '%$priority%')),
    filter(searchFilter('%$search%'))
  )
})

// Tools compose Data components:
Tool('todoFilter', {
  impl: typeAdapter('data<common>', pipeline(
    obj(property('repoRoot', '%$repoRoot%'), property('filters', getFilters())),
    loadTodos('%repoRoot%'),
    filterTodos('%todos%', '%status%', '%priority%', '%search%'),
    formatResponse('%%'),
    mcpSuccess('%%')
  ))
})`,
        points: [
          explanation('Data components encapsulate business logic separate from MCP concerns'),
          syntax('pipeline pattern', 'chains operations using common DSL components'),
          syntax('typeAdapter', 'converts MCP tool to data<common> for pipeline use'),
          performance('Reusable Data components can be tested independently'),
          comparison('monolithic tool implementations', { advantage: 'modular components enable composition and testing' })
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Common DSL components used:
- pipeline: chains operations
- obj/property: builds structured data  
- filter: array filtering with conditions
- Switch: validation with fallbacks
- mcpSuccess/mcpError: standardized responses
- typeAdapter: converts between types

// Benefits:
- Testable: Data components can be tested with runSnippet
- Reusable: Components work in other contexts
- Consistent: Follows TGP patterns throughout
- Maintainable: Logic changes in one place`,
        explain: 'Common DSL provides building blocks that compose into complex functionality'
      }),
      bestPractice({
        suboptimalCode: 'implementing todo logic directly in Tool implementations',
        better: 'creating reusable Data components that Tools orchestrate',
        reason: 'separation enables testing, reuse, and follows TGP compositional patterns'
      })
    ]
  })
})

Doclet('todoProgErrorHandlingPatterns', {
  impl: howTo(
    problem('Robust error handling and validation in TodoProg tools'),
    solution({
      code: `// Standardized error handling using common DSL:
Data('mcpSuccess', {
  impl: pipeline(
    '%$data%',
    (ctx, {}, data) => ({
      content: [{ type: 'text', text: JSON.stringify(data) }],
      isError: false
    })
  )
})

Data('mcpError', {
  impl: pipeline(
    '%$error%', 
    (ctx, {}, error) => ({
      content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
      isError: true
    })
  )
})

// Usage in tools:
Tool('todoAdd', {
  impl: typeAdapter('data<common>', pipeline(
    validateInput('%%'),
    loadTodos('%$repoRoot%'),
    validateTodo('%$newTodo%'),
    saveTodos('%$repoRoot%', '%updatedTodos%'),
    Switch([
      {case: 'success', value: mcpSuccess('%result%')},
      {case: 'error', value: mcpError('%error%')}
    ])
  ))
})`,
      points: [
        explanation('Standardized mcpSuccess/mcpError components ensure consistent responses'),
        syntax('Switch for error handling', 'common DSL pattern for conditional responses'),
        syntax('validation pipeline', 'early validation prevents downstream errors'),
        performance('Consistent error format enables reliable error handling by clients'),
        methodology('Error handling integrated into pipeline rather than try/catch blocks')
      ]
    }),
    solution({
      code: `// Validation patterns:
Data('validateTodoInput', {
  impl: pipeline(
    '%$input%',
    (ctx, {}, input) => {
      if (!input.repoRoot) return { error: 'repoRoot is required' }
      if (!input.content) return { error: 'content is required' }
      return { valid: true, input }
    }
  )
})

// File operation error handling:
Data('safeFileOperation', {
  impl: pipeline(
    '%$operation%',
    async (ctx, {}, operation) => {
      try {
        const result = await operation()
        return { success: true, result }
      } catch (error) {
        return { success: false, error: error.message }
      }
    }
  )
})`,
      points: [
        explanation('Input validation prevents invalid operations downstream'),
        syntax('safe file operations', 'wrap file I/O in error handling components'),
        whenToUse('For all user input and file system operations'),
        evidence('Defensive programming reduces debugging time and improves reliability')
      ]
    }),
    doNot('Using try/catch blocks in tool implementations', {
      reason: 'breaks pipeline flow - use common DSL error handling patterns instead'
    })
  )
})

Doclet('todoProgTestingGuide', {
  impl: howTo(
    problem('Testing TodoProg components using runSnippet and common DSL patterns'),
    solution({
      code: `// Test Data components independently:
jb6_mcp:runSnippet({
  compText: "validateTodo({todo: {content: 'Test task', priority: 'invalid'}})",
  filePath: "packages/mcp/todo-prog-tools.js",
  repoRoot: "/home/shaiby/projects/jb6"
})
// Expect: priority normalized to 'medium'

// Test pipeline components:
jb6_mcp:runSnippet({
  compText: "pipeline([{status: 'pending'}, {status: 'completed'}], filterTodos('%%', 'pending'))",
  setupCode: "import '@jb6/mcp/todo-prog-tools.js'",
  filePath: "packages/mcp/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})
// Expect: only pending todos returned

// Test with probe to see data flow:
jb6_mcp:runSnippet({
  compText: "pipeline(mockTodos, filterTodos('%%', 'high'), __)",
  setupCode: "Const('mockTodos', [{priority: 'high'}, {priority: 'low'}])",
  filePath: "packages/mcp/test.js",
  repoRoot: "/home/shaiby/projects/jb6"
})`,
      points: [
        explanation('Test Data components separately from MCP Tool wrappers'),
        syntax('runSnippet for validation', 'test business logic without file I/O'),
        syntax('probe mode', 'debug data flow through pipelines'),
        methodology('Test validation, filtering, and transformation logic independently'),
        performance('Component testing faster than full integration testing')
      ]
    }),
    solution({
      code: `// Test validation edge cases:
jb6_mcp:runSnippets({
  compTexts: [
    "validateTodo({todo: {}})",                    // Empty todo
    "validateTodo({todo: {content: '', status: 'invalid'}})", // Invalid status
    "validateTodo({todo: {content: 'Test', priority: 'URGENT'}})", // Invalid priority
    "validateTodoStatus({status: 'completed'})",    // Valid status
    "validateTodoPriority({priority: 'unknown'})"   // Invalid priority
  ],
  filePath: "packages/mcp/todo-prog-tools.js",
  repoRoot: "/home/shaiby/projects/jb6"
})`,
      points: [
        explanation('Batch testing of edge cases using runSnippets'),
        syntax('validation testing', 'verify normalization behavior'),
        whenToUse('For comprehensive validation testing across multiple scenarios'),
        evidence('Edge case testing prevents data corruption and unexpected behavior')
      ]
    }),
    bestPractice({
      suboptimalCode: 'testing only happy path scenarios',
      better: 'comprehensive edge case testing with validation and error scenarios',
      reason: 'edge cases often reveal design flaws and prevent production issues'
    })
  )
})

Doclet('todoProgPerformanceOptimization', {
  impl: principle({
    importance: 'medium',
    rule: 'TodoProg optimizes for typical programming project scale while maintaining simplicity',
    rationale: 'Programming projects typically have 10-100 active todos - optimize for this scale rather than enterprise levels',
    guidance: [
      solution({
        code: `// File-based storage optimized for programming projects:
// - Single JSON file per project (simple, reliable)
// - In-memory operations (fast for <1000 todos)  
// - Lazy loading (only load when needed)
// - Atomic writes (prevent corruption)

Data('loadTodos', {
  impl: pipeline(
    '%$repoRoot%',
    todoFilePath('%%'),
    cachedFileRead('%%'),        // Cache in memory during session
    parseJsonSafe('%%'),         // Safe parsing with fallbacks
    (ctx, {}, todos) => todos || []
  )
})

Data('saveTodos', {
  impl: pipeline(
    obj(property('path', todoFilePath('%$repoRoot%')), property('data', '%$todos%')),
    atomicJsonWrite('%%'),       // Write to temp file first, then rename
    invalidateCache('%path%')    // Clear cache after write
  )
})`,
        points: [
          explanation('File-based storage simple and reliable for programming project scale'),
          syntax('cached reads', 'avoid repeated file I/O during session'),
          syntax('atomic writes', 'prevent corruption during save operations'),
          performance('In-memory operations fast for typical todo counts (10-100 items)'),
          comparison('database storage', { advantage: 'simpler deployment, no external dependencies' })
        ]
      }),
      solution({
        code: `// Filtering optimization for common queries:
Data('todoQuickFilters', {
  impl: pipeline(
    '%$todos%',
    (ctx, {}, todos) => ({
      pending: todos.filter(t => t.status === 'pending'),
      high_priority: todos.filter(t => t.priority === 'high'),
      in_progress: todos.filter(t => t.status === 'in_progress'),
      recent: todos.filter(t => isWithinDays(t.created_at, 7))
    })
  )
})

// Pre-computed statistics for dashboard views:
Data('todoStatsFast', {
  impl: pipeline(
    '%$todos%',
    todoQuickFilters('%%'),
    (ctx, {}, filters) => ({
      total: ctx.vars.todos.length,
      pending: filters.pending.length,
      high_priority: filters.high_priority.length,
      completion_rate: filters.completed.length / ctx.vars.todos.length
    })
  )
})`,
        points: [
          explanation('Pre-computed filters for common queries avoid repeated filtering'),
          syntax('quick filters', 'single pass through todos for multiple filter results'),
          performance('O(n) single pass better than O(n×m) multiple filter operations'),
          whenToUse('For dashboard and statistics views that need multiple metrics')
        ]
      }),
      mechanismUnderTheHood({
        snippet: `// Performance characteristics:
// File I/O: ~1-5ms for typical todo files (<50KB)
// JSON parsing: ~1ms for 100 todos
// Validation: ~0.1ms per todo  
// Filtering: ~1ms for 100 todos
// Statistics: ~2ms for 100 todos

// Bottlenecks to avoid:
// - Repeated file reads (use caching)
// - Multiple filter passes (batch operations)
// - Large metadata objects (>1KB per todo)
// - Frequent saves during batch operations`,
        explain: 'Optimized for programming workflow patterns rather than enterprise scale'
      }),
      doNot('Premature optimization for thousands of todos', {
        reason: 'programming projects rarely exceed 100 active todos - optimize for common case'
      })
    ]
  })
})