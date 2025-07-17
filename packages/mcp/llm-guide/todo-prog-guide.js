import { dsls } from '@jb6/core'
import '@jb6/common'
import '@jb6/llm-guide'

const { 
  'llm-guide': { Doclet,
    doclet: { principle },
    guidance: { solution, doNot, bestPractice }, 
    explanationPoint: { explanation, syntax, whenToUse, evidence, methodology }
  } 
} = dsls

Doclet('todoProgQuickReference', {
  impl: principle({
    importance: 'critical',
    rule: 'TodoProg MCP Tools - Programming task management following Claude Code TodoWrite patterns',
    rationale: 'Systematic task management for programming projects with persistent storage and AI integration',
    guidance: [
      solution({
        code: `// === CORE TODO OPERATIONS ===

// Read current todos
jb6_mcp:todoRead({
  repoRoot: "/home/shaiby/projects/jb6"
})

// Replace entire todo list (Claude Code TodoWrite pattern)
jb6_mcp:todoWrite({
  repoRoot: "/home/shaiby/projects/jb6",
  todos: [
    {
      content: "Implement user authentication",
      status: "in_progress", 
      priority: "high",
      metadata: {estimatedTime: "2 hours", tags: ["backend", "security"]}
    },
    {
      content: "Write unit tests for auth module",
      status: "pending",
      priority: "medium"
    },
    {
      content: "Update documentation",
      status: "pending", 
      priority: "low"
    }
  ]
})

// Add single todo (convenience method)
jb6_mcp:todoAdd({
  repoRoot: "/home/shaiby/projects/jb6",
  content: "Fix bug in user profile display",
  priority: "high",
  status: "pending",
  metadata: {issueId: "#123", estimatedTime: "1 hour"}
})

// === TASK LIFECYCLE MANAGEMENT ===

// Mark todo as completed
jb6_mcp:todoComplete({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_1641234567890_abc123def"
})

// Update specific todo fields
jb6_mcp:todoUpdate({
  repoRoot: "/home/shaiby/projects/jb6", 
  todoId: "todo_1641234567890_abc123def",
  updates: {
    status: "in_progress",
    metadata: {progress: 50, assignee: "backend-team"}
  }
})

// Delete specific todo
jb6_mcp:todoDelete({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_1641234567890_abc123def"
})

// Clear all todos
jb6_mcp:todoClear({
  repoRoot: "/home/shaiby/projects/jb6"
})

// === ANALYSIS AND FILTERING ===

// Get todo statistics
jb6_mcp:todoStats({
  repoRoot: "/home/shaiby/projects/jb6"
})
// Returns: {total: 5, pending: 2, in_progress: 1, completed: 2, high_priority: 3, ...}

// Filter todos by criteria  
jb6_mcp:todoFilter({
  repoRoot: "/home/shaiby/projects/jb6",
  status: "pending",           // Optional: filter by status
  priority: "high",            // Optional: filter by priority  
  search: "authentication"     // Optional: search in content
})`,
        points: [
          explanation('TodoWrite follows Claude Code pattern: replaces entire list rather than appending'),
          syntax('repoRoot', 'Always absolute path to repository root - todos stored in .jb6/todos.json'),
          syntax('status', 'pending | in_progress | completed'),
          syntax('priority', 'high | medium | low'),
          syntax('metadata', 'Custom object for additional task attributes'),
          whenToUse('Use todoWrite for AI planning, todoAdd for individual tasks, todoUpdate for progress tracking'),
          evidence('Based on research showing users employ ~9 task management tools - integrates with existing workflows')
        ]
      }),
      solution({
        code: `// === COMMON WORKFLOW PATTERNS ===

// PATTERN 1: AI Task Planning (Claude Code style)
// AI breaks down complex feature into actionable tasks
jb6_mcp:todoWrite({
  repoRoot: "/home/shaiby/projects/jb6",
  todos: [
    {content: "Research OAuth 2.0 implementation options", status: "pending", priority: "high"},
    {content: "Design authentication flow and user stories", status: "pending", priority: "high"}, 
    {content: "Implement OAuth 2.0 backend integration", status: "pending", priority: "high"},
    {content: "Create login/signup UI components", status: "pending", priority: "medium"},
    {content: "Write comprehensive auth tests", status: "pending", priority: "medium"},
    {content: "Update deployment scripts for auth secrets", status: "pending", priority: "low"}
  ]
})

// PATTERN 2: Progressive Task Execution
// Start first task
jb6_mcp:todoUpdate({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_oauth_research_id", 
  updates: {status: "in_progress"}
})

// Complete first task, start next
jb6_mcp:todoComplete({repoRoot: "/home/shaiby/projects/jb6", todoId: "todo_oauth_research_id"})
jb6_mcp:todoUpdate({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_auth_design_id",
  updates: {status: "in_progress"}
})

// PATTERN 3: Daily Standup / Progress Review
// Get high priority pending tasks
jb6_mcp:todoFilter({
  repoRoot: "/home/shaiby/projects/jb6",
  priority: "high",
  status: "pending"
})

// Get current work in progress
jb6_mcp:todoFilter({
  repoRoot: "/home/shaiby/projects/jb6", 
  status: "in_progress"
})

// Get overall project statistics
jb6_mcp:todoStats({
  repoRoot: "/home/shaiby/projects/jb6"
})

// PATTERN 4: Bug Triage and Management
// Add urgent bug fix
jb6_mcp:todoAdd({
  repoRoot: "/home/shaiby/projects/jb6",
  content: "URGENT: Fix login crash on mobile Safari",
  priority: "high",
  status: "pending",
  metadata: {
    type: "bug",
    severity: "critical", 
    issueId: "#456",
    affectedUsers: "mobile Safari users",
    reportedBy: "user-support"
  }
})

// Search for security-related tasks
jb6_mcp:todoFilter({
  repoRoot: "/home/shaiby/projects/jb6",
  search: "security"
})`,
        points: [
          explanation('Patterns support both AI-driven planning and manual task management'),
          methodology('Progressive execution: plan → start → track → complete → review'),
          syntax('metadata usage', 'Rich context for project management integration'),
          whenToUse('Pattern 1 for feature planning, Pattern 2 for execution, Pattern 3 for daily reviews, Pattern 4 for issue management'),
          evidence('Research shows effective task completion depends on clear prioritization and progress visibility')
        ]
      }),
      solution({
        code: `// === INTEGRATION WITH JB6 DEVELOPMENT ===

// Combine with other jb6 MCP tools for comprehensive development workflow

// 1. After reading project files, create todos for needed work
jb6_mcp:getFilesContent({
  filesPaths: "packages/ui/components.js,packages/ui/tests.js",
  repoRoot: "/home/shaiby/projects/jb6"
})
// Then based on analysis:
jb6_mcp:todoAdd({
  repoRoot: "/home/shaiby/projects/jb6",
  content: "Add missing tests for button component hover states",
  priority: "medium",
  metadata: {relatedFiles: ["packages/ui/components.js", "packages/ui/tests.js"]}
})

// 2. Test component behavior, then create implementation todo
jb6_mcp:runSnippet({
  compText: "button('Save', log('clicked'))",
  filePath: "packages/ui/test.js", 
  repoRoot: "/home/shaiby/projects/jb6"
})
// If test reveals issues:
jb6_mcp:todoAdd({
  repoRoot: "/home/shaiby/projects/jb6",
  content: "Fix button component log action not firing",
  priority: "high",
  metadata: {testResult: "button click not logging", component: "button"}
})

// 3. After completing implementation, update todo status
jb6_mcp:replaceFileSection({...}) // Make the actual code changes
jb6_mcp:todoComplete({
  repoRoot: "/home/shaiby/projects/jb6",
  todoId: "todo_button_fix_id"
})

// 4. Use stats to track project health
jb6_mcp:todoStats({repoRoot: "/home/shaiby/projects/jb6"})
// Monitor ratio of completed vs pending for project progress`,
        points: [
          explanation('TodoProg integrates seamlessly with existing jb6 MCP development tools'),
          methodology('Development cycle: analyze → plan → implement → test → complete → monitor'),
          syntax('metadata.relatedFiles', 'Link todos to specific files for better context'),
          syntax('metadata.testResult', 'Track testing outcomes and failures'),
          whenToUse('Throughout development cycle for systematic task management'),
          evidence('Systematic task tracking improves development velocity and reduces forgotten work')
        ]
      }),
      bestPractice({
        suboptimalCode: 'keeping todos in your head or scattered across different tools',
        better: 'using systematic todoWrite for AI planning and todoUpdate for progress tracking',
        reason: 'persistent project-scoped storage with rich metadata enables better collaboration and progress visibility'
      }),
      doNot('Manual todo management without priority and status tracking', {
        reason: 'research shows effective task management requires clear prioritization and progress visibility'
      }),
      doNot('Using todoWrite for single task additions', {
        reason: 'todoWrite replaces entire list - use todoAdd for individual additions to preserve existing todos'
      })
    ]
  })
})

