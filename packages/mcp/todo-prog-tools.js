import { dsls, coreUtils } from '@jb6/core'
const { pathJoin, logError } = coreUtils
  
const {
    common: { Data, Action,
       data: { pipeline, filter, count, asIs, obj, extend, property, Switch, list, split, join, getFilesContent },
       action: { saveToFile}
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool }
} = dsls

Data('loadTodos', {
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true}
  ],
  impl: getFilesContent('%$repoRoot%/.jb6/todos.json')
})

Action('saveTodos', {
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true},
    {id: 'todos', as: 'array', mandatory: true}
  ],
  impl: saveToFile('%$repoRoot%/.jb6/todos.json', '%$repoRoot%', { content: json.stringify('%$todos%') })
})

Data('generateTodoId', {
  impl: pipeline(
    Var('timestamp', () => Date.now()),
    Var('random', () => Math.random().toString(36).substr(2, 9)),
    'todo_%$timestamp%_%$random%'
  )
})

Data('validateTodoStatus', {
  params: [
    {id: 'status', as: 'string'}
  ],
  impl: pipeline(
    '%$status%',
    Switch(
      list(
        {case: 'pending', value: 'pending'},
        {case: 'in_progress', value: 'in_progress'}, 
        {case: 'completed', value: 'completed'}
      ),
      'pending' // default
    )
  )
})

Data('validateTodoPriority', {
  params: [
    {id: 'priority', as: 'string'}
  ],
  impl: pipeline(
    '%$priority%',
    Switch(
      list(
        {case: 'high', value: 'high'},
        {case: 'medium', value: 'medium'},
        {case: 'low', value: 'low'}
      ),
      'medium' // default
    )
  )
})

Data('validateTodo', {
  params: [
    {id: 'todo', as: 'object', mandatory: true}
  ],
  impl: pipeline(
    '%$todo%',
    async (ctx, {}, todo) => {
      const id = todo.id || await dsls.common.data.generateTodoId.$run()
      const status = await dsls.common.data.validateTodoStatus.$run({status: todo.status})
      const priority = await dsls.common.data.validateTodoPriority.$run({priority: todo.priority})
      const now = new Date().toISOString()
      
      return {
        id,
        content: (todo.content || '').toString().trim() || '(Empty todo)',
        status,
        priority,
        created_at: todo.created_at || now,
        updated_at: now,
        metadata: todo.metadata || {}
      }
    }
  )
})

Data('findTodoById', {
  params: [
    {id: 'todos', as: 'array', mandatory: true},
    {id: 'todoId', as: 'string', mandatory: true}
  ],
  impl: pipeline(
    '%$todos%',
    filter(equals('%id%','%$todoId%')),
    (ctx, {}, {todos}) => ({
      todo: results[0] || null,
      index: results.length > 0 ? ctx.vars.todos.findIndex(t => t.id === ctx.vars.todoId) : -1
    })
  )
})

Data('todoStats', {
  params: [
    {id: 'todos', as: 'array', mandatory: true}
  ],
  impl: pipeline(
    '%$todos%',
    (ctx, {}, todos) => ({
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      in_progress: todos.filter(t => t.status === 'in_progress').length, 
      completed: todos.filter(t => t.status === 'completed').length,
      high_priority: todos.filter(t => t.priority === 'high').length,
      medium_priority: todos.filter(t => t.priority === 'medium').length,
      low_priority: todos.filter(t => t.priority === 'low').length
    })
  )
})

Data('filterTodos', {
  params: [
    {id: 'todos', as: 'array', mandatory: true},
    {id: 'status', as: 'string'},
    {id: 'priority', as: 'string'}, 
    {id: 'search', as: 'string'}
  ],
  impl: pipeline(
    '%$todos%',
    (ctx, {}, todos) => {
      let filtered = todos
      
      if (ctx.vars.status) {
        filtered = filtered.filter(todo => todo.status === ctx.vars.status)
      }
      
      if (ctx.vars.priority) {
        filtered = filtered.filter(todo => todo.priority === ctx.vars.priority)
      }
      
      if (ctx.vars.search) {
        const searchLower = ctx.vars.search.toLowerCase()
        filtered = filtered.filter(todo => 
          todo.content.toLowerCase().includes(searchLower)
        )
      }
      
      return filtered
    }
  )
})

