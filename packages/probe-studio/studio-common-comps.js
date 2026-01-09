import { dsls, coreUtils } from '@jb6/core'
import '@jb6/probe-studio/probe-studio-dsl.js'
import '@jb6/jq'

const { 
  tgp: { Const},
  common: {
    data: { jq, asIs }, 
  },
  react: { ReactComp, ReactMetadata,
    'react-comp': { comp, codeMirrorJson },
    'react-metadata' : { abbr, matchData, priority}
  }
} = dsls

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
    hFunc: (ctx, {urlsToLoad, react: {h}}) => () => {
      const cmpId = ctx.data
      const src = `/jb6_packages/react/react-comp-view.html?cmpId=${encodeURIComponent(cmpId)}&urlsToLoad=${encodeURIComponent(urlsToLoad)}`
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
      matchData(jq('$top | .. | .imageUrl?', { first: true })),
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
      matchData(jq('$top | .. | .error?')),
      priority(0)
    ]
  })
})

  