Doclet('todoProgDataFormat', {
  impl: principle({
    importance: 'high',
    rule: 'TodoProg uses structured data format with validation and normalization',
    rationale: 'Consistent data format enables reliable AI integration and cross-tool compatibility',
    guidance: [
      solution({
        code: `// === TODO DATA SCHEMA ===

// Complete todo object structure:
{
  id: "todo_1641234567890_abc123def",    // Auto-generated unique ID
  content: "Implement user authentication",  // Task description
  status: "pending",                     // pending | in_progress | completed  
  priority: "high",                      // high | medium | low
  created_at: "2024-01-03T10:30:00Z",   // ISO timestamp
  updated_at: "2024-01-03T11:45:00Z",   // ISO timestamp  
  metadata: {                           // Optional custom data
    estimatedTime: "2 hours",
    tags: ["backend", "security"],
    issueId: "#123",
    assignee: "backend-team",
    relatedFiles: ["auth.js", "auth-tests.js"],
    dependencies: ["todo_oauth_research_id"]
  }
}

// === VALIDATION AND NORMALIZATION ===

// Input validation - these are automatically normalized:
{
  content: "",              // → "(Empty todo)"
  status: "invalid",        // → "pending" 
  priority: "urgent",       // → "medium"
  // missing id            // → auto-generated
  // missing timestamps    // → current time
  // missing metadata      // → {}
}

// === STORAGE FORMAT ===

// Stored in .jb6/todos.json in project root:
[
  {
    "id": "todo_1641234567890_abc123def",
    "content": "Implement user authentication", 
    "status": "in_progress",
    "priority": "high",
    "created_at": "2024-01-03T10:30:00Z",
    "updated_at": "2024-01-03T11:45:00Z",
    "metadata": {
      "estimatedTime": "2 hours",
      "tags": ["backend", "security"]
    }
  }
]`,
        points: [
          syntax('id generation', 'Format: todo_{timestamp}_{random} for uniqueness'),
          syntax('status values', 'Only pending, in_progress, completed allowed - others normalized to pending'),
          syntax('priority values', 'Only high, medium, low allowed - others normalized to medium'),
          syntax('timestamps', 'ISO format for consistent parsing across tools'),
          syntax('metadata', 'Flexible object for custom attributes and integration data'),
          explanation('File stored per-project for isolation - no global todo mixing'),
          evidence('Schema based on Claude Code TodoWrite research and task management best practices')
        ]
      })
    ]
  })
})