// MCP Tool wrapper for common responses
Data('mcpSuccessResponse', {
  params: [
    {id: 'responseData', as: 'object', mandatory: true}
  ],
  impl: pipeline(
    '%$responseData%',
    (ctx, {}, responseData) => ({
      content: [{ type: 'text', text: JSON.stringify(responseData) }],
      isError: false
    })
  )
})

Data('mcpErrorResponse', {
  params: [
    {id: 'errorMessage', as: 'string', mandatory: true}
  ],
  impl: pipeline(
    '%$errorMessage%',
    (ctx, {}, errorMessage) => ({
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: errorMessage }) }],
      isError: true
    })
  )
})

// =============================================================================
// MCP TOOLS using common DSL components
// =============================================================================

Tool('todoRead', {
  description: 'Get current todo list for the project',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    '%$repoRoot%',
    loadTodos('%$repoRoot%'),
    (ctx, {}, todos) => ({
      success: true,
      todos: todos,
      count: todos.length
    }),
    mcpSuccess('%%')
  ))
})

Tool('todoWrite', {
  description: 'Replace entire todo list with new tasks (following Claude Code TodoWrite pattern)',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todos', as: 'array', dynamic: true, mandatory: true, description: 'Array of todo objects to replace current list'}
  ],
  impl: async (ctx, args) => {
    try {
      const { repoRoot, todos: todosParam } = {
        ...args,
        todos: args.todos.profile
      }
      
      if (!Array.isArray(todosParam)) {
        return await dsls.common.data.mcpError.$run({error: 'Todos must be an array'})
      }

      // Validate each todo using common DSL
      const normalizedTodos = []
      for (const todo of todosParam) {
        const normalized = await dsls.common.data.validateTodo.$run({todo})
        normalizedTodos.push(normalized)
      }

      const saveResult = await dsls.common.data.saveTodos.$run({repoRoot, todos: normalizedTodos})
      
      const response = {
        success: saveResult.success,
        count: saveResult.count,
        todos: saveResult.success ? normalizedTodos : undefined,
        error: saveResult.error
      }

      return saveResult.success 
        ? await dsls.common.data.mcpSuccess.$run({data: response})
        : await dsls.common.data.mcpError.$run({error: saveResult.error})
        
    } catch (error) {
      return await dsls.common.data.mcpError.$run({error: error.message})
    }
  }
})

Tool('todoAdd', {
  description: 'Add a single todo item to the current list',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'content', as: 'string', mandatory: true, description: 'Todo content/description'},
    {id: 'priority', as: 'string', defaultValue: 'medium', description: 'Priority: high, medium, or low'},
    {id: 'status', as: 'string', defaultValue: 'pending', description: 'Status: pending, in_progress, or completed'},
    {id: 'metadata', as: 'object', defaultValue: {}, description: 'Additional metadata object'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    obj(
      property('repoRoot', '%$repoRoot%'),
      property('newTodo', obj(
        property('content', '%$content%'),
        property('priority', '%$priority%'),
        property('status', '%$status%'),
        property('metadata', '%$metadata%')
      ))
    ),
    async (ctx, {}, {repoRoot, newTodo}) => {
      try {
        const todos = await dsls.common.data.loadTodos.$run({repoRoot})
        const validated = await dsls.common.data.validateTodo.$run({todo: newTodo})
        const updatedTodos = [...todos, validated]
        const saveResult = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
        
        const response = {
          success: saveResult.success,
          todo: validated,
          error: saveResult.error
        }
        
        return saveResult.success 
          ? await dsls.common.data.mcpSuccess.$run({data: response})
          : await dsls.common.data.mcpError.$run({error: saveResult.error})
          
      } catch (error) {
        return await dsls.common.data.mcpError.$run({error: error.message})
      }
    }
  ))
})

