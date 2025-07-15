import { dsls, coreUtils } from '@jb6/core'
const { pathJoin } = coreUtils
  
const {
    common: { Data,
       data: { runNodeScript, pipeline, split, join, first }
    },
    tgp: { any: { typeAdapter }},
    mcp: { Tool }
} = dsls

 
Tool('getFilesContent', {
    description: 'Read the content of one or more files from the repository. Essential for understanding existing code before making changes.',
    params: [
      { id: 'filesPaths', as: 'string', mandatory: true, description: 'Comma-separated relative file paths (e.g., "packages/common/jb-common.js,packages/ui/ui-core.js")' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root' }
    ],
    impl: async (ctx, { filesPaths, repoRoot }) => {
      try {
        const { readFileSync } = await import('fs')
        const { pathJoin, estimateTokens } = coreUtils
        
        const files = filesPaths.split(',').map(filePath => {
          const fullPath = pathJoin(repoRoot, filePath.trim())
          const fileContent = readFileSync(fullPath, 'utf8')
          return {
            filePath: filePath.trim(),
            content: fileContent,
            tokens: estimateTokens(fileContent)
          }
        })
        
        // Format for MCP server - readable content with file separators
        const formattedContent = files.map(file => 
          `=== File: ${file.filePath} (${file.tokens} tokens) ===\n${file.content}`
        ).join('\n\n')
        
        return {
          content: [{ type: 'text', text: formattedContent }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error reading files: ${error.message}` }],
          isError: true
        }
      }
    }
})
  
Tool('replaceFileSection', {
    description: 'Replace a section in a file with new text, starting from a specific line and matching old section text',
    params: [
      { id: 'filePath', as: 'string', mandatory: true, description: 'relative filePath of the file in the repo' },
      { id: 'repoRoot', as: 'string', mandatory: true, description: 'filePath of the relevant repo of the project' },
      { id: 'newSectionText', as: 'string', dynamic: true, mandatory: true, description: 'new section text to replace with' },
      { id: 'fromLine', as: 'number', mandatory: true, description: 'line number to start replacement from (1-indexed)' },
      { id: 'oldSectionText', as: 'string', dynamic: true, mandatory: true, description: 'old section text to find and replace for validation' }
    ],
    impl: async (ctx, args) => {
      try {
        const { readFileSync, writeFileSync } = await import('fs')
        const fullPath = pathJoin(args.repoRoot, args.filePath)
        
        const { repoRoot, filePath, newSectionText, oldSectionText, fromLine } = {
          ...args, 
          newSectionText: args.newSectionText.profile,
          oldSectionText: args.oldSectionText.profile
        }
        const content = readFileSync(fullPath, 'utf8')
        const lines = content.split('\n')
        
        // Validate fromLine
        if (fromLine < 1 || fromLine > lines.length) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Line number ${fromLine} is out of range (1-${lines.length})` }) }],
            isError: true
          }
        }
        
        // Validate oldSectionText exists from the specified line
        const beforeLines = lines.slice(0, fromLine - 1)
        const contentAfterLine = lines.slice(fromLine - 1).join('\n')
        if (!contentAfterLine.includes(oldSectionText)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Old section text not found starting from the specified line' }) }],
            isError: true
          }
        }
        
        const updatedContentAfterLine = contentAfterLine.replace(oldSectionText, newSectionText)        
        const newContent = [...beforeLines, updatedContentAfterLine].join('\n')
        
        writeFileSync(fullPath, newContent, 'utf8')
        
        return {
          content: [{ type: 'text', text: JSON.stringify({ result: 'File section replaced successfully' }) }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
          isError: true
        }
      }
    }
})

Tool('appendToFile', {
  description: 'Add a timestamp to a file, useful for logging or tracking changes.',
  params: [
    {id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path where timestamp will be added'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'content', as: 'string', dynamic: true, mandatory: true, description: 'Content to add to the file'},
    {id: 'timeStamp', as: 'boolean', description: 'If true, prepend a timestamp to the content'}
  ],
  impl: async (ctx, args) => {
    try {
      const { readFileSync, writeFileSync } = await import('fs')
      const fullPath = pathJoin(args.repoRoot, args.filePath)

      const { repoRoot, filePath, content, timeStamp } = {
        ...args, 
        content: args.content.profile 
      }
      
      let existingContent = ''
      try {
         existingContent = readFileSync(fullPath, 'utf8')
      } catch (error) {
        // File doesn't exist, will create new file
      }
      
      const dateTime = new Date().toISOString()
      const contentToAdd = timeStamp ? '[' + dateTime + '] ' + content : content
      const newContent = existingContent + (existingContent ? '\n' : '') + contentToAdd
      writeFileSync(fullPath, newContent, 'utf8')
      
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: 'Content added successfully' }) }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true
      }
    }
  }
})


Tool('saveToFile', {
  params: [
    {id: 'filePath', as: 'string', mandatory: true, description: 'Relative file path where timestamp will be added'},
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'content', as: 'string', dynamic: true, mandatory: true, description: 'Content to add to the file'},
  ],
  impl: async (ctx, args) => {
    try {
      const { writeFileSync } = await import('fs')
      const { join } = await import('path')

      const { repoRoot, filePath, content } = { ...args, content: args.content.profile }
      const fullPath = join(repoRoot, filePath)
      writeFileSync(fullPath, content, 'utf8')
      
      return {
        content: [{ type: 'text', text: JSON.stringify({ result: 'Content added successfully' }) }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true
      }
    }
  }
})

