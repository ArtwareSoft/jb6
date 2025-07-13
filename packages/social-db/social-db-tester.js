import { dsls,jb, coreUtils } from '@jb6/core'
import '@jb6/testing'
import '@jb6/social-db'

const { 
  tgp: { Const, TgpType,
    var : { Var } 
  },
  test: { Test, 
    test: { dataTest }
  },
  'social-db': { DbImpl , 
    'db-impl' : { fileBased } 
  },
  common: { Data, Action }
} = dsls

  
// ============================================================================= 
// SOCIAL-DB TESTERS
// =============================================================================

Test('socialDbSingleUser', {
  params: [
    {id: 'operations', type: 'action<common>', dynamic: true, mandatory: true},
    {id: 'query', type: 'data<common>', dynamic: true, mandatory: true},
    {id: 'expectedResult', dynamic: true, mandatory: true}
  ],
  impl: dataTest({
    vars: [
      Var('userId', 'alice'),
      Var('roomId', 'alicePrivateRoom')
    ],
    calculate: '%$query()%',
    expectedResult: '%$expectedResult()%',
    runBefore: '%$operations()',
    timeout: 5000,
    includeTestRes: true
  })
})

Action('runInParallel', {
  params: [
    {id: 'actions', type: 'action<common>[]', dynamic: true, mandatory: true}
  ]
})
const { runInParallel } = dsls.common.action

Test('socialDb2Users', {
  params: [
    {id: 'userAOperations', type: 'action<common>', dynamic: true, mandatory: true},
    {id: 'userBOperations', type: 'action<common>', dynamic: true, mandatory: true},
    {id: 'expectedResult', dynamic: true, mandatory: true}
  ],
  impl: dataTest('%$query()%', '%$expectedResult()%', {
    runBefore: runInParallel('%$userAOperations()','%$userBOperations()'),
    timeout: 3000,
    includeTestRes: true
  })
})

const UserType = TgpType('user-type','test')

UserType('userType', {
  params: [
    {id: 'title', as: 'string', mandatory: true},
    {id: 'noOfUsers', as: 'number', mandatory: true},
    {id: 'actions', type: 'action<common>', dynamic: true, mandatory: true},
    {id: 'dbDelayAvgMsec', as: 'number', mandatory: true},
    {id: 'dbDelayVariance', as: 'number', mandatory: true}
  ]
})

Test('socialDbManyUsers', {
  params: [
    {id: 'users', type: 'user-type[]', mandatory: true},
    {id: 'query', type: 'data<common>', dynamic: true, mandatory: true},
    {id: 'expectedResult', dynamic: true, mandatory: true}
  ],
  impl: dataTest('%$query()%', '%$expectedResult()%', {
    runBefore: runInParallel('%$users/runActions()'),
    timeout: 3000,
    includeTestRes: true
  })
})
