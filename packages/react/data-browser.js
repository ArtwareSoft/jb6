import { dsls} from '@jb6/core'
import { reactUtils } from '@jb6/react'

const { 
    tgp: { Const, TgpType, var: { Var } }, 
  } = dsls
  
const { h, L, useState, useEffect, useRef, useContext } = reactUtils
Object.assign(reactUtils,{DataBrowser})

const contentTypePlugins = {
  html: {
    detect: (value) => typeof value === 'string' && value.trim().startsWith('<') && value.includes('>'),
    summaryLine: (value) => `HTML (${value.length} chars)`,
    text: (value) => value,
    reactComp: (value) => h('div:border rounded p-2 bg-gray-50', {},
      h('div:text-xs text-gray-600 mb-2', {}, 'HTML Preview:'),
      h('div:border rounded p-2 bg-white max-h-32 overflow-auto', {
        dangerouslySetInnerHTML: { __html: value }
      })
    )
  },
  
  json: {
    detect: (value) => typeof value === 'object' && value !== null,
    summaryLine: (value) => Array.isArray(value) 
      ? `Array[${value.length}]` 
      : `Object{${Object.keys(value).length}}`,
    text: (value) => JSON.stringify(value, null, 2),
    reactComp: (value) => h('pre:bg-gray-900 text-green-400 p-2 rounded text-xs overflow-auto max-h-32', {}, 
      JSON.stringify(value, null, 2))
  },
  
  url: {
    detect: (value) => typeof value === 'string' && /^https?:\/\//.test(value),
    summaryLine: (value) => `URL: ${value.split('/')[2]}`,
    text: (value) => value,
    reactComp: (value) => h('a:text-blue-600 hover:underline', { 
      href: value, 
      target: '_blank',
      rel: 'noopener noreferrer'
    }, value)
  },
  
  text: {
    detect: (value) => typeof value === 'string',
    summaryLine: (value) => value.length > 50 ? `${value.slice(0, 50)}...` : value,
    text: (value) => value,
    reactComp: (value) => h('div:whitespace-pre-wrap break-words', {}, value)
  },
  
  primitive: {
    detect: (value) => typeof value !== 'object' || value === null,
    summaryLine: (value) => String(value),
    text: (value) => String(value),
    reactComp: (value) => h('span:font-mono', {}, String(value))
  }
}

function detectContentType(value) {
  for (const [type, plugin] of Object.entries(contentTypePlugins)) {
    if (plugin.detect(value)) return type
  }
  return 'primitive'
}

function DataBrowser({ data, path = [], maxDepth = 3 }) {
  const [expandedPaths, setExpandedPaths] = useState(new Set())
  const [viewModes, setViewModes] = useState(new Map()) // path -> mode
  
  const toggleExpanded = (currentPath) => {
    const pathKey = currentPath.join('.')
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(pathKey)) {
      newExpanded.delete(pathKey)
    } else {
      newExpanded.add(pathKey)
    }
    setExpandedPaths(newExpanded)
  }
  
  const setViewMode = (currentPath, mode) => {
    const pathKey = currentPath.join('.')
    const newModes = new Map(viewModes)
    newModes.set(pathKey, mode)
    setViewModes(newModes)
  }
  
  const renderValue = (value, currentPath, depth = 0) => {
    const pathKey = currentPath.join('.')
    const isExpanded = expandedPaths.has(pathKey)
    const currentMode = viewModes.get(pathKey) || 'summaryLine'
    const contentType = detectContentType(value)
    const plugin = contentTypePlugins[contentType]
    
    if (depth > maxDepth) {
      return h('span:text-gray-400 text-xs', {}, '...')
    }
    
    // For objects and arrays, show expandable structure
    if (typeof value === 'object' && value !== null) {
      const isArray = Array.isArray(value)
      const keys = isArray ? value.map((_, i) => i) : Object.keys(value)
      
      return h('div', {},
        h('div:flex items-center gap-1', {},
          keys.length > 0 && h('button:text-xs text-gray-500 hover:text-gray-700', {
            onClick: () => toggleExpanded(currentPath)
          }, isExpanded ? '▼' : '▶'),
          h('span:font-medium text-xs', {}, 
            isArray ? `Array[${value.length}]` : `Object{${keys.length}}`
          )
        ),
        
        isExpanded && h('div:ml-4 mt-1 space-y-1', {},
          ...keys.slice(0, 20).map(key => {
            const childPath = [...currentPath, key]
            return h('div:text-xs', { key },
              h('span:text-gray-600 font-mono mr-2', {}, `${key}:`),
              renderValue(value[key], childPath, depth + 1)
            )
          }),
          keys.length > 20 && h('div:text-gray-400 text-xs', {}, `... ${keys.length - 20} more`)
        )
      )
    }
    
    // For primitive values, show with content type plugins
    return h('div', {},
      h('div:flex items-center gap-2', {},
        h('span:text-xs px-1 bg-gray-200 rounded', {}, contentType),
        currentMode === 'summaryLine' && h('span:text-xs', {}, plugin.summaryLine(value)),
        h('div:flex gap-1', {},
          ['summaryLine', 'text', 'reactComp'].map(mode =>
            h('button:text-xs px-1 rounded', {
              key: mode,
              className: currentMode === mode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200',
              onClick: () => setViewMode(currentPath, mode)
            }, mode === 'summaryLine' ? 'sum' : mode === 'reactComp' ? 'comp' : mode)
          )
        )
      ),
      
      currentMode === 'text' && h('div:mt-1 bg-gray-50 p-2 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-auto', {}, 
        plugin.text(value)
      ),
      
      currentMode === 'reactComp' && h('div:mt-1', {},
        plugin.reactComp(value)
      )
    )
  }
  
  return h('div:text-xs', {}, renderValue(data, path))
}
