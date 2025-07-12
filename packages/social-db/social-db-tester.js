import { dsls,jb, coreUtils } from '@jb6/core'
import '@jb6/testing'
import '@jb6/social-db'

const { 
  tgp: { TgpType },
  test: { Test, 
    test: { dataTest }
  },
  'social-db': { DbImpl },
  common: { Data, Action }
} = dsls


// In-Memory Testing Implementation using mock fetch approach
DbImpl('inMemoryTesting', {
  params: [
    {id: 'initialUrls', as: 'object', defaultValue: {}},
    {id: 'simulateLatency', as: 'number', defaultValue: 0},
    {id: 'simulateErrors', as: 'boolean', defaultValue: false}
  ],
  impl: (ctx, {initialUrls, simulateLatency, simulateErrors}) => {
    return {
      init(dataStoreArgs) {
        const {fileName, writeAccess, readVisibility, dataStructure} = dataStoreArgs
        const urlStore = {...initialUrls} // Clone initial data
        
        // Create mock versions of the utils that use urlStore instead of real fetch
        const mockUtils = {
          computeUrl: jb.socialDbUtils.computeUrl, // Use real URL computation
          
          async readFile(url, defaultValue, options = {}) {
            if (simulateLatency) await sleep(simulateLatency)
            if (simulateErrors && Math.random() < 0.1) throw new Error('Simulated read error')
            const data = urlStore[url]
            return data?.content || defaultValue
          },
          
          async writeFile(url, content, options = {}) {
            if (simulateLatency) await sleep(simulateLatency)
            if (simulateErrors && Math.random() < 0.1) throw new Error('Simulated write error')
            urlStore[url] = {content, stamps: []}
            return content
          },
          
          async refineFile(url, updateAction, initialValue, options = {}) {
            if (simulateLatency) await sleep(simulateLatency)
            if (simulateErrors && Math.random() < 0.1) throw new Error('Simulated refine error')
            
            const data = urlStore[url] || {content: initialValue, stamps: []}
            const newContent = updateAction(Array.isArray(data.content) ? data.content.filter(Boolean) : data.content)
            const stamp = `${options.userId || 'system'}:${Date.now()}`
            const someTimeAgo = Date.now() - 10000
            urlStore[url] = {
              content: newContent,
              stamps: [...data.stamps, stamp].filter(s => +s.split(':').pop() > someTimeAgo)
            }
            return newContent
          }
        }
        
        // Use same fileBased logic but with mock utils
        const {computeUrl, readFile, writeFile, refineFile} = mockUtils
        this.cache = {}
        this.urlStore = urlStore // Expose for testing inspection
        
        return {
          get: async (userId, roomId, options = {}) => {
            const cacheKey = `${userId}-${roomId}`
            const cached = this.cache[cacheKey]
            
            // Use cache if: explicit request, single user, or alone in multiUser room
            if (cached && (options.useCache || writeAccess === 'singleUser' || await this.isAlone(userId, roomId))) {
              return cached
            }
            
            const url = computeUrl(userId, roomId, {bucketName: 'memory', storagePrefix: 'memory://test', fileName, writeAccess, readVisibility})
            const defaultValue = dataStructure === 'appendOnly' ? [] : {}
            return this.cache[cacheKey] = await readFile(url, defaultValue, options)
          },
          
          put: async (userId, roomId, content, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName: 'memory', storagePrefix: 'memory://test', fileName, writeAccess, readVisibility})
            const initialValue = content || (dataStructure === 'appendOnly' ? [] : {})
            return this.cache[`${userId}-${roomId}`] = await writeFile(url, initialValue, options)
          },
          
          refine: async (userId, roomId, updateAction, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName: 'memory', storagePrefix: 'memory://test', fileName, writeAccess, readVisibility})
            const initialValue = dataStructure === 'appendOnly' ? [] : {}
            return this.cache[`${userId}-${roomId}`] = await refineFile(url, updateAction, initialValue, {...options, userId})
          },
          
          appendItem: async (userId, roomId, item, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName: 'memory', storagePrefix: 'memory://test', fileName, writeAccess, readVisibility})
            const newItem = typeof item === 'string' ? {
              id: Math.random().toString(36).slice(2, 12),
              time: Date.now(),
              sender: userId,
              type: 'text',
              content: item,
            } : item
            
            return this.cache[`${userId}-${roomId}`] = await refineFile(url, (items) => [...items, newItem], [], {...options, userId})
          },
          
          isAlone: async (userId, roomId) => {
            // For tests, assume always alone unless specifically configured
            return true
          },
          
          // Testing utilities
          getUrlStore: () => urlStore,
          clearCache: () => { this.cache = {} },
          getCache: () => this.cache
        }
      }
    }
  }
})

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
      Var('userId', 'alicePrivateRoom')
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