Tool('todoComplete', {
  description: 'Mark a todo as completed by ID',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todoId', as: 'string', mandatory: true, description: 'ID of todo to mark as completed'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    obj(
      property('repoRoot', '%$repoRoot%'),
      property('todoId', '%$todoId%')
    ),
    async (ctx, {}, {repoRoot, todoId}) => {
      try {
        const todos = await dsls.common.data.loadTodos.$run({repoRoot})
        const found = await dsls.common.data.findTodoById.$run({todos, todoId})
        
        if (!found.todo) {
          return await dsls.common.data.mcpError.$run({error: `Todo with ID ${todoId} not found`})
        }

        const updatedTodo = {
          ...found.todo,
          status: 'completed',
          updated_at: new Date().toISOString()
        }
        
        const updatedTodos = [...todos]
        updatedTodos[found.index] = updatedTodo
        
        const saveResult = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
        
        const response = {
          success: saveResult.success,
          todo: updatedTodo,
          error: saveResult.error
        }
        
        return saveResult.success 
          ? await dsls.common.data.mcpSuccess.$run({data: response})
          : await dsls.common.data.mcpError.$run({error: saveResult.error})
          
      } catch (error) {
        return await dsls.common.data.mcpError.$run({error: error.message})
      }
    }
  ))
})

Tool('todoUpdate', {
  description: 'Update specific fields of a todo by ID',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todoId', as: 'string', mandatory: true, description: 'ID of todo to update'},
    {id: 'updates', as: 'object', dynamic: true, mandatory: true, description: 'Object with fields to update (content, status, priority, metadata)'}
  ],
  impl: async (ctx, args) => {
    try {
      const { repoRoot, todoId, updates: updatesParam } = {
        ...args,
        updates: args.updates.profile
      }
      
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      const found = await dsls.common.data.findTodoById.$run({todos, todoId})
      
      if (!found.todo) {
        return await dsls.common.data.mcpError.$run({error: `Todo with ID ${todoId} not found`})
      }

      const currentTodo = found.todo
      const mergedTodo = {
        ...currentTodo,
        ...updatesParam,
        id: todoId, // Preserve original ID
        created_at: currentTodo.created_at // Preserve creation time
      }
      
      const updatedTodo = await dsls.common.data.validateTodo.$run({todo: mergedTodo})
      
      const updatedTodos = [...todos]
      updatedTodos[found.index] = updatedTodo
      
      const saveResult = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
      
      const response = {
        success: saveResult.success,
        todo: updatedTodo,
        error: saveResult.error
      }
      
      return saveResult.success 
        ? await dsls.common.data.mcpSuccess.$run({data: response})
        : await dsls.common.data.mcpError.$run({error: saveResult.error})
        
    } catch (error) {
      return await dsls.common.data.mcpError.$run({error: error.message})
    }
  }
})

Tool('todoDelete', {
  description: 'Delete a todo by ID',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todoId', as: 'string', mandatory: true, description: 'ID of todo to delete'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    obj(
      property('repoRoot', '%$repoRoot%'),
      property('todoId', '%$todoId%')
    ),
    async (ctx, {}, {repoRoot, todoId}) => {
      try {
        const todos = await dsls.common.data.loadTodos.$run({repoRoot})
        const found = await dsls.common.data.findTodoById.$run({todos, todoId})
        
        if (!found.todo) {
          return await dsls.common.data.mcpError.$run({error: `Todo with ID ${todoId} not found`})
        }

        const updatedTodos = todos.filter(todo => todo.id !== todoId)
        const saveResult = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
        
        const response = {
          success: saveResult.success,
          deletedCount: 1,
          remainingCount: updatedTodos.length,
          error: saveResult.error
        }
        
        return saveResult.success 
          ? await dsls.common.data.mcpSuccess.$run({data: response})
          : await dsls.common.data.mcpError.$run({error: saveResult.error})
          
      } catch (error) {
        return await dsls.common.data.mcpError.$run({error: error.message})
      }
    }
  ))
})

Tool('todoClear', {
  description: 'Clear all todos (set to empty list)',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    '%$repoRoot%',
    async (ctx, {}, repoRoot) => {
      try {
        const saveResult = await dsls.common.data.saveTodos.$run({repoRoot, todos: []})
        
        const response = {
          success: saveResult.success,
          clearedCount: 0, // We don't track previous count
          error: saveResult.error
        }
        
        return saveResult.success 
          ? await dsls.common.data.mcpSuccess.$run({data: response})
          : await dsls.common.data.mcpError.$run({error: saveResult.error})
          
      } catch (error) {
        return await dsls.common.data.mcpError.$run({error: error.message})
      }
    }
  ))
})

