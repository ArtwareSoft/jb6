import { dsls, ns, coreUtils } from '@jb6/core'
import { MockMcpHost } from './mcp-testers.js'
import { renderReactCompToHtml } from '@jb6/mcp/mcp-utils.js'

const {
  tgp: { Const},
  test: { Test,
    test: { dataTest, mcpToolTest, mcpHttpTest, mcpUiResourceTest, mcpReactTest }
  },
  common: { Data, Action, Boolean,
    data: { pipe, pipeline, asIs, tgpModel, keys, join, filter, playwrightHarvest },
    boolean: { equals, contains, notContains, and, not },
    prop: { prop },
  },
  mcp: { tool: { formatAndValidateTgpComp, safeEditTgpComp } },
  react: { ReactComp, 'react-comp': { comp }, 'react-metadata': { mcpUi } }
} = dsls
const { json } = ns

Test('mcpTest.scrambleText', {
  HeavyTest: true,
  impl: mcpHttpTest('scrambleText', asIs({texts: 'hello world##test text'}), {
    expectedResult: equals('=QGby92dg8GbsVGa##\n0hXZ0BCdzVGd')
  })
})

// Test('mcpTest.compileTailwindCSS', {
//   HeavyTest: true,
//   impl: mcpToolTest('compileTailwindCSS', asIs({html: '<div class="p-6"></div>'}), {
//     expectedResult: contains('padding: calc(var(--spacing) * 6')
//   })
// })

// Test('mcpTest.compileTailwindCSSChart', {
//   HeavyTest: true,
//   impl: mcpToolTest('compileTailwindCSS', asIs({html: `<div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
//   <h2 class="text-2xl font-bold text-center mb-6">TITLE HERE</h2>
//   <div class="space-y-4">
//     <!-- Bars go here -->
//   </div>
// </div>`}), {
//     expectedResult: contains('padding: calc(var(--spacing) * 6')
//   })
// })

Test('wonderMcpTest.wonderWorkflow', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: mcpToolTest('wonderWorkflow', asIs({userMessage: 'say hello'}), {
    repoRoot: '/home/shaiby/projects/wonder',
    jb6PackagesRoot: '/home/shaiby/projects/wonder/jb6',
    importMapsInCli: './public/core/nodejs-importmap.js',
    expectedResult: contains('ello')
  })
})

Test('wonderMcpTest.snippet', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: mcpToolTest({
    tool: 'runTgpSnippet',
    args: asIs({
        profileText: `{$: 'data<common>pipeline', source: {$: 'data<common>asIs',
          val: [{name: 'Homer'}, {name: 'Bart'}]}, operators: ['%name%', {$: 'data<common>join', separator: ','}]}`
    }),
    mcpUrl: 'http://localhost:3000/mcp',
    expectedResult: contains('Homer')
  })
})

Test('mcpTest.snippet', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runTgpSnippet',
    args: asIs({
        profileText: `{$: 'data<common>pipeline', source: {$: 'data<common>asIs',
          val: [{name: 'Homer'}, {name: 'Bart'}]}, operators: ['%name%', {$: 'data<common>join', separator: ','}]}`
    }),
    expectedResult: contains('Homer')
  })
})

Test('mcpTest.probe', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runProbe',
    args: asIs({ probePath: 'test<test>coreTest.HelloWorld~impl~calculate~operators~0' }),
    expectedResult: contains('hello world')
  })
})

Test('mcpTest.snippetWithLogger', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runTgpSnippet',
    args: asIs({
        profileText: `{$: 'data<common>pipeline', source: [1,2,3], operators: [{$: 'data<common>count'}]}`,
        logger: 'langServiceLogger'
    }),
    expectedResult: contains('langServiceLog')
  })
})

Test('mcpTest.probeWithLogger', {
  HeavyTest: true,
  impl: mcpToolTest({
    tool: 'runProbe',
    args: asIs({ probePath: 'test<test>coreTest.HelloWorld~impl~calculate~operators~0', logger: 'langServiceLogger' }),
    expectedResult: contains('langServiceLog')
  })
})

Test('mcpTest.formatCompNotFound', {
  HeavyTest: true,
  impl: dataTest({
    calculate: async () => (await formatAndValidateTgpComp.$run({fullCompIds: 'test<test>notThere', logger: 'langServiceLogger'})).content[0].text,
    expectedResult: and(contains(`fullCompId 'test<test>notThere' not found`), contains('formatCompError')),
    timeout: 5000
  })
})

Test('mcpTest.formatComp', {
  HeavyTest: true,
  nodeOnly: true,
  impl: dataTest({
    calculate: async () => (await formatAndValidateTgpComp.$run({
      fullCompIds: 'test<test>mcpTest.formatCompNotFound,test<test>mcpTest.prettyPrintCompDef', logger: 'langServiceLogger'
    })).content[0].text,
    expectedResult: and(contains('mcpTest.formatCompNotFound', 'mcpTest.prettyPrintCompDef'), contains('"t": "formatComp"')),
    timeout: 5000
  })
})

