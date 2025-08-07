import { dsls, ns, coreUtils } from '@jb6/core'
import '@jb6/testing'
import '@jb6/common'
import '@jb6/core/misc/import-map-services.js'
const { asArray, calcRepoRoot, getStaticServeConfig, calcImportData } = coreUtils

const { 
  tgp: { TgpType, var: { Var } },
  test: { Test, 
    test: { dataTest }
  }, 
  common: { Data, 
    data: { pipe }
  }
} = dsls

const Repo = TgpType('repo','test')

const Jb6 = Repo('Jb6', {
  impl: () => calcRepoRoot()
})

const Genie = Repo('Genie', {
  impl: () => '/home/shaiby/projects/Genie'
})

Repo('mockRepo', {
  params: [
    {id: 'name', as: 'string'},
    {id: 'strcuture', as: 'object'},
  ],
  impl: (ctx,args) => createMockRepo(args)
})

Test('staticServeConfigTest', {
  params: [
    {id: 'repo', type: 'repo', defaultValue: Jb6(), byName: true},
    {id: 'transform', type: 'data', dynamic: true, defaultValue: '%%'},
    {id: 'expectedResult', type: 'boolean', dynamic: true}
  ],
  impl: dataTest(pipe('%$repo%', ({data}) => getStaticServeConfig(data), '%$transform()%'), '%$expectedResult()%', {
    includeTestRes: true
  })
})

Test('calcImportDataTest', {
  params: [
    {id: 'repo', type: 'repo', defaultValue: Jb6(), byName: true},
    {id: 'entryPointPaths', as: 'array'},
    {id: 'forDsls', as: 'string'},
    {id: 'transform', type: 'data', dynamic: true, defaultValue: '%%'},
    {id: 'expectedResult', type: 'boolean', dynamic: true}
  ],
  impl: dataTest({
    calculate: pipe(
      Var('repo', '%$repo%'),
      ({},{repo},{entryPointPaths,forDsls}) => calcImportData({entryPointPaths: entryPointPaths.map(path=>`${repo}/${path}`), forDsls }),
      '%$transform()%'
    ),
    expectedResult: '%$expectedResult()%',
    includeTestRes: true
  })
})

async function createMockRepo(args) {
  const {name, structure} = args
  if (!isNode) {
    const script = `import { coreUtils } from '@jb6/core'
import '@jb6/packages/core/tests/package-service-testers.js'
;(async()=>{
try {
  const result = await coreUtils.createMockRepo(${JSON.stringify(args)})
  process.stdout.write(JSON.stringify(result,null,2))
} catch (e) { console.error(e) }
})()`
    const res = await coreUtils.runNodeCliViaJbWebServer(script)
    return res.result
  }

  const { writeFile, mkdir } = await import('fs/promises')
  const pathModule = await import('path')
  
  await mkdir(`/tmp/${name}`, { recursive: true })
  
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = pathModule.join(path, filePath)
    const dir = pathModule.dirname(fullPath)
    await mkdir(dir, { recursive: true })
    
    const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    await writeFile(fullPath, fileContent)
  }  
}