Tool('todoStats', {
  description: 'Get statistics about current todos',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    '%$repoRoot%',
    loadTodos('%$repoRoot%'),
    todoStats('%%'),
    (ctx, {}, stats) => ({ success: true, stats }),
    mcpSuccess('%%')
  ))
})

Tool('todoFilter', {
  description: 'Filter todos by status, priority, or content search',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'status', as: 'string', description: 'Filter by status: pending, in_progress, or completed'},
    {id: 'priority', as: 'string', description: 'Filter by priority: high, medium, or low'},
    {id: 'search', as: 'string', description: 'Search in todo content (case-insensitive)'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    obj(
      property('repoRoot', '%$repoRoot%'),
      property('status', '%$status%'),
      property('priority', '%$priority%'),
      property('search', '%$search%')
    ),
    async (ctx, {}, {repoRoot, status, priority, search}) => {
      try {
        const todos = await dsls.common.data.loadTodos.$run({repoRoot})
        const filtered = await dsls.common.data.filterTodos.$run({todos, status, priority, search})
        
        const response = {
          success: true,
          todos: filtered,
          count: filtered.length,
          filters: { status, priority, search }
        }
        
        return await dsls.common.data.mcpSuccess.$run({data: response})
        
      } catch (error) {
        return await dsls.common.data.mcpError.$run({error: error.message})
      }
    }
  ))
})

// =============================================================================
// MCP TOOLS
// =============================================================================

Tool('todoRead', {
  description: 'Get current todo list for the project',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: async (ctx, {repoRoot}) => {
    try {
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            todos: todos,
            count: todos.length
          })
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message,
            todos: [],
            count: 0
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoWrite', {
  description: 'Replace entire todo list with new tasks (following Claude Code TodoWrite pattern)',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todos', as: 'array', dynamic: true, mandatory: true, description: 'Array of todo objects to replace current list'}
  ],
  impl: async (ctx, args) => {
    try {
      const { repoRoot, todos: todosParam } = {
        ...args,
        todos: args.todos.profile
      }
      
      if (!Array.isArray(todosParam)) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              success: false,
              error: 'Todos must be an array',
              count: 0
            })
          }],
          isError: true
        }
      }

      // Validate each todo using TGP component
      const normalizedTodos = []
      for (const todo of todosParam) {
        const normalized = await dsls.common.data.validateTodo.$run({todo})
        normalizedTodos.push(normalized)
      }

      const result = await dsls.common.data.saveTodos.$run({repoRoot, todos: normalizedTodos})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: result.success,
            count: result.count,
            todos: result.success ? normalizedTodos : undefined,
            error: result.error
          })
        }],
        isError: !result.success
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message,
            count: 0
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoAdd', {
  description: 'Add a single todo item to the current list',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'content', as: 'string', mandatory: true, description: 'Todo content/description'},
    {id: 'priority', as: 'string', defaultValue: 'medium', description: 'Priority: high, medium, or low'},
    {id: 'status', as: 'string', defaultValue: 'pending', description: 'Status: pending, in_progress, or completed'},
    {id: 'metadata', as: 'object', defaultValue: {}, description: 'Additional metadata object'}
  ],
  impl: async (ctx, {repoRoot, content, priority, status, metadata}) => {
    try {
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      const newTodo = await dsls.common.data.validateTodo.$run({
        todo: { content, priority, status, metadata }
      })
      
      const updatedTodos = [...todos, newTodo]
      const result = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: result.success,
            todo: newTodo,
            error: result.error
          })
        }],
        isError: !result.success
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoComplete', {
  description: 'Mark a todo as completed by ID',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todoId', as: 'string', mandatory: true, description: 'ID of todo to mark as completed'}
  ],
  impl: async (ctx, {repoRoot, todoId}) => {
    try {
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      const todoIndex = todos.findIndex(todo => todo.id === todoId)
      if (todoIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              success: false,
              error: `Todo with ID ${todoId} not found`
            })
          }],
          isError: true
        }
      }

      const updatedTodo = {
        ...todos[todoIndex],
        status: 'completed',
        updated_at: new Date().toISOString()
      }
      
      const updatedTodos = [...todos]
      updatedTodos[todoIndex] = updatedTodo
      
      const result = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: result.success,
            todo: updatedTodo,
            error: result.error
          })
        }],
        isError: !result.success
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoUpdate', {
  description: 'Update specific fields of a todo by ID',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todoId', as: 'string', mandatory: true, description: 'ID of todo to update'},
    {id: 'updates', as: 'object', dynamic: true, mandatory: true, description: 'Object with fields to update (content, status, priority, metadata)'}
  ],
  impl: async (ctx, args) => {
    try {
      const { repoRoot, todoId, updates: updatesParam } = {
        ...args,
        updates: args.updates.profile
      }
      
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      const todoIndex = todos.findIndex(todo => todo.id === todoId)
      if (todoIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              success: false,
              error: `Todo with ID ${todoId} not found`
            })
          }],
          isError: true
        }
      }

      const currentTodo = todos[todoIndex]
      const updatedTodo = await dsls.common.data.validateTodo.$run({
        todo: {
          ...currentTodo,
          ...updatesParam,
          id: todoId, // Preserve original ID
          created_at: currentTodo.created_at // Preserve creation time
        }
      })
      
      const updatedTodos = [...todos]
      updatedTodos[todoIndex] = updatedTodo
      
      const result = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: result.success,
            todo: updatedTodo,
            error: result.error
          })
        }],
        isError: !result.success
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoDelete', {
  description: 'Delete a todo by ID',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'todoId', as: 'string', mandatory: true, description: 'ID of todo to delete'}
  ],
  impl: async (ctx, {repoRoot, todoId}) => {
    try {
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      const todoIndex = todos.findIndex(todo => todo.id === todoId)
      if (todoIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              success: false,
              error: `Todo with ID ${todoId} not found`
            })
          }],
          isError: true
        }
      }

      const updatedTodos = todos.filter(todo => todo.id !== todoId)
      const result = await dsls.common.data.saveTodos.$run({repoRoot, todos: updatedTodos})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: result.success,
            deletedCount: 1,
            remainingCount: updatedTodos.length,
            error: result.error
          })
        }],
        isError: !result.success
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoClear', {
  description: 'Clear all todos (set to empty list)',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: async (ctx, {repoRoot}) => {
    try {
      const result = await dsls.common.data.saveTodos.$run({repoRoot, todos: []})
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: result.success,
            clearedCount: 0, // We don't track previous count
            error: result.error
          })
        }],
        isError: !result.success
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message
          })
        }],
        isError: true
      }
    }
  }
})

