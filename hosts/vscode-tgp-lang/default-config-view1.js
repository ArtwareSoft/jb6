export function setUpJb6Views(coreUtils) {
  const { jb } = coreUtils
  const { h, L, useState, useEffect, useRef, useContext } = jb.reactUtils
  
  function probeResultView(props) {
    const { probeRes, cmd, error } = props.probeRes
  
    const [showJson, setShowJson] = useState(false)
    const [showCmd, setShowCmd] = useState(false)
    const [showError, setShowError] = useState(false)
    const [focusedInput, setFocusedInput] = useState(null)
    
    const getShortName = (id) => id.split('>').pop()
    const getPathElements = (path) => path.split('~')
    const getVisitsForPath = () => probeRes.visits[probeRes.probePath] || 0
    const getTestFailures = () => {
      const failures = []
      Object.keys(probeRes.circuitRes).forEach(key => {
        if (probeRes.circuitRes[key]?.testFailure) {
          failures.push(probeRes.circuitRes[key].testFailure)
        }
      })
      return failures
    }
  
    const handleInputFocus = (index) => {
      setFocusedInput(focusedInput === index ? null : index)
    }
  
    const getActiveView = () => {
      if (showJson) return 'json'
      if (showCmd) return 'cmd'
      if (showError) return 'error'
      return 'results'
    }
  
    const setActiveView = (view) => {
      setShowJson(view === 'json')
      setShowCmd(view === 'cmd')
      setShowError(view === 'error')
    }
  
    return h('div:w-full h-96 overflow-auto bg-white border rounded shadow-sm text-xs', {},
      h('div:sticky top-0 bg-white border-b px-3 py-2 flex items-center justify-between', {
        className: !probeRes.circuitRes.success ? 'bg-red-50 border-red-200' : ''
      },
        h('div:flex items-center gap-2', {},
          probeRes.circuitRes.success 
            ? h('L:Check', { className: 'text-green-600' })
            : h('L:X', { className: 'text-red-600' }),
          h('span:font-semibold', {
            className: !probeRes.circuitRes.success ? 'text-red-800' : ''
          }, getShortName(probeRes.circuitCmpId)),
          h('span:text-gray-500', {}, `(${getVisitsForPath()}v)`),
          h('span:bg-blue-100 text-blue-700 px-1 rounded', {}, `${probeRes.totalTime}ms`),
          h('span:bg-gray-100 text-gray-600 px-1 rounded', {}, `${probeRes.logs.length}L`)
        ),
        h('div:flex gap-1', {},
          h('button:text-blue-600 hover:text-blue-800 text-xs px-1 rounded', {
            className: getActiveView() === 'json' ? 'bg-blue-100' : '',
            onClick: () => setActiveView(getActiveView() === 'json' ? 'results' : 'json')
          }, 'JSON'),
          cmd && h('button:text-purple-600 hover:text-purple-800 text-xs px-1 rounded', {
            className: getActiveView() === 'cmd' ? 'bg-purple-100' : '',
            onClick: () => setActiveView(getActiveView() === 'cmd' ? 'results' : 'cmd')
          }, 'CMD'),
          error && h('button:text-red-600 hover:text-red-800 text-xs px-1 rounded', {
            className: getActiveView() === 'error' ? 'bg-red-100' : '',
            onClick: () => setActiveView(getActiveView() === 'error' ? 'results' : 'error')
          }, 'ERR')
        )
      ),
  
      h('div:text-xs text-gray-600 px-3 py-1 border-b truncate', { 
        title: probeRes.probePath 
      }, ...getPathElements(probeRes.probePath).map((elem, i, arr) => 
        i === arr.length - 1 
          ? h('span:font-medium', { key: i }, elem)
          : [h('span', { key: `${i}-elem` }, elem), h('span:mx-0.5', { key: `${i}-sep` }, '~')]
      ).flat()),
  
      (probeRes.errors.length > 0 || getTestFailures().length > 0) && h('div:bg-red-50 border-l-2 border-red-500 px-3 py-1 text-red-700', {},
        h('div:font-medium', {}, 'Errors'),
        probeRes.errors.length > 0 && h('pre:text-xs overflow-auto mb-1', {}, JSON.stringify(probeRes.errors, null, 1)),
        ...getTestFailures().map((failure, i) => 
          h('div:text-xs mb-1', { key: i },
            h('span:font-medium', {}, failure.code + ': '),
            h('span:font-mono', {}, failure.url || failure.message || 'Test failure')
          )
        )
      ),
  
      getActiveView() === 'json' ? h('div:p-3', {},
        h('pre:bg-gray-900 text-green-400 p-2 rounded text-xs overflow-auto max-h-64', {}, 
          JSON.stringify(probeRes, null, 2))
      ) : getActiveView() === 'cmd' ? h('div:p-3', {},
        h('div:mb-2 flex items-center justify-between', {},
          h('span:font-medium text-purple-800', {}, 'Command:'),
          h('button:text-purple-600 hover:text-purple-800 text-xs px-2 py-1 border border-purple-300 rounded hover:bg-purple-50', {
            onClick: () => navigator.clipboard.writeText(cmd)
          }, 'Copy')
        ),
        h('pre:bg-purple-50 border border-purple-200 p-2 rounded text-xs overflow-auto max-h-64 font-mono', {}, cmd)
      ) : getActiveView() === 'error' ? h('div:p-3', {},
        h('div:mb-2 font-medium text-red-800', {}, 'Error:'),
        h('pre:bg-red-50 border border-red-200 p-2 rounded text-xs overflow-auto max-h-64', {}, 
          typeof error === 'string' ? error : JSON.stringify(error, null, 2))
      ) : h('div:p-3 space-y-2', {},
        probeRes.result.length === 0 ? h('div:text-gray-500 text-center py-4', {}, 'No results') :
        probeRes.result.map((result, index) => h('div:border rounded p-2', { key: index }, h(inputOutput, { index, focusedInput, ...result} ) ))
      )
    )
  }
  // Content type plugins
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

function inputOutput({in: In, out, index, focusedInput, handleInputFocus}) {
  const [mode, setMode] = useState('simple') // 'simple' or 'browser'
  
  if (mode === 'browser') {
    return h('div:space-y-3', {},
      h('div:flex items-center gap-2 mb-2', {},
        h('button:text-blue-600 text-xs', {
          onClick: () => setMode('simple')
        }, '← Simple View')
      ),
      h('div', {},
        h('div:font-medium text-gray-700 text-sm mb-2', {}, 'Input Data:'),
        h('div:border rounded p-2 bg-gray-50', {},
          h(DataBrowser, { data: In, maxDepth: 4 })
        )
      ),
      h('div', {},
        h('div:font-medium text-gray-700 text-sm mb-2', {}, 'Output:'),
        h('div:border rounded p-2 bg-gray-50', {},
          h(DataBrowser, { data: out, maxDepth: 2 })
        )
      )
    )
  }
  
  // Simple mode fallback
  const renderValue = (value) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object') return JSON.stringify(value, null, focusedInput === index ? 2 : 0)
    return String(value)
  }

  const getValueLength = (value) => {
    if (typeof value === 'string') return value.length
    if (typeof value === 'object' && value !== null) return JSON.stringify(value).length
    return String(value).length
  }

  const displayValue = renderValue(In.data)
  const shouldShowFocus = getValueLength(In.data) > 30

  return h('div:grid grid-cols-2 gap-3', {},
    h('div', {},
      h('div:flex items-center gap-1 mb-1', {},
        h('span:font-medium text-gray-600', {}, 'In:'),
        shouldShowFocus && h('button:text-blue-600 text-xs', {
          onClick: () => handleInputFocus(index)
        }, focusedInput === index ? 'hide' : 'focus'),
        h('button:text-purple-600 text-xs ml-1', {
          onClick: () => setMode('browser')
        }, 'browse')
      ),
      h('div:bg-gray-50 p-1 rounded font-mono text-xs', {
        className: focusedInput === index ? 'whitespace-pre-wrap' : 'truncate'
      }, displayValue)
    ),
    
    h('div', {},
      h('div:font-medium text-gray-600 mb-1', {}, 'Out:'),
      h('div:flex items-center gap-1', {},
        out === true 
          ? h('L:Check', { className: 'text-green-600' })
          : out === false 
            ? h('L:X', { className: 'text-red-600' })
            : null,
        h('span:font-mono', {}, renderValue(out))
      )
    )
  )
}

  function inputOutputOld({in: In, out, index, focusedInput, handleInputFocus}) {
    const [expandedVars, setExpandedVars] = useState(false)
  
    const renderValue = (value) => {
      if (value === null || value === undefined) return 'null'
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      if (typeof value === 'object') return JSON.stringify(value, null, focusedInput === index ? 2 : 0)
      return String(value)
    }
  
    const getValueLength = (value) => {
      if (typeof value === 'string') return value.length
      if (typeof value === 'object' && value !== null) return JSON.stringify(value).length
      return String(value).length
    }
  
    const displayValue = renderValue(In.data)
    const shouldShowFocus = getValueLength(In.data) > 30
  
    try {
      return h('div:grid grid-cols-2 gap-3', {},
        h('div', {},
          h('div:flex items-center gap-1 mb-1', {},
            h('span:font-medium text-gray-600', {}, 'In:'),
            shouldShowFocus && h('button:text-blue-600 text-xs', {
              onClick: () => handleInputFocus(index)
            }, focusedInput === index ? 'hide' : 'focus')
          ),
          h('div:bg-gray-50 p-1 rounded font-mono text-xs', {
            className: focusedInput === index ? 'whitespace-pre-wrap' : 'truncate'
          }, displayValue),
          
          In.vars && Object.keys(In.vars).length > 0 && h('div:mt-1', {},
            h('button:flex items-center gap-0.5 text-xs text-gray-600', {
              onClick: () => setExpandedVars(!expandedVars)
            },
              expandedVars ? h('L:ChevronDown') : h('L:ChevronRight'),
              'vars'
            ),
            expandedVars && h('div:bg-gray-50 p-1 rounded mt-1 font-mono text-xs', {},
              h('pre', {}, JSON.stringify(In.vars, null, 1))
            )
          )
        ),
        
        h('div', {},
          h('div:font-medium text-gray-600 mb-1', {}, 'Out:'),
          h('div:flex items-center gap-1', {},
            out === true 
              ? h('L:Check', { className: 'text-green-600' })
              : out === false 
                ? h('L:X', { className: 'text-red-600' })
                : null,
            h('span:font-mono', {}, renderValue(out))
          )
        )
      )
    } catch (e) {
      console.log(e)
      return h('div:bg-red-50 border border-red-200 p-2 rounded', {},
        h('div:text-red-600 font-medium text-xs mb-1', {}, 'Render Error'),
        h('pre:text-xs overflow-auto', {}, JSON.stringify({In, out, error: e.message}, null, 1))
      )
    }
  }

  return { probeResultView }
}