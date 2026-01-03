import { dsls, coreUtils } from '@jb6/core'
import { reactUtils } from '@jb6/react'
import '@jb6/react/tests/react-testers.js'
import '@jb6/core/misc/import-map-services.js'
import '@jb6/core/misc/probe.js'
import '@jb6/core/misc/pretty-print.js'
import '@jb6/jq'

// Browser-only imports
if (!coreUtils.isNode) {
  await import('@jb6/react/codemirror-utils.js')
  await import('@jb6/react/lib/tailwindcss.js')
}

Object.assign(coreUtils, {runProbeStudio})

const { 
  tgp: { Const},
  common: {
    data: { jq, asIs }, 
  },
  react: { ReactComp, ReactMetadata,
    'react-comp': { comp }
  }
} = dsls

const abbr = ReactMetadata('abbr', {
  params: [
    {id: 'abbr', as: 'string'}
  ]
})

const matchData = ReactMetadata('matchData', {
  params: [
    {id: 'matchData', type: 'boolean',  dynamic: true}
  ]
})

const priority = ReactMetadata('priority', {
  params: [
    {id: 'priority', as: 'number'}
  ]
})

async function runProbeStudio(importMapsInCli, topElem) {
  jb.coreRegistry.importMapsInCli = importMapsInCli
  const { h, hh, createRoot, loadLucid05 } = reactUtils

  await loadLucid05()

  const projectRoot = await coreUtils.calcRepoRoot()
  const urlParams = new URLSearchParams(window.location.search)
  const filePath = urlParams.get('filePath') || '/packages/react/tests/react-tests.js'
  const fullFilePath = `${projectRoot}${filePath}`
  const path = urlParams.get('path') || 'reactTest.HelloWorld~impl~expectedResult'

  const root = createRoot(topElem)
  const render = (c) => root.render(c)
  let status = ''
  const ctx = new coreUtils.Ctx().setVars({react: reactUtils, path})
  const {loadingView} = dsls.react['react-comp']
  const onStatus = (status) => render(hh(ctx, loadingView, {status}))
  
  render(hh(ctx, loadingView, {status}))

  let top, error
  try {
    top = await coreUtils.runProbeCli(path, { entryPointPaths: fullFilePath }, onStatus)
  } catch (e) { error = e.stack }
  error = error || top.error || top.probeRes?.error 
  error = error?.stderr || error

  const { probeRes, cmd: _cmd, projectDir } = top
      
  const _firstRes = probeRes?.result?.[0]?.in?.data
  let firstResInput = _firstRes
  try {
    firstResInput = typeof _firstRes == 'string' && _firstRes.trim().match(/^\[{/) ? JSON.parse(_firstRes) : _firstRes
  } catch(e) {}
  
  const cmd = [`cd ${projectDir}`, _cmd].join('\n')
  const success = probeRes?.circuitRes?.success
  const visits = probeRes?.visits?.[probeRes?.probePath] || 0
  const totalTime = probeRes?.totalTime
  const logsCount = probeRes?.logs?.length || 0
  const titleShort = (probeRes?.circuitCmpId || '').split('>').pop() || ''
  const probePath = probeRes?.probePath
  
  const viewCtx = ctx.setVars({top, error, path, filePath, probeRes, firstResInput, cmd, success, visits, totalTime, logsCount, titleShort, probePath})
  const allViews = coreUtils.globalsOfTypeIds(dsls.react['react-comp'])
    .map(id => {
        const comp = dsls.react['react-comp'][id]
        const jbComp = comp[coreUtils.asJbComp]
        coreUtils.resolveCompArgs(jbComp)
        const metadata = jbComp.impl.metadata 
        if (!metadata) return
        const priority = metadata.find(m=>m.priority)?.priority
        const abbr = metadata.find(m=>m.abbr)?.abbr
        const matchData = metadata.find(m=>m.matchData)?.matchData
        let data
        try { data = matchData && viewCtx.run(matchData) } catch(error) { console.error(error) }
        const emptyArray = Array.isArray(data) && data.length == 0
        return ({ id, data, priority, abbr, comp, emptyArray })
    }).filter(e=>e?.data && !e.emptyArray)
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
  

  render(hh(viewCtx.setVars({allViews}), probeResultView))
}

ReactComp('loadingView', {
  impl: comp({
    hFunc: ({}, {path, react: {h}}) => ({status}) => {
      return h('div:w-full h-full flex flex-col bg-gray-50', {},
        h('div:flex items-center justify-center py-8', {},
          h('div:text-center', {},
            h('div:text-lg font-semibold mb-2', {}, status),
            h('div:text-sm text-gray-600', {}, path),
            h('div:text-xs text-gray-400 mt-2', {}, 'Please wait...'),
          )
        ),
      )
    },
    sampleCtxData: asIs({vars: {path: 'test.path~impl'}}),
    samplePropsData: asIs({status: 'Loading...'})
  })
})

ReactComp('cmdErrorView', {
  impl: comp({
    hFunc: ({}, {error, cmd, react: {h}}) => () => {
      return h('div:w-full h-96 flex items-center justify-center bg-red-50 flex-col', {},
        h('div:text-center', {},
          h('h3:text-lg font-semibold text-red-800 mb-4', {}, 'Probe Error'),
          h('div:bg-white p-4 rounded border', {},
            h('pre:text-xs text-red-700 overflow-auto', {}, typeof error === 'string' ? error : JSON.stringify(error, null, 2))
          ),
          h('button:bg-blue-600 text-white px-4 py-2 rounded mt-4', { onClick: () => window.location.reload() }, 'Retry')
        ),
        h('a:text-xs mt-2', { href: location.href }, 'Browser'),
        cmd && h('pre:bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-64 font-mono border border-gray-600 whitespace-pre-wrap mt-3', {}, `$ ${cmd}`)
      )
    },
    enrichCtx: (ctx,{ top }) => ctx.setVars({cmd: top.cmd}),
    metadata: [
        abbr('ERR'),
        matchData('%$error%'),
        priority(1)
    ],
  
    sampleCtxData: asIs({vars: {error: 'Sample error message', cmd: 'node --run test'}})
  })
})

const probeResultView = ReactComp('probeResultView', {
  impl: comp({
    hFunc: (ctx, {probeRes, probePath, success, visits, totalTime, logsCount, titleShort, allViews, react: {h, hh, useState}}) => () => {
      const [activeView, setActiveView] = useState(allViews[0]?.id || 'resultsView')

      const TabBtn = ({ id, abbr, isActive }) =>
        h('button:text-xs px-1 rounded', {
          className: (isActive ? 'bg-blue-100 ' : '') + 'text-gray-700 hover:text-gray-900',
          onClick: () => setActiveView(id)
        }, abbr)

      const headerLeft = h('div:flex items-center gap-2', {},
        success ? h('L:Check', { className: 'text-green-600' }) : h('L:X', { className: 'text-red-600' }),
        h('span:font-semibold', { className: !success ? 'text-red-800' : '' }, titleShort),
        h('span:text-gray-500', {}, `(${visits}v)`),
        totalTime != null && h('span:bg-blue-100 text-blue-700 px-1 rounded', {}, `${totalTime}ms`),
        h('span:bg-gray-100 text-gray-600 px-1 rounded', {}, `${logsCount}L`)
      )

      const headerRight = h('div:flex gap-1 items-center', {},
        ...allViews.map(v => h(TabBtn, { key: v.id, id: v.id, abbr: v.abbr, isActive: activeView === v.id })),
        h('a:text-xs px-1', { href: location.href }, h('L:RefreshCw', { className: 'w-3 h-3' }))
      )

      // Find active view component or dynamic module
      const activeComp = allViews.find(v => v.id === activeView)

      return h('div:w-full h-full flex flex-col overflow-auto bg-white border rounded shadow-sm text-xs', {},
        // Header
        h('div:sticky top-0 bg-white border-b px-3 py-2 flex items-center justify-between', {
          className: !success ? 'bg-red-50 border-red-200' : ''
        }, headerLeft, headerRight),

        h('div:text-xs text-gray-600 px-3 py-1 border-b truncate', { title: probePath }),

        // // Errors summary strip (when present)
        // (Array.isArray(probeRes?.errors) && probeRes.errors.length) && h('div:bg-red-50 border-l-2 border-red-500 px-3 py-1 text-red-700 max-h-[100px] overflow-auto', {},
        //   h('div:font-medium', {}, 'Errors'),
        //   h('pre:text-xs mb-1', {}, JSON.stringify(probeRes.errors, null, 1))
        // ),

        activeComp ? hh(ctx.setData(activeComp.data), activeComp.comp) : h('div:p-4 text-gray-400', {}, 'No view')
      )
    }
  })
})

/** ---------------- probe detail views ---------------- **/

ReactComp('resultsView', {
  impl: comp({
    hFunc: (ctx, {react: {h, hh}}) => () => {
      const result = ctx.data
      if (!result?.length)
        return h('div:text-gray-500 text-center py-4', {}, 'No results')
      return h('div:p-3 flex flex-col overflow-auto', {},
        result.map(({in: In, out}, i) => hh(ctx, codeMirrorInputOutput, { in: In, out, key: i }))
      )
    },
    sampleCtxData: jq('$sampleProbeRes | .. | .result? | { data: . }', { first: true }),
    metadata: [
      abbr('RES'),
      matchData('%$top/probeRes/result%'),
      priority(1)
    ]
  })
})

ReactComp('topView', {
  impl: comp({
    hFunc: (ctx, {react: {hh}}) => () => hh(ctx, codeMirrorJson, { json: ctx.data }),
    sampleCtxData: '%$sampleProbeRes%',
    metadata: [abbr('ALL'), matchData('%$top%'), priority(5)]
  })
})

ReactComp('testIframeView', {
  impl: comp({
    hFunc: (ctx, {react: {h}}) => () => {
      const testId = ctx.data
      const src = `/packages/testing/tests.html?test=${testId}&spy=all`
      return h('div:w-full h-full flex flex-col', {},
        h('div:flex p-1', {},
          h('a:text-gray-500 hover:text-gray-800', { href: src, target: '_blank', title: 'Open in new tab' }, 
            h('L:ExternalLink', { className: 'w-4 h-4' })
          )
        ),
        h('iframe:w-full flex-1 min-h-[500px] border-0', { src })
      )
    },
    metadata: [
      abbr('TST'),
      matchData(({},{probeRes}) => probeRes.circuitCmpId.startsWith('test<test>') && probeRes.circuitCmpId.split('~')[0]),
      priority(2)
    ]
  })
})

ReactComp('reactCompView', {
  impl: comp({
    hFunc: (ctx, {filePath, react: {h}}) => () => {
      const cmpId = ctx.data
      const src = `/jb6_packages/react/react-comp-view.html?cmpId=${encodeURIComponent(cmpId)}&filePath=${encodeURIComponent(filePath)}`
      return h('div:w-full h-full flex flex-col', {},
        h('div:flex p-1', {},
          h('a:text-gray-500 hover:text-gray-800', { href: src, target: '_blank', title: 'Open in new tab' }, 
            h('L:ExternalLink', { className: 'w-4 h-4' })
          )
        ),
        h('iframe:w-full flex-1 min-h-[500px] border-0', { src })
      )
    },
    metadata: [
      abbr('CMP'),
      matchData(({},{probeRes}) => probeRes.circuitCmpId.startsWith('react-comp<react>') && probeRes.circuitCmpId.split('>').pop().split('~')[0]),
      priority(2)
    ]
  })
})

ReactComp('cmdView', {
  impl: comp({
    hFunc: (ctx, {projectDir, react: {h}}) => () => {
      const cmd = ctx.data
      return h('div:p-3', {},
        h('div:mb-2 flex items-center justify-between', {},
          h('span:font-medium text-purple-800', {}, `cd ${projectDir}`),
          h('button:text-purple-600 hover:text-purple-800 text-xs px-2 py-1 border border-purple-300 rounded hover:bg-purple-50', {
            onClick: () => navigator.clipboard.writeText(cmd)
          }, 'Copy')
        ),
        h('pre:bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-64 font-mono border border-gray-600 whitespace-pre-wrap', {}, `$ ${cmd}`)
      )
    },
    enrichCtx: (ctx, {top}) => ctx.setVars({projectDir: top.projectDir}),
    sampleCtxData: jq('$sampleProbeRes | .. | .cmd? | { data: ., vars: {top: $sampleProbeRes}}', {
      first: true
    }),
    metadata: [
      abbr('CMD'),
      matchData('%$top/cmd%'),
      priority(6)
    ]
  })
})

ReactComp('imageView', {
  impl: comp({
    hFunc: (ctx, {react: {h}}) => () => h('img', { src: ctx.data, width: 400 }),
    metadata: [
      abbr('IMG'),
      matchData(jq('.. | .imageUrl?')),
      priority(2)
    ]
  })
})

ReactComp('errorDetailView', {
  impl: comp({
    hFunc: (ctx, {react: {h, hh}}) => () => h('div:p-3', {},
        h('div:mb-2 font-medium text-red-800', {}, 'Error:'),
        hh(ctx, codeMirrorJson, { json: ctx.data }),
    ),
    metadata: [
      abbr('ERR'),
      matchData(jq('.. | .error?')),
      priority(0)
    ]
  })
})

ReactComp('llmFlowView', {
  impl: comp({
    hFunc: (ctx, {react: {hh}}) => () => hh(ctx, codeMirrorJson, { json: ctx.data }),
    metadata: [
      abbr('FLW'),
      matchData(jq('.. | .llmFlow?')),
      priority(3)
    ]
  })
})

ReactComp('systemPromptView', {
  impl: comp({
    hFunc: (ctx, {react: {hh}}) => () => hh(ctx, codeMirrorJson, { json: ctx.data }),
    metadata: [
      abbr('SYS'),
      matchData(jq('[.. | objects | select(.role? == "system") | .content?] | join("\\n#####\\n")')),
      priority(4)
    ]
  })
})

ReactComp('userPromptView', {
  impl: comp({
    hFunc: (ctx, {react: {hh}}) => () => hh(ctx, codeMirrorJson, { json: ctx.data }),
    metadata: [
      abbr('USR'),
      matchData(jq('[.. | objects | select(.role? == "user") | .content?] | join("\\n#####\\n")')),
      priority(4)
    ]
  })
})

function summarizeRecord(record, keepPrefixSize = 1000, maxLength = 4000) {
    const text = record ? JSON.stringify(record) : ''
    if (text.length <= maxLength) return record
    const suffixSize = maxLength - keepPrefixSize
    return { __squeezed: true, summary: text.slice(0, keepPrefixSize) + 
      `====text was originally ${text.length} and was squeezed to ${maxLength} chars. ${text.length - maxLength} missing chars here====` + text.slice(text.length - suffixSize) }
}

function squeezeArray(arr,k=10){
  if(arr.length<=k*2) return arr
  const mid = arr.length - k*2
  return [...arr.slice(0,k), `${mid} items were here`, ...arr.slice(-k)]
}

function squeezeLogEntries(obj, parent, keepPrefixSize = 1000, maxLength = 2000) {
  if (typeof obj !== 'object' || obj === null) return obj
  const out = Array.isArray(obj) ? [] : {}
  for (const [key, value] of Object.entries(obj)) {
    let v = value
    if (/[lL]og/.test(parent || ''))
      v = Array.isArray(value) ? value.map(e => summarizeRecord(e, keepPrefixSize, maxLength)) : summarizeRecord(value, keepPrefixSize, maxLength)
    // else if (/room/.test(key) && Array.isArray(value))
    //   v = squeezeArray(value)
    if (typeof value === 'object' && value !== null)
      v = squeezeLogEntries(value, key, keepPrefixSize, maxLength)
    out[key] = v
  }
  return out
}

function summarizeRecord1(record) { // reuslt.in.vars.workflowDb
    const text = record?  JSON.stringify(record) : ''
    const keepPrefixSize = 1000
    const maxLength = 2000
    return {summary: (text.length > maxLength) ? [text.slice(0,keepPrefixSize),
      `====text was originally ${text.length}.and was squeezed to ${maxLength} chars. ${text.length - maxLength} missing chars here====`,
      text.slice(text.length-maxLength+keepPrefixSize)
    ].join('') : text}
}

const codeMirrorJson = ReactComp('codeMirrorJson', {
  impl: comp({
    hFunc: ({}, {react: {h, useRef, useEffect, use, codeMirrorPromise}}) => ({json}) => {
      if (coreUtils.isNode)
        return h('textarea:h-full w-full font-mono text-xs p-2 border rounded bg-gray-50', { 
          readOnly: true, 
          value: coreUtils.prettyPrint(json) 
        })

      const CodeMirror = use(codeMirrorPromise())
      const host = useRef()
      const cm = useRef()

      useEffect(() => {
        cm.current ||= CodeMirror(host.current, {
          value: coreUtils.prettyPrint(json),
          mode: 'javascript',
          readOnly: true,
          lineNumbers: true,
          foldGutter: true,
          gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        })
      }, [])

      useEffect(() => {
        cm.current && cm.current.setValue(coreUtils.prettyPrint(json))
      }, [json])

      return h('div:h-full', { ref: host })
    },
    samplePropsData: asIs({json: {hello: 'world'}})
  })
})


const codeMirrorInputOutput = ReactComp('codeMirrorInputOutput', {
  impl: comp({
    samplePropsData: '%$sampleProbeRes/probeRes/result/0%',
    hFunc: ({}, {react: {h, useRef, useEffect, use, codeMirrorPromise}}) => ({in: In, out}) => {
      const format = v => typeof v === 'object' ? coreUtils.prettyPrint(squeezeLogEntries(v)) : String(v)
      const inputData = In?.data ?? In

      if (coreUtils.isNode) {
        return h('div:flex flex-1 min-h-96 border rounded p-2 mb-2 gap-2', {},
          h('div:flex-1 flex flex-col', {},
            h('span:font-medium text-gray-600 mb-1', {}, 'Input:'),
            h('textarea:flex-1 font-mono text-xs p-2 border rounded bg-gray-50', { readOnly: true, value: format(inputData) })
          ),
          h('div:flex-1 flex flex-col', {},
            h('span:font-medium text-gray-600 mb-1', {}, 'Output:'),
            h('textarea:flex-1 font-mono text-xs p-2 border rounded bg-gray-50', { readOnly: true, value: format(out) })
          )
        )
      }

      const CodeMirror = use(codeMirrorPromise())

      const inputRef = useRef()
      const outputRef = useRef()

      useEffect(() => {
        const isHtml = v => typeof v === 'string' && /^\s*</.test(v)
        const inputMode = isHtml(inputData) ? 'xml' : 'javascript'
        const outMode = isHtml(out) ? 'xml' : 'javascript'
        if (inputRef.current && !inputRef.current.cm)
          inputRef.current.cm = CodeMirror(inputRef.current, { value: format(inputData), mode: inputMode, readOnly: true, lineNumbers: true })
        if (outputRef.current && !outputRef.current.cm)
          outputRef.current.cm = CodeMirror(outputRef.current, { value: format(out), mode: outMode, readOnly: true, lineNumbers: true })
      }, [In, out, inputData])

      return h('div:flex flex-1 min-h-96 border rounded p-2 mb-2 gap-2', {},
        h('div:flex-1 flex flex-col', {},
          h('span:font-medium text-gray-600 mb-1', {}, 'Input:'),
          h('div:flex-1', { ref: inputRef })
        ),
        h('div:flex-1 flex flex-col', {},
          h('span:font-medium text-gray-600 mb-1', {}, 'Output:'),
          h('div:flex-1', { ref: outputRef })
        )
      )
    }
  })
})

Const('sampleProbeRes', {
    probeRes: {
      circuitCmpId: 'test<test>reactTest.helloWorld',
      probePath: 'test<test>reactTest.helloWorld~impl~expectedResult',
      visits: {
        'test<test>reactTest.helloWorld~impl': 5,
        'test<test>reactTest.helloWorld~impl~expectedResult~text': 1,
        'test<test>reactTest.helloWorld~impl~expectedResult~allText': 1,
        'test<test>reactTest.helloWorld~impl~expectedResult': 2
      },
      totalTime: 25,
      result: [
        {
          from: null,
          out: true,
          in: {
            data: '<div>hello world</div>\n',
            params: null,
            vars: {singleTest: true, testID: 'test<test>reactTest', isTest: true, testSessionId: 'test-1767382961872'}
          }
        },
      ],
      circuitRes: {id: 'test<test>reactTest', success: true, testRes: '<div>hello world</div>\n', counters: {}},
      errors: [],
      logs: []
    },
    error: undefined,
    cmd: `node --inspect-brk --experimental-vm-modules --expose-gc --input-type=module  -e "\n      import { writeFile } from 'fs/promises'\n      import { jb, dsls, coreUtils } from '@jb6/core'\n      import '@jb6/testing'\n      import '@jb6/core/misc/probe.js'\n      const imports = [\"/home/shaiby/projects/jb6/packages/react/tests/react-tests.js\"]\n      try {\n        \n        await Promise.all(imports.map(f => import(f))) // .catch(e => console.error(e.stack) )\n        const result = await jb.coreUtils.runProbe(\"test<test>reactTest.helloWorld~impl~expectedResult\")\n        await coreUtils.writeServiceResult(result)\n      } catch (e) {\n        await coreUtils.writeServiceResult({error: e.stack})\n        console.error(e)\n      }\n    "`,
    projectDir: '/home/shaiby/projects/jb6/packages/react'
})