Tool('todoStats', {
  description: 'Get statistics about current todos',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'}
  ],
  impl: typeAdapter('data<common>', pipeline(
    '%$repoRoot%',
    async (ctx, {}, repoRoot) => {
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      const stats = {
        total: todos.length,
        pending: todos.filter(t => t.status === 'pending').length,
        in_progress: todos.filter(t => t.status === 'in_progress').length,
        completed: todos.filter(t => t.status === 'completed').length,
        high_priority: todos.filter(t => t.priority === 'high').length,
        medium_priority: todos.filter(t => t.priority === 'medium').length,
        low_priority: todos.filter(t => t.priority === 'low').length
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            stats: stats
          })
        }],
        isError: false
      }
    }
  ))
})

Tool('todoFilter', {
  description: 'Filter todos by status, priority, or content search',
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'status', as: 'string', description: 'Filter by status: pending, in_progress, or completed'},
    {id: 'priority', as: 'string', description: 'Filter by priority: high, medium, or low'},
    {id: 'search', as: 'string', description: 'Search in todo content (case-insensitive)'}
  ],
  impl: async (ctx, {repoRoot, status, priority, search}) => {
    try {
      const todos = await dsls.common.data.loadTodos.$run({repoRoot})
      
      let filtered = todos
      
      if (status) {
        filtered = filtered.filter(todo => todo.status === status)
      }
      
      if (priority) {
        filtered = filtered.filter(todo => todo.priority === priority)
      }
      
      if (search) {
        const searchLower = search.toLowerCase()
        filtered = filtered.filter(todo => 
          todo.content.toLowerCase().includes(searchLower)
        )
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            todos: filtered,
            count: filtered.length,
            filters: { status, priority, search }
          })
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: false,
            error: error.message,
            todos: [],
            count: 0
          })
        }],
        isError: true
      }
    }
  }
})