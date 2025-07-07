import { dsls } from '@jb6/core'
import './multi-user-distributed.js'

const { 
  common: { Data, Action },
  tgp: { TgpType },
  'social-db': {
    'collaborative-write': { singleUser, multiUserDistributed },
    'latest-activity-detection': { fileBased, pushNotifications }
  }
} = dsls

const DataStore = TgpType('data-store', 'social-db')
const DbImpl = TgpType('db-impl', 'social-db')
const CollaborativeWrite = TgpType('collaborative-write', 'social-db')

DataStore('dataStore', {
  params: [
    {id: 'fileName', as: 'string', mandatory: true},
    {id: 'collaborativeWrite', type: 'collaborative-write', defaultValue: singleUser()},
    {id: 'dataStructure', as: 'string', options: 'appendOnly,randomAccess', mandatory: true, defaultValue: 'randomAccess'},
    {id: 'readVisibility', as: 'string', options: 'private,roomMembers,publish,world', mandatory: true, defaultValue: 'private', description: 'publish means for people who know my userId, including all my rooms members'},
    {id: 'dbImpl', type: 'db-impl', defaultValue: byContext()},
    {id: 'mediaType', as: 'string', options: 'json,binary', defaultValue: 'json'},
    {id: 'validator', type: 'boolean<common>' },
    {id: 'embedder', type: 'embedder' },
    {id: 'llmGuide', type: 'doclet<doclet>' },
    {id: 'sampleData'}
  ],
  impl: (ctx, dataStoreArgs) => {
    const dbImplInstance = dataStoreArgs.dbImpl.init(dataStoreArgs)
    const collaborativeWrite = dataStoreArgs.collaborativeWrite
    
    return {
      get(...args) { return dbImplInstance.get(...args) },
      put(...args) { return dbImplInstance.put(...args) },
      refine(...args) { return dbImplInstance.refine(...args) },
      appendItem(...args) { return dbImplInstance.appendItem(...args) },
      sendMessage(...args) { return dbImplInstance.appendItem(...args) }, // sendMessage = appendItem
      
      subscribeToUpdates: collaborativeWrite.subscribeToUpdates,
      notifyInternalActivity: collaborativeWrite.notifyInternalActivity,
    }
  }
})

CollaborativeWrite('singleUser', {
  impl: () => ({singleUser: true, isAlone: () => true})
})

// File-based Implementation (works for both local and cloud storage)
DbImpl('fileBased', {
  params: [
    {id: 'bucketName', as: 'string', defaultValue: ''},
    {id: 'storagePrefix', as: 'string', mandatory: true}
  ],
  impl: (ctx, {bucketName, storagePrefix}) => {
    return {
      init(dataStoreArgs) {
        this.dataStoreArgs = dataStoreArgs
        const {fileName, collaborativeWrite, readVisibility, mediaType, dataStructure} = dataStoreArgs
        const { computeUrl, readFile, writeFile, refineFile } = jb.socialDbUtils        
        this.cache = {}
               
        return {
          get: async (userId, roomId, options = {}) => {
            const cacheKey = `${userId}-${roomId}`
            const cached = this.cache[cacheKey]            
            if (cached && (options.useCache || dataStoreArgs.collaborativeWrite?.singleUser || await collaborativeWrite.isAlone()))
              return cached
            
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, writeAccess: 'multiUser', readVisibility})
            const defaultValue = dataStructure === 'appendOnly' ? [] : {}
            const freshData = await readFile(url, defaultValue, {...options, collaborativeWrite, cache: cached})
            
            return this.cache[cacheKey] = collaborativeWrite.mergeReadWithCache ? collaborativeWrite.mergeReadWithCache(freshData, cached) : freshData
          },
          
          put: async (userId, roomId, content, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, writeAccess: 'multiUser', readVisibility})
            const initialValue = content || (dataStructure === 'appendOnly' ? [] : {})
            const result = await writeFile(url, initialValue, {...options, userId, roomId, collaborativeWrite})            
            return this.cache[`${userId}-${roomId}`] = result
          },
          
          refine: async (userId, roomId, updateAction, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, writeAccess: 'multiUser', readVisibility})
            const initialValue = dataStructure === 'appendOnly' ? [] : {}
            const result = await refineFile(url, updateAction, initialValue, { ...options,  userId,  roomId, fileName, collaborativeWrite, dataStoreArgs })
            return this.cache[`${userId}-${roomId}`] = result
          },
          
          appendItem: async (userId, roomId, item, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, writeAccess: 'multiUser', readVisibility})
            const newItem = typeof item === 'string' ? { time: Date.now(), sender: userId, type: 'text', content: item } : item
            newItem.id = newItem.id || `${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`
                        
            const stamp = `${userId}:${Date.now()}`            
            const result = await refineFile(url, (items) => [...items, newItem], [], 
              { ...options,  userId, roomId, fileName, collaborativeWrite, dataStoreArgs, stamp })
                        
            return this.cache[`${userId}-${roomId}`] = result
          }
        }
      }
    }
  }
})