Test('mcpTest.prettyPrintCompDef', {
  impl: dataTest({
    calculate: () => coreUtils.prettyPrintComp(formatAndValidateTgpComp, {tgpModel: jb}),
    expectedResult: contains(`Tool('formatAndValidateTgpComp'`)
  })
})

Test('mcpTest.safeEditRequiresLocationForCreate', {
  HeavyTest: true,
  nodeOnly: true,
  impl: dataTest({
    calculate: async () => (await safeEditTgpComp.$run({tgpPath: 'test<test>notThere', profileText: 'true'})).content[0].text,
    expectedResult: contains(`component 'test<test>notThere' not found`),
    timeout: 5000
  })
})

Test('mcpTest.playwrightHarvest', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: mcpToolTest({
    tool: 'playwrightHarvest',
    args: asIs({
        url: 'http://localhost:8083/packages/testing/tests.html?test=reactTest.buttonToClick&logger=uiLogger',
        automation: '{"$":"ui-action<react>click","buttonText":"Full comp via MCP"}',
        seedLocalStorage: 'mockAuthSeed',
        domSelector: 'body'
    }),
    timeout: 10000,
    expectedResult: and(contains('Clicked!'), contains('<button>'), notContains('harvestError'))
  })
})

Test('mcpReactTest.helloMcp', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: mcpUiResourceTest('helloMcp', contains('html'))
})

Test('mcpReactTest.helloMcp.react', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: mcpReactTest('helloMcp', ()=>({ textToShowAfter: '--hello mcp--' }))
})

ReactComp('mcpUiTest.fullScreenCard', {
  description: '400px high in fullscreen, 120px inline: renders per the mcp-display-mode event of the MCP UI page',
  impl: comp({
    hFunc: ({}, {react: {h, useState, useEffect}}) => () => {
      const [mode, setMode] = useState(globalThis.mcpDisplayMode)
      useEffect(() => {
        const onMode = ({detail}) => setMode(detail)
        addEventListener('mcp-display-mode', onMode)
        setMode(globalThis.mcpDisplayMode)
        return () => removeEventListener('mcp-display-mode', onMode)
      }, [])
      return h('div', {style: {height: mode == 'fullscreen' ? '400px' : '120px'}}, mode)
    },
    metadata: mcpUi({ fullScreen: true })
  })
})

Test('mcpUiTest.displayModeAndSize', {
  HeavyTest: true,
  doNotRunInTests: true,
  impl: dataTest({
    calculate: async (ctx, {mcpLogger}) => {
      const iframe = Object.assign(document.createElement('iframe'), { sandbox: 'allow-scripts allow-same-origin' })
      iframe.style.cssText = 'width: 800px; height: 600px'
      const host = new MockMcpHost(iframe, { hostContext: { displayMode: 'inline' } })
      const { imports } = JSON.parse(document.querySelector('script[type=importmap]').textContent)
      document.body.appendChild(iframe)
      iframe.srcdoc = renderReactCompToHtml('mcpUiTest.fullScreenCard', { imports }, [import.meta.url], { origin: location.origin })
      const wait = mSec => new Promise(resolve => setTimeout(resolve, mSec))
      const lastHeight = () => host.messages.filter(m => m.method == 'ui/notifications/size-changed').at(-1)?.params.height
      await host.waitForInit(5000)
      await wait(500)
      const modeAtStart = iframe.contentWindow.mcpDisplayMode, fullScreenHeight = lastHeight()
      host.sendHostContext({ displayMode: 'inline' })
      await wait(300)
      const result = { requestedMode: host.messages.find(m => m.method == 'ui/request-display-mode')?.params.mode, modeAtStart,
        modeAfterHostChange: iframe.contentWindow.mcpDisplayMode, fullScreenHeight, inlineHeight: lastHeight() }
      host.destroy()
      iframe.remove()
      mcpLogger?.info?.({t: 'mcpUiPage', ...result}, {}, {ctx})
      return result
    },
    expectedResult: ({data}) => data.requestedMode == 'fullscreen' && data.modeAtStart == 'fullscreen' && data.modeAfterHostChange == 'inline'
      && data.fullScreenHeight >= 400 && data.inlineHeight >= 120 && data.inlineHeight < 400,
    timeout: 10000,
    logger: 'mcpLogger'
  })
})

Test('mcpUiTest.displayModeAndSizeInChromium', {
  description: 'runs mcpUiTest.displayModeAndSize in headless Chromium, where ResizeObserver fires (a hidden browser pane renders no frames)',
  HeavyTest: true,
  nodeOnly: true,
  impl: dataTest({
    calculate: playwrightHarvest({
      url: 'http://localhost:8083/packages/testing/tests.html?modulePath=@jb6/mcp/tests/mcp-tests.js&test=mcpUiTest.displayModeAndSize&includeHeavy',
      timeout: 15000
    }),
    expectedResult: ({data}) => (page => page?.requestedMode == 'fullscreen' && page.modeAfterHostChange == 'inline'
      && page.fullScreenHeight >= 400 && page.inlineHeight >= 120 && page.inlineHeight < 400)(data.logs?.mcpLogger?.mcpLog?.find(e => e.t == 'mcpUiPage')),
    timeout: 30000
  })
})
