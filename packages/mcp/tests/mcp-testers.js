import { dsls, ns, coreUtils } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/calc-import-map.js'
import '@jb6/testing'
import '@jb6/mcp'
const { runBashScript, calcRepoRoot } = coreUtils

const { 
  tgp: { TgpType },
  test: { Test, 
    test: { dataTest }
  }, 
  common: { Data }
} = dsls

Test('mcpToolTest', {
    params: [
      {id: 'tool', as: 'string' },
      {id: 'args', as: 'object'},
      {id: 'expectedResult', type: 'boolean', dynamic: true},
    ],
    impl: dataTest({
        calculate: async (ctx,{},{tool,args}) => { 
            const repoRoot = await calcRepoRoot()

            const req  = {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":tool,arguments: args}}
            const script = `echo '${JSON.stringify(req)}' | node ${repoRoot}/packages/mcp/index.js --start`
            const res = await runBashScript(script)
            return res
        },
        expectedResult: '%$expectedResult()%',
        timeout: 2000,
        includeTestRes: true
      })
})