DbImpl('byContext', {
  params: [
    {id: 'testImpl', type: 'db-impl', defaultValue: inMemoryTesting()},
    {id: 'dev', type: 'db-impl', defaultValue: fileBased('', 'files')},
    {id: 'prod', type: 'db-impl', defaultValue: fileBased('indiviai-wonder', 'https://storage.googleapis.com')}
  ],
  impl: (ctx, {testImpl, dev, prod}) => {
    return {
      init(dataStoreArgs) {
        this.dataStoreArgs = dataStoreArgs
        
        // Environment detection logic from old source code
        const isLocalHost = typeof location !== 'undefined' && location.hostname === 'localhost'
        let { db, inTest } = typeof location !== 'undefined' 
          ? Object.fromEntries(new URLSearchParams(location.search).entries())
          : {}
        db = db || (isLocalHost && 'local')
        
        // Context-aware selection logic
        let selectedImpl = dev
        if (inTest || ctx.environment === 'test' || globalThis.inTest) {
          selectedImpl = testImpl
        } else if (db === 'local' || ctx.environment === 'development' || isLocalHost) {
          selectedImpl = dev
        } else if (ctx.environment === 'production') {
          selectedImpl = prod
        }
        
        // Initialize the selected implementation
        return selectedImpl.init(dataStoreArgs)
      }
    }
  }
})

jb.socialDbUtils = {
  computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, writeAccess, readVisibility}) {
    // Handle both cloud and local storage
    const isLocal = !bucketName || bucketName === ''
    const roomPath = isLocal ? `${storagePrefix}/rooms/${roomId}` : `${storagePrefix}/${bucketName}/${roomId}`
    const userPath = isLocal ? `${storagePrefix}/users/${userId}` : `${storagePrefix}/${bucketName}/${userId}`
    const userPublishPath = isLocal ? `${storagePrefix}/usersPub/${userId}` : `${storagePrefix}/${bucketName}/usersPub/${userId}`
    const wonderPub = isLocal ? `${storagePrefix}/usersPub/wonder` : `${storagePrefix}/${bucketName}/usersPub/wonder`
    const encryptedUserId = userId // todo: use wonder public key to encrypt userId
    const userPublishToWonderPath = isLocal ? `${storagePrefix}/usersPub/${encryptedUserId}` : `${storagePrefix}/${bucketName}/usersPub/${encryptedUserId}`
    
    // Direct mapping using new business terminology
    let path
    if (readVisibility === 'roomMembers' && writeAccess === 'multiUser') {
      path = `${roomPath}/${fileName}` // room scope
    } else if (readVisibility === 'private' && writeAccess === 'singleUser') {
      path = `${userPath}/${fileName}` // userGlobal scope
    } else if (readVisibility === 'private' && writeAccess === 'multiUser') {
      path = `${userPath}/${roomId}-${fileName}` // userPerRoom scope
    } else if (readVisibility === 'world' && writeAccess === 'singleUser') {
      path = `${userPublishPath}/${fileName}` // userPublish scope
    } else if (readVisibility === 'world' && writeAccess === 'platform') {
      path = `${wonderPub}/${fileName}` // wonderPublish scope
    } else if (readVisibility === 'world' && writeAccess === 'encrypted') {
      path = `${userPublishToWonderPath}/${fileName}` // userPublishToWonder scope
    } else {
      path = `${roomPath}/${fileName}` // default fallback
    }
    
    return `${path}.json?${Math.floor(Math.random() * 1000000000000)}` // cache killer
  },
  
  async readFile(fullUrl, defaultValue, {userId, roomId, doNotUpdateRoomActivity, doNotLog, mediaType = 'json',collaborativeWrite, event = {}}) {
    const start = Date.now()
    if (mediaType != 'json')
      throw new Error(`readFile supports only json ${fullUrl}, in case of image use geturl`)
    try {
      !doNotUpdateRoomActivity && collaborativeWrite.notifyInternalActivity(userId, roomId, {fullUrl, op: 'read'})
      const response = await fetch(fullUrl)
      if (!response.ok) {
        return defaultValue
      }
      if (mediaType == 'binary')
        return res.blob()
      const res = await response.json()
      !doNotLog && logger.info({t:'readFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
      return res.content || defaultValue
    } catch (err) {
      !doNotLog && logger.error({t:'readFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType, error: err.message })
      return defaultValue
    }
  },
  
  async writeFile(fullUrl, content, {userId, roomId, doNotUpdateRoomActivity, doNotLog, event, mediaType = 'json', collaborativeWrite }) {
    const start = Date.now()
    let putResponse
    if (mediaType == 'binary') {
      const binaryPath = fixBinaryName(fullUrl, content)
      if (!binaryPath)
      putResponse = await fetch(binaryPath, {
        method: 'PUT',
        headers: { 'Content-Type': content.type || 'application/octet-stream' },
        body: content,
        credentials: 'omit'
      })
      !doNotLog && logger.info({t:'putFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
      return binaryPath
    } else {
      putResponse = await fetch(fullUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({content, stamps: []},null,2)
      })
    }
    if (!putResponse.ok) throw new Error(`Failed to save: ${fullUrl} ${putResponse.status}`)
    !doNotUpdateRoomActivity && collaborativeWrite.notifyInternalActivity(userId, roomId, {fullUrl, op: 'put', ...event})
    !doNotLog && logger.info({t:'putFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
    return content
  },
  
  async refineFile(fullUrl, updateAction, {userId, roomId, initialValue, event, mediaType = 'json', collaborativeWrite }) {
    const start = Date.now()
    if (mediaType != 'json')
      throw new Error(`refineFile supports only json ${fullUrl}`)
  
    const response = await fetch(fullUrl)
    const fetchTime = Date.now() - start
    if (!response.ok)
      await putFile(fullUrl, initialValue, {userId, roomId })
    const data = (!response.ok) ? {content: initialValue, stamps: []} : await response.json()
    const content = updateAction(Array.isArray(data.content) ? data.content.filter(Boolean) : data.content) //filter bool to save from from corrupted messages.
    const stamp = `${userId}:${Date.now()}`
    const someTimeAgo = Date.now() - 10000
    const newData = { content , stamps: [...data.stamps, stamp].filter(x=>+x.split(':').pop() > someTimeAgo) }
    const saveHeaders = { 'Content-Type': 'application/json'}
    const saveResponse = await fetch(fullUrl, { method: 'PUT', headers: saveHeaders, body: JSON.stringify(newData,null,2) })
    if (!saveResponse.ok) throw new Error(`Failed to save: ${saveResponse.status}`)
      collaborativeWrite.notifyInternalActivity(userId, roomId, {fullUrl, op: 'refine', ...event})
    
    logger.info({t:'refineFile', duration: Date.now() - start,fetchTime, putTime: Date.now() - fetchTime, userId, fileName: event?.fileName, isInitialValue: !response.ok })
    return content
  }
}

// =============================================================================
// DATA OPERATIONS - Read operations using common DSL Data type
// =============================================================================

Data('get', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%', mandatory: true},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%', mandatory: true},
    {id: 'doNotUpdateRoomActivity', as: 'boolean'},
    {id: 'useCache', as: 'boolean', defaultValue: false},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, userId, roomId, doNotUpdateRoomActivity, useCache, eventAction: action, eventData: data}) => 
        dataStore.get(userId, roomId, {doNotUpdateRoomActivity, useCache, action, data})
})

// =============================================================================
// ACTION OPERATIONS - Write/update operations using common DSL Action type
// =============================================================================

Action('put', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true},
    {id: 'content', mandatory: true},
    {id: 'doNotUpdateRoomActivity', as: 'boolean'},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, userId, roomId, content, doNotUpdateRoomActivity, eventAction: action, eventData: data}) => 
        dataStore.put(userId, roomId, content, {doNotUpdateRoomActivity, action, data})
})

