import { dsls, ns, coreUtils } from '@jb6/core'
import './package-service-testers.js'

const { 
  test: { Test, 
    test: { dataTest, staticServeConfigTest, fileContextTest }
  }, 
  common: { Data, Action, Boolean,
    data: { pipeline, filter, join, property, obj, delay, asIs,list }, 
    Boolean: { contains, equals },
    Prop: { prop }
  }
} = dsls
const { json } = ns

Test('packageServiceTest.jb6Monorepo', {
  impl: staticServeConfigTest({
    transform: list(
      '%environment%',
      '%staticMappings/diskPath%',
      pipeline('%importMap/imports%', property('@jb6/common'))
    ),
    expectedResult: contains('jb6-monorepo', '/home/shaiby/projects/jb6/packages', '/packages/common/index.js', {
      allText: json.stringify()
    })
  })
})

