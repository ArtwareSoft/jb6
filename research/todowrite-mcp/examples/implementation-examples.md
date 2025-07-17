# TodoWrite MCP Service Implementation Examples

## Example 1: Basic Todo Management Flow

### Creating Initial Todos
```javascript
const todoService = new TodoMCPService('/path/to/project');

// Write initial todo list
const writeResult = todoService.todoWrite([
  {
    content: 'Implement user authentication',
    status: 'in_progress',
    priority: 'high'
  },
  {
    content: 'Write unit tests for auth module',
    status: 'pending',
    priority: 'medium'
  },
  {
    content: 'Update documentation',
    status: 'pending',
    priority: 'low'
  }
]);
```

### Reading Current Todos
```javascript
const readResult = todoService.todoRead();
// Returns: {success: true, todos: [...]}
```

### Adding Single Todo
```javascript
const addResult = todoService.todoAdd({
  content: 'Deploy to staging environment',
  priority: 'high'
});
```

## Example 2: Claude Code TodoWrite Integration

### AI Assistant Usage Pattern
```
User: "Add dark mode support with user preferences"

AI: "I'll create a todo list for this multi-step feature:
- ✅ Add theme context and state management
- 🔄 Create dark mode CSS variables and styles
- ⏳ Build settings UI for theme switching
- ⏳ Add persistence to localStorage
- ⏳ Update existing components for theme support"
```

### MCP Tool Implementation
```javascript
// jb6 MCP tool integration
export const todoWriteTool = {
  name: 'TodoWrite',
  description: 'Replace entire todo list with new tasks',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            metadata: { type: 'object' }
          },
          required: ['content']
        }
      }
    },
    required: ['todos']
  },
  handler: async (params) => {
    return todoService.todoWrite(params.todos);
  }
};
```

## Example 3: Progressive Task Management

### Multi-Step Task Breakdown
```javascript
// Initial task planning
todoService.todoWrite([
  {
    content: 'Research existing authentication systems',
    status: 'pending',
    priority: 'high',
    metadata: { estimatedTime: '2 hours' }
  },
  {
    content: 'Design authentication flow',
    status: 'pending',
    priority: 'high',
    metadata: { dependencies: ['research'] }
  },
  {
    content: 'Implement authentication backend',
    status: 'pending',
    priority: 'high',
    metadata: { dependencies: ['design'] }
  }
]);

// Mark first task as in progress
todoService.todoUpdate('task-id', { status: 'in_progress' });

// Complete first task and start second
todoService.todoComplete('task-id-1');
todoService.todoUpdate('task-id-2', { status: 'in_progress' });
```

## Example 4: Advanced Features

### Statistics and Monitoring
```javascript
const stats = todoService.todoStats();
console.log('Todo Statistics:', stats);
// Output: {
//   total: 5,
//   pending: 2,
//   in_progress: 1,
//   completed: 2,
//   high_priority: 3,
//   medium_priority: 1,
//   low_priority: 1
// }
```

### Metadata Usage
```javascript
todoService.todoAdd({
  content: 'Optimize database queries',
  priority: 'medium',
  metadata: {
    estimatedTime: '4 hours',
    assignee: 'backend-team',
    tags: ['performance', 'database'],
    relatedIssues: ['#123', '#456']
  }
});
```

## Example 5: Error Handling and Validation

### Robust Error Handling
```javascript
const result = todoService.todoWrite([
  {
    content: 'Valid todo item',
    status: 'invalid_status', // Will be normalized to 'pending'
    priority: 'invalid_priority' // Will be normalized to 'medium'
  }
]);

if (!result.success) {
  console.error('TodoWrite failed:', result.error);
} else {
  console.log('Created', result.count, 'todos');
}
```

### Validation Example
```javascript
// Invalid input handling
const invalidResult = todoService.todoWrite("not an array");
// Returns: {success: false, error: "Todos must be an array", count: 0}

// Missing required fields
const missingContentResult = todoService.todoWrite([
  { status: 'pending' } // Missing content
]);
// Automatically sets content to empty string and normalizes
```

## Example 6: Integration with jb6 MCP System

### MCP Server Integration
```javascript
// In packages/mcp/mcp-tools.js
const { TodoMCPService } = require('./todo-mcp-service');

function createTodoTools(repoRoot) {
  const todoService = new TodoMCPService(repoRoot);
  
  return {
    TodoRead: {
      description: 'Get current todo list',
      handler: () => todoService.todoRead()
    },
    
    TodoWrite: {
      description: 'Replace entire todo list with new tasks',
      handler: (params) => todoService.todoWrite(params.todos)
    },
    
    TodoAdd: {
      description: 'Add a single todo item',
      handler: (params) => todoService.todoAdd(params)
    },
    
    TodoComplete: {
      description: 'Mark a todo as completed',
      handler: (params) => todoService.todoComplete(params.id)
    },
    
    TodoStats: {
      description: 'Get todo statistics',
      handler: () => todoService.todoStats()
    }
  };
}
```

### CLI Integration
```javascript
// Command-line interface
const { TodoMCPService } = require('./todo-mcp-service');

async function handleTodoCommand(args) {
  const todoService = new TodoMCPService();
  
  switch (args.command) {
    case 'list':
      const todos = todoService.todoRead();
      console.table(todos.todos);
      break;
      
    case 'add':
      const result = todoService.todoAdd({
        content: args.content,
        priority: args.priority || 'medium'
      });
      console.log('Added:', result.todo);
      break;
      
    case 'complete':
      const completed = todoService.todoComplete(args.id);
      console.log('Completed:', completed.todo);
      break;
  }
}
```

## Data Flow Example

### Complete Task Management Workflow
```
1. User Request → "Implement user authentication system"
2. AI Planning → TodoWrite([...breakdown of tasks...])
3. Task Execution → TodoUpdate(id, {status: 'in_progress'})
4. Progress Updates → TodoUpdate(id, {metadata: {progress: 50}})
5. Completion → TodoComplete(id)
6. Review → TodoStats() to see overall progress
```

This comprehensive example set demonstrates the practical implementation and usage patterns for the TodoWrite MCP service in the jb6 ecosystem.