Action('refine', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true},
    {id: 'updateAction', mandatory: true, description: 'Function with existing value in %%'},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, userId, roomId, updateAction, eventAction: action, eventData: data}) => 
        dataStore.refine(userId, roomId, updateAction, {action, data})
})

Action('append', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true},
    {id: 'toAppend', mandatory: true}
  ],
  impl: (ctx, {dataStore, userId, roomId, toAppend: item}) => dataStore.appendItem(userId, roomId, item)
})

Action('sendMessage', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true},
    {id: 'message', mandatory: true}
  ],
  impl: (ctx, {dataStore, userId, roomId, message}) => dataStore.appendItem(userId, roomId, message)
})

Action('subscribeToUpdates', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true},
    {id: 'callback', type: 'action<common>', mandatory: true},
    {id: 'triggerNow', as: 'boolean', defaultValue: false}
  ],
  impl: (ctx, {dataStore, userId, roomId, callback, triggerNow}) => {
    if (dataStore.subscribeToUpdates) {
      return dataStore.subscribeToUpdates(userId, roomId, callback, {triggerNow})
    }
    throw new Error('DataStore does not support subscriptions - use multiUserDistributed collaborativeWrite')
  }
})

Action('notifyActivity', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true},
    {id: 'event', as: 'object', defaultValue: {}}
  ],
  impl: (ctx, {dataStore, userId, roomId, event}) => {
    if (dataStore.notifyInternalActivity) {
      return dataStore.notifyInternalActivity(userId, roomId, event)
    }
    // Silent fallback for single-user data stores
    return Promise.resolve()
  }
})

Action('createRoom', {
  params: [
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'displayName', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', byName: true}
  ],
  impl: (ctx, {userId, displayName, roomId}) => createRoom(userId, displayName, {roomId})
})

Action('joinRoom', {
  params: [
    {id: 'userId', as: 'string', mandatory: true},
    {id: 'roomId', as: 'string', mandatory: true}
  ],
  impl: (ctx, {userId, roomId}) => joinRoom(userId, roomId)
})