Tool('listRepoFiles', {
  description: 'List all files in a repository with their sizes, excluding files matched by .gitignore patterns',
  params: [
    { id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root' },
    { id: 'includeHidden', as: 'boolean', defaultValue: true, description: 'Whether to include hidden files (starting with .)' }
  ],
  impl: async (ctx, { repoRoot, includeHidden }) => {
    try {
      const { readdirSync, statSync, readFileSync } = await import('fs')
      const { join, relative, sep } = await import('path')
      
      // Read .gitignore patterns if file exists
      let gitignorePatterns = []
      try {
        const gitignoreContent = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
        gitignorePatterns = gitignoreContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
      } catch (error) {
        // .gitignore doesn't exist, continue without patterns
      }
      
      // Add common patterns to always exclude
      gitignorePatterns.push('.git', 'node_modules')
      
      // Function to check if a path matches any gitignore pattern
      const isIgnored = (filePath) => {
        const relativePath = relative(repoRoot, filePath).replace(/\\/g, '/')
        const pathParts = relativePath.split('/')
        
        return gitignorePatterns.some(pattern => {
          // Handle directory patterns (ending with /)
          if (pattern.endsWith('/')) {
            const dirPattern = pattern.slice(0, -1)
            return pathParts.includes(dirPattern)
          }
          
          // Handle wildcard patterns
          if (pattern.includes('*')) {
            const regexPattern = pattern
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*')
            return new RegExp(`^${regexPattern}$`).test(relativePath) ||
                   pathParts.some(part => new RegExp(`^${regexPattern}$`).test(part))
          }
          
          // Handle exact matches
          return relativePath === pattern || 
                 relativePath.endsWith('/' + pattern) ||
                 pathParts.includes(pattern)
        })
      }
      
      // Recursive function to walk directory tree
      const walkDirectory = (dirPath) => {
        const files = []
        
        try {
          const entries = readdirSync(dirPath)
          
          for (const entry of entries) {
            const fullPath = join(dirPath, entry)
            
            // Skip hidden files unless includeHidden is true
            if (!includeHidden && entry.startsWith('.') && entry !== '.gitignore') {
              continue
            }
            
            // Skip if matches gitignore patterns
            if (isIgnored(fullPath)) {
              continue
            }
            
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
                // Recursively walk subdirectories
                files.push(...walkDirectory(fullPath))
              }
            } catch (statError) {
              // Skip files that can't be accessed
              continue
            }
          }
        } catch (readError) {
          // Skip directories that can't be read
        }
        
        return files
      }
      
      // Helper function to format bytes
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }
      
      const allFiles = walkDirectory(repoRoot)
      
      // Sort files by path
      allFiles.sort((a, b) => a.path.localeCompare(b.path))
      
      // Calculate total size
      const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0)
      
      // Format output
      const fileList = allFiles.map(file => 
        `${file.path} (${file.sizeFormatted})`
      ).join('\n')
      
      const summary = `Total: ${allFiles.length} files, ${formatBytes(totalSize)}\n\nFiles:\n${fileList}`
      
      return {
        content: [{ type: 'text', text: summary }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error listing repository files: ${error.message}` }],
        isError: true
      }
    }
  }
})

Tool('createDirectoryStructure', {
  description: 'Create a directory structure with files based on JSON input. Directories are objects, files are strings with content.',
  params: [
    { id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root' },
    { id: 'dirPath', as: 'string', mandatory: true, description: 'Relative path within repo where to create the structure' },
    { id: 'structure', as: 'object', mandatory: true, description: 'JSON describing directory structure. Objects are directories, strings are file contents.' }
  ],
  impl: async (ctx, {repoRoot, dirPath, structure}) => {
    try {
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')            
      const basePath = join(repoRoot, dirPath)

      let files = 0, dirs = 0
      const createStructure = (obj, currentPath) => {
        mkdirSync(currentPath, { recursive: true })        
        for (const [name, content] of Object.entries(obj)) {
          const itemPath = join(currentPath, name)
          if (typeof content === 'string') {
            writeFileSync(itemPath, content, 'utf8')
            files++
          } else if (typeof content === 'object' && content !== null) {
            dirs++
            createStructure(content, itemPath)
          } else {
            throw new Error(`Invalid item type for '${name}': expected string (file) or object (directory)`)
          }
        }
      }
      createStructure(structure, basePath)
            
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            result: 'Directory structure created successfully',
            created: { dirs, files, location: join(dirPath) }
          }) 
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true
      }
    }
  }
})

Tool('createResearchDir', {
  params: [
    {id: 'repoRoot', as: 'string', mandatory: true, description: 'Absolute path to repository root'},
    {id: 'researchId', as: 'string', mandatory: true}
  ],
  impl: createDirectoryStructure('%$repoRoot%', 'research/%$researchId%', {
    structure: asIs({theory: { }, examples: {}, tests: {}})
  })
})