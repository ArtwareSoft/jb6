import { dsls, ns, coreUtils } from '@jb6/core'
import '@jb6/core/misc/jb-cli.js'
import '@jb6/core/misc/import-map-services.js'
import '@jb6/testing'
import '@jb6/mcp'
const { runBashScript, calcRepoRoot, calcJb6RepoRootAndImportMapsInCli } = coreUtils

const { 
  tgp: { TgpType },
  test: { Test, 
    test: { dataTest }
  }, 
  common: { Data }
} = dsls

Test('mcpToolTest', {
  params: [
    {id: 'tool', as: 'string'},
    {id: 'args', as: 'object'},
    {id: 'repoRoot', as: 'string'},
    {id: 'jb6PackagesRoot', as: 'string'},
    {id: 'importMapsInCli', as: 'string'},
    {id: 'expectedResult', type: 'boolean', dynamic: true}
  ],
  impl: dataTest({
    calculate: async (ctx,{},{tool,args, repoRoot: repoRootParam, jb6PackagesRoot: jb6PackagesRootParam, importMapsInCli}) => { 
        const repoRoot = repoRootParam || await calcRepoRoot()
        
        const jb6PackagesRoot = jb6PackagesRootParam || `${jb.coreRegistry.repoRoot}/packages`

        const req  = {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":tool,arguments: args}}
        const reqJSON = JSON.stringify(req)
        const importPart = importMapsInCli ? `--import ${importMapsInCli}` : '' //./public/tests/register.js`
        const script = `cd ${repoRoot} && node ${importPart} ${jb6PackagesRoot}/mcp/index.js --start --repoRoot=. <<'__JSON__'
${reqJSON}
__JSON__`
        const res = await runBashScript(script)
        const mcpRes = res?.stdout?.result?.content?.[0]?.text
        let parsedMcpRes
        try {
          parsedMcpRes = /^[\s]*[{\[]/.test(mcpRes) && JSON.parse(mcpRes)
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
