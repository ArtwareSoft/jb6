import { dsls, jb } from '@jb6/core'
import './multi-user.js'

const { 
  common: { Data, Action },
  tgp: { TgpType },
} = dsls

const DataStore = TgpType('data-store', 'social-db')
const DbImpl = TgpType('db-impl', 'social-db')
const DataStoreFeature = TgpType('data-store-feature', 'social-db')

const byContext = DbImpl.forward('byContext')
const inMemoryTesting = DbImpl.forward('inMemoryTesting')
const fileBased = DbImpl.forward('fileBased')

jb.socialDbCache = {
  myRoomsCache: {}
}

jb.socialDbUtils = {
  computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, readVisibility}) {
    // Handle both cloud and local storage
    const isLocal = !bucketName || bucketName === ''
    if (['userOnly','roomUserOnly'].includes(readVisibility) && !jb.socialDbCache.myRoomsCache.private) {
      const error = `myRoomsCache not set ${fileName} ${readVisibility}`
      logger.error({t:'computeUrl', error })
      throw new Error(error)
    }  
    
    const privateUserId = jb.socialDbCache.myRoomsCache.private // only the user knows it
    const userIdToShareWithFriends = userId // people that share room with the users can get this id
    const userIdToShareOnlyWithWonder = jb.socialDbCache.myRoomsCache.privateWithSystem || userId // Only the system can get this id

    const roomPath = isLocal ? `${storagePrefix}/rooms/${roomId}` : `${storagePrefix}/${bucketName}/${roomId}`
    const privateUserPath = isLocal ? `${storagePrefix}/users/${userId}` : `${storagePrefix}/${bucketName}/${privateUserId}`
    const privateWithSystem = isLocal ? `${storagePrefix}/usersPub/${userId}` : `${storagePrefix}/${bucketName}/usersPub/${userIdToShareOnlyWithWonder}`
    const wonderPub = isLocal ? `${storagePrefix}/usersPub/wonder` : `${storagePrefix}/${bucketName}/usersPub/wonder`
    const userPublishToFriendsPath = isLocal ? `${storagePrefix}/usersPub/${userIdToShareWithFriends}` : `${storagePrefix}/${bucketName}/usersPub/${userIdToShareWithFriends}`
    
    const path = 
      readVisibility == 'userOnly' ? `${privateUserPath}/${fileName}` : 
      readVisibility == 'roomUserOnly' ? `${privateUserPath}/${roomId}-${fileName}` : 
      readVisibility == 'roomReadOnly' ? `${roomPath}/${userId}-${fileName}` : 
      readVisibility == 'collaborative' ? `${roomPath}/${fileName}` :
      readVisibility == 'friends' ? `${userPublishToFriendsPath}/${fileName}` : 
      readVisibility == 'systemAccessible' ? `${privateWithSystem}/${fileName}` :
      readVisibility == 'publicGlobal' ? `${wonderPub}/${fileName}` : // just a single file in the whole system
      ''
    if (!path) {
      const error = `computeUrl. no path for readVisibility: ${readVisibility}, fileName: ${fileName}`
      logger.error({t:'computeUrl', error })
      throw new Error(error)
    }

    return `${path}.json?${Math.floor(Math.random() * 1000000000000)}` // cache killer
  }
}

