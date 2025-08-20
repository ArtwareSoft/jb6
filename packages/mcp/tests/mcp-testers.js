import { dsls, ns, coreUtils } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/import-map-services.js'
import '@jb6/testing'
import '@jb6/mcp'
const { runBashScript, calcRepoRoot, calcJb6RepoRoot } = coreUtils

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
      {id: 'repoRoot', as: 'string' },
      {id: 'expectedResult', type: 'boolean', dynamic: true},
    ],
    impl: dataTest({
        calculate: async (ctx,{},{tool,args, repoRoot: repoRootParam}) => { 
            const repoRoot = repoRootParam || await calcRepoRoot()
            await calcJb6RepoRoot()
            const jb6PackagesRoot = repoRootParam ? `${repoRootParam}/node_modules/@jb6` : `${jb.coreRegistry.repoRoot}/packages`

            const req  = {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":tool,arguments: args}}
            const reqJSON = JSON.stringify(req)
            const script = `cd ${repoRoot} && node ${jb6PackagesRoot}/mcp/index.js --start --repoRoot=. <<'__JSON__'
${reqJSON}
__JSON__`
            const res = await runBashScript(script)
            const mcpRes = res?.stdout?.result?.content?.[0]?.text
            let parsedMcpRes
            try {
              parsedMcpRes = JSON.parse(mcpRes)
            } catch(e) {}
            if (parsedMcpRes?.error)
              return { testFailure: parsedMcpRes?.error}
            if (!mcpRes)
              return { testFailure: 'error in mcp res'}
            return mcpRes
        },
        expectedResult: '%$expectedResult()%',
        timeout: 2000,
        includeTestRes: true
      })
})