DataStore('dataStore', {
  params: [
    {id: 'fileName', as: 'string', mandatory: true},
    {id: 'sharing', type: 'sharing', mandatory: true },
    {id: 'dataStructure', as: 'string', options: 'array,keyValue', mandatory: true, defaultValue: 'keyValue'},
    {id: 'dbImpl', type: 'db-impl', defaultValue: byContext()},
    {id: 'features', type: 'data-store-feature[]' },
  ],
  impl: (ctx, dataStoreArgs) => {
    const dbImplInstance = dataStoreArgs.dbImpl.init(dataStoreArgs)
    const sharing = dataStoreArgs.sharing
    const props = (dataStoreArgs.features || []).reduce((acc,feature) => ({...acc, ...feature}) , {})
    
    return {
      get(...args) { return dbImplInstance.get(...args) },
      put(...args) { return dbImplInstance.put(...args) },
      refine(...args) { return dbImplInstance.refine(...args) },
      appendItem(...args) { return dbImplInstance.appendItem(...args) },
      sendMessage(...args) { return dbImplInstance.appendItem(...args) }, // sendMessage = appendItem
      
      subscribeToUpdates: sharing.subscribeToUpdates,
      notifyInternalActivity: sharing.notifyInternalActivity,
      mediaType: props.binary ? 'binary' : 'json'
    }
  }
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
        const {fileName, sharing, readVisibility, mediaType, dataStructure} = dataStoreArgs
        const { computeUrl, readFile, writeFile, refineFile } = jb.socialDbUtils        
        this.cache = {}
               
        return {
          get: async (userId, roomId, options = {}) => {
            const cacheKey = `${userId}-${roomId}`
            const cached = this.cache[cacheKey]            
            if (cached && (options.useCache || sharing.singleWriter || sharing.isAlone()))
              return cached
            
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, sharing, readVisibility})
            const defaultValue = dataStructure === 'array' ? [] : {}
            const freshData = await readFile(url, defaultValue, {...options, sharing, cache: cached, mediaType})
            
            return this.cache[cacheKey] = sharing.mergeReadWithCache ? sharing.mergeReadWithCache(freshData, cached) : freshData
          },
          
          put: async (userId, roomId, content, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, sharing, readVisibility})
            const initialValue = content || (dataStructure === 'array' ? [] : {})
            const result = await writeFile(url, initialValue, {...options, userId, roomId, sharing, mediaType})            
            return this.cache[`${userId}-${roomId}`] = result
          },
          
          refine: async (userId, roomId, updateAction, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, sharing, readVisibility})
            const initialValue = dataStructure === 'array' ? [] : {}
            const result = await refineFile(url, updateAction, initialValue, { ...options,  userId,  roomId, fileName, sharing, dataStoreArgs })
            return this.cache[`${userId}-${roomId}`] = result
          },
          
          appendItem: async (userId, roomId, item, options = {}) => {
            const url = computeUrl(userId, roomId, {bucketName, storagePrefix, fileName, sharing, readVisibility})
            const newItem = typeof item === 'string' ? { time: Date.now(), sender: userId, type: 'text', content: item } : item
            newItem.id = newItem.id || `${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`
                        
            const result = await refineFile(url, (items) => [...items, newItem], [], { ...options,  userId, roomId, fileName, sharing, dataStoreArgs })
                        
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
        const isLocalHost = typeof location !== 'undefined' && location.hostname === 'localhost'
        let { db, inTest } = typeof location !== 'undefined' ? Object.fromEntries(new URLSearchParams(location.search).entries()) : {}
        inTest = inTest || ctx.vars.testID
        
        const selectedImpl = inTest ? testImpl : isLocalHost && db == 'local' ? dev : prod
        return selectedImpl.init(dataStoreArgs)
      }
    }
  }
})

Object.assign(jb.socialDbUtils, { 
  async readFile(fullUrl, defaultValue, {userId, roomId, doNotUpdateRoomActivity, doNotLog, mediaType = 'json',sharing, event = {}}) {
    const start = Date.now()
    if (mediaType != 'json')
      throw new Error(`readFile supports only json ${fullUrl}, in case of image use geturl`)
    try {
      !doNotUpdateRoomActivity && sharing.notifyInternalActivity(userId, roomId, {fullUrl, op: 'read'})
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
  
  async writeFile(fullUrl, content, {userId, roomId, doNotUpdateRoomActivity, doNotLog, event, mediaType = 'json', sharing }) {
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
    !doNotUpdateRoomActivity && sharing.notifyInternalActivity(userId, roomId, {fullUrl, op: 'put', ...event})
    !doNotLog && logger.info({t:'putFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
    return content
  },
  
  async refineFile(fullUrl, updateAction, {userId, roomId, initialValue, event, mediaType = 'json', sharing }) {
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
      sharing.notifyInternalActivity(userId, roomId, {fullUrl, op: 'refine', ...event})
    
    logger.info({t:'refineFile', duration: Date.now() - start,fetchTime, putTime: Date.now() - fetchTime, userId, fileName: event?.fileName, isInitialValue: !response.ok })
    return content
  }
})

// =============================================================================
// DATA OPERATIONS - Read operations using common DSL Data type
// =============================================================================

Data('get', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
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
Action('dataStore.put', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
    {id: 'content', mandatory: true},
    {id: 'doNotUpdateRoomActivity', as: 'boolean'},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, userId, roomId, content, doNotUpdateRoomActivity, eventAction: action, eventData: data}) => 
        dataStore.put(userId, roomId, content, {doNotUpdateRoomActivity, action, data})
})

Action('dataStore.refine', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
    {id: 'updateAction', mandatory: true, description: 'Function with existing value in %%'},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, userId, roomId, updateAction, eventAction: action, eventData: data}) => 
        dataStore.refine(userId, roomId, updateAction, {action, data})
})

Action('dataStore.append', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
    {id: 'toAppend', mandatory: true}
  ],
  impl: (ctx, {dataStore, userId, roomId, toAppend: item}) => dataStore.appendItem(userId, roomId, item)
})

Action('dataStore.sendMessage', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
    {id: 'message', mandatory: true}
  ],
  impl: (ctx, {dataStore, userId, roomId, message}) => dataStore.appendItem(userId, roomId, message)
})

Action('dataStore.subscribeToUpdates', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'callback', type: 'function', mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
  ],
  impl: (ctx, {dataStore, userId, roomId, callback}) => 
        dataStore.subscribeToUpdates(userId, roomId, callback)
})

Action('dataStore.notifyActivity', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'event', as: 'object', defaultValue: {}, mandatory: true},
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'},
  ],
  impl: (ctx, {dataStore, userId, roomId, event}) => {
    if (dataStore.notifyInternalActivity)
      return dataStore.notifyInternalActivity(userId, roomId, event)
  }
})

