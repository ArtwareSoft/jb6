import { dsls, jb, coreUtils, ns } from '@jb6/core'
import './multi-user.js'

const { 
  common: { Data, Action, 
    data: { }
   },
  tgp: { TgpType },
  'social-db': { 
   },

} = dsls

const { logError, log, delay } = coreUtils

const DataStore = TgpType('data-store', 'social-db')
const DbImpl = TgpType('db-impl', 'social-db')
const DataStoreFeature = TgpType('data-store-feature', 'social-db')
const MyRoomsSecrets = TgpType('my-rooms-secrets', 'social-db')

const byContext = DbImpl.forward('byContext')
const inMemoryTesting = DbImpl.forward('inMemoryTesting')

const dev = DbImpl.forward('dev')
const prod = DbImpl.forward('prod')

jb.socialDbCache = {
  testingStore: {}
}

jb.socialDbUtils = {
  async computeUrl({ctx, bucketName, storagePrefix: storagePrefixFunc, fileName, readVisibility, myRoomsSecrets}) {
    const { userId, roomId } = ctx.vars
    const isLocal = !bucketName
    const storagePrefix = storagePrefixFunc(ctx)

    const userSecretsCache = jb.socialDbCache.userSecretsCache || await getUserSecretsCache(ctx)
    const privateUserId = userSecretsCache.private // only the user knows it
    const userIdToShareWithFriends = userId // people that share room with the users can get this id
    const userIdToShareOnlyWithWonder = userSecretsCache.privateWithSystem || userId // Only the system can get this id

    const roomPath = isLocal ? `${storagePrefix}/rooms/${roomId}` : `${storagePrefix}/${bucketName}/${roomId}`
    const privateUserPath = isLocal ? `${storagePrefix}/users/${userId}` : `${storagePrefix}/${bucketName}/${privateUserId}`
    const privateWithSystem = isLocal ? `${storagePrefix}/usersPub/${userId}` : `${storagePrefix}/${bucketName}/usersPub/${userIdToShareOnlyWithWonder}`
    const wonderPub = isLocal ? `${storagePrefix}/usersPub/wonder` : `${storagePrefix}/${bucketName}/usersPub/wonder`
    const userPublishToFriendsPath = isLocal ? `${storagePrefix}/usersPub/${userIdToShareWithFriends}` : `${storagePrefix}/${bucketName}/usersPub/${userIdToShareWithFriends}`
    
    const path = 
      readVisibility == 'globalUserOnly' ? `${privateUserPath}/${fileName}` : 
      readVisibility == 'roomUserOnly' ? `${privateUserPath}/${roomId}-${fileName}` : 
      readVisibility == 'roomReadOnly' ? `${roomPath}/${userId}-${fileName}` : 
      readVisibility == 'collaborative' ? `${roomPath}/${fileName}` :
      readVisibility == 'friends' ? `${userPublishToFriendsPath}/${fileName}` : 
      readVisibility == 'systemAccessible' ? `${privateWithSystem}/${fileName}` :
      readVisibility == 'publicGlobal' ? `${wonderPub}/${fileName}` : // just a single file in the whole system
      ''
    if (!path) {
      const error = `computeUrl. no path for readVisibility: ${readVisibility}, fileName: ${fileName}`
      logError({t:'computeUrl', error })
      throw new Error(error)
    }

    return `${path}.json?${Math.floor(Math.random() * 1000000000000)}` // cache killer

    function getUserSecretsCache(ctx) {
      return jb.socialDbCache.userSecretsPromise ??= myRoomsSecrets.getMyRooms(ctx)
          .then(v => (jb.socialDbCache.userSecretsCache = v))
    }
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
    const sharing = dataStoreArgs.sharing
    const props = (dataStoreArgs.features || []).reduce((acc,feature) => ({...acc, ...feature}) , {})
    const dbImplInstance = dataStoreArgs.dbImpl.init({...dataStoreArgs, ...dataStoreArgs.sharing, ...props})
    
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

const myRoomsSecrets = MyRoomsSecrets('myRoomsSecrets', {
  params: [
    {id: 'getMyRooms', dynamic: true, byName: true},
    {id: 'joinRoom', dynamic: true}
  ]
})

const fileBased = DbImpl('fileBased', {
  params: [
    {id: 'bucketName', as: 'string', defaultValue: '', byName: true},
    {id: 'storagePrefix', as: 'string', dynamic: true, mandatory: true},
    {id: 'CRUDFunctions', defaultValue: () => jb.socialDbUtils},
    {id: 'myRoomsSecrets', type: 'my-rooms-secrets' }
  ],
  impl: (ctx, args) => ({
      init(dataStoreArgs) {
        const {fileName, sharing, mediaType, dataStructure} = dataStoreArgs
        const { readFile, writeFile, refineFile } = args.CRUDFunctions
        const { computeUrl } = jb.socialDbUtils 
               
        return {
          async get({ctx, ...options}) {
            const url = await computeUrl({ctx, ...args, ...dataStoreArgs})
            const cached = jb.socialDbCache[url]            
            if (cached && (options.useCache || sharing.singleWriter || sharing.isAlone()))
              return cached
            
            const defaultValue = dataStructure === 'array' ? [] : {}
            const freshData = await readFile(url, defaultValue, {...options, sharing, cache: cached, mediaType, ctx})
            
            return jb.socialDbCache[url] = sharing.mergeReadWithCache ? sharing.mergeReadWithCache(freshData, cached) : freshData
          },
          
          async put(content, {ctx, ...options}) {
            const url = await computeUrl({ctx,  ...args, ...dataStoreArgs})
            const initialValue = content || (dataStructure === 'array' ? [] : {})
            const result = await writeFile(url, initialValue, {...options, ctx, sharing, mediaType})            
            return jb.socialDbCache[url] = result
          },
          
          async refine(updateAction, {ctx, ...options}) {
            const url = await computeUrl({ctx,  ...args, ...dataStoreArgs})
            const initialValue = dataStructure === 'array' ? [] : {}
            const result = await refineFile(url, updateAction, initialValue, { ...options,  ctx, fileName, sharing, dataStoreArgs })
            return jb.socialDbCache[url] = result
          },
          
          async appendItem(item, {ctx, ...options}) {
            const { userId } = ctx.vars
            const url = await computeUrl({ctx, ...args, ...dataStoreArgs})
            const newItem = typeof item === 'string' ? { time: Date.now(), sender: userId, type: 'text', content: item } : item
            newItem.id = newItem.id || `${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`
                        
            const result = await refineFile(url, (items) => [...items, newItem], [], { ...options,  ctx, fileName, sharing, dataStoreArgs })
                        
            return jb.socialDbCache[url] = result
          }
        }
      }
    })
})

DbImpl('byContext', {
  params: [
    {id: 'testImpl', type: 'db-impl', defaultValue: inMemoryTesting()},
    {id: 'dev', type: 'db-impl', defaultValue: dev()},
    {id: 'prod', type: 'db-impl', defaultValue: prod() }
  ],
  impl: (ctx, {testImpl, dev, prod}) => ({
      init(dataStoreArgs) {
        this.dataStoreArgs = dataStoreArgs        
        const isLocalHost = typeof location !== 'undefined' && location.hostname === 'localhost'
        let { db, inTest } = typeof location !== 'undefined' ? Object.fromEntries(new URLSearchParams(location.search).entries()) : {}
        inTest = inTest || ctx.vars.testID
        
        const selectedImpl = inTest ? testImpl : isLocalHost && db == 'local' ? dev : prod
        return selectedImpl.init(dataStoreArgs)
      }
  })
})

Object.assign(jb.socialDbUtils, { 
  async readFile(fullUrl, defaultValue, {doNotUpdateRoomActivity, doNotLog, mediaType = 'json',sharing, event = {}, ctx}) {
    const { userId, roomId } = ctx.vars
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
      !doNotLog && log({t:'readFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
      return res.content || defaultValue
    } catch (err) {
      !doNotLog && logError({t:'readFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType, error: err.message })
      return defaultValue
    }
  },
  
  async writeFile(fullUrl, content, {doNotUpdateRoomActivity, doNotLog, event, mediaType = 'json', sharing, ctx }) {
    const { userId, roomId } = ctx.vars
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
      !doNotLog && log({t:'putFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
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
    !doNotLog && log({t:'putFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
    return content
  },
  
  async refineFile(fullUrl, updateAction, {initialValue, event, mediaType = 'json', sharing, ctx }) {
    const { userId, roomId } = ctx.vars
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
    
    log({t:'refineFile', duration: Date.now() - start,fetchTime, putTime: Date.now() - fetchTime, userId, fileName: event?.fileName, isInitialValue: !response.ok })
    return content
  },
  testingStore(ctx,url,val) {
    const { testID } = ctx.vars
    const store = jb.socialDbCache.testingStore[testID] = jb.socialDbCache.testingStore[testID] || {}
    if (val === undefined)
      return store[url]
    return store[url] = val
  }
})

// =============================================================================
// DATA OPERATIONS - Read operations using common DSL Data type
// =============================================================================

Data('socialDB.get', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'doNotUpdateRoomActivity', as: 'boolean'},
    {id: 'useCache', as: 'boolean', defaultValue: false},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, doNotUpdateRoomActivity, useCache, eventAction: action, eventData: data}) => 
    dataStore.get({doNotUpdateRoomActivity, useCache, action, data, ctx})
})

Data('socialDB.getMyRoomsWithLambda', {
  impl: (ctx) => ({ })
})

Action('socialDB.put', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'content', mandatory: true},
    {id: 'doNotUpdateRoomActivity', as: 'boolean'},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, content, doNotUpdateRoomActivity, eventAction: action, eventData: data}) => 
    dataStore.put(content, {doNotUpdateRoomActivity, action, data, ctx})
})

Action('socialDB.refine', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'updateAction', mandatory: true, description: 'Function with existing value in %%'},
    {id: 'eventAction'},
    {id: 'eventData'}
  ],
  impl: (ctx, {dataStore, updateAction, eventAction: action, eventData: data}) =>
    dataStore.refine(userId, roomId, updateAction, {action, data, ctx})
})

Action('socialDB.append', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'toAppend', mandatory: true}
  ],
  impl: (ctx, {dataStore, toAppend: item}) => dataStore.appendItem(userId, roomId, item, {ctx})
})

Action('socialDB.subscribeToUpdates', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'callback', type: 'function', mandatory: true}
  ],
  impl: (ctx, {dataStore, callback}) => dataStore.subscribeToUpdates(callback, {ctx})
})

Action('socialDB.notifyActivity', {
  params: [
    {id: 'dataStore', type: 'data-store<social-db>', mandatory: true},
    {id: 'event', as: 'object', defaultValue: {}, mandatory: true}
  ],
  impl: (ctx, {dataStore, event}) => dataStore.notifyInternalActivity(event, {ctx})
})

const {socialDB} = ns

DbImpl('inMemoryTesting', {
  params: [
    {id: 'simulateLatency', as: 'number', defaultValue: 0}
  ],
  impl: fileBased({
    bucketName: '',
    storagePrefix: 'memory:/',
    CRUDFunctions: (ctx,{},{simulateLatency,simulateErrors}) => ({
      ...jb.socialDbUtils,
      async readFile(_url, defaultValue, options = {}) {
        const url = _url.split('?')[0]
        if (simulateLatency) await delay(simulateLatency)
        const data = jb.socialDbUtils.testingStore(ctx,url)
        return data?.content || defaultValue
      },
      
      async writeFile(_url, content, options = {}) {
        const url = _url.split('?')[0]
        if (simulateLatency) await delay(simulateLatency)
        jb.socialDbUtils.testingStore(ctx,url,{content, stamps: []})
        return content
      },
      
      async refineFile(_url, updateAction, initialValue, options = {}) {
        const url = _url.split('?')[0]
        if (simulateLatency) await delay(simulateLatency)
        
        const data = jb.socialDbUtils.testingStore(ctx,url) || {content: initialValue, stamps: []}
        const newContent = updateAction(Array.isArray(data.content) ? data.content.filter(Boolean) : data.content)
        const stamp = `${options.userId || 'system'}:${Date.now()}`
        const someTimeAgo = Date.now() - 10000
        jb.socialDbUtils.testingStore(ctx,url, {
          content: newContent,
          stamps: [...data.stamps, stamp].filter(s => +s.split(':').pop() > someTimeAgo)
        })
        return newContent
      }
    }),
    myRoomsSecrets: myRoomsSecrets({
      getMyRooms: ({},{userId}) => fetch(`%$locationOrigin%/jb6_packages/social-db/.local-db/users/${userId}/myRooms.json`),
      joinRoom: ''
    })
  })
})

DbImpl('dev', {
  impl: fileBased({
    bucketName: '',
    storagePrefix: '%$locationOrigin%/jb6_packages/social-db/.local-db',
    myRoomsSecrets: myRoomsSecrets({
      getMyRooms: ({},{userId}) => fetch(`%$locationOrigin%/jb6_packages/social-db/.local-db/users/${userId}/myRooms.json`),
      joinRoom: ''
    })
  })
})

DbImpl('prod', {
  impl: fileBased({
    bucketName: 'indiviai-wonder',
    storagePrefix: 'https://storage.googleapis.com',
    myRoomsSecrets: myRoomsSecrets({
      getMyRooms: socialDB.getMyRoomsWithLambda(),
      joinRoom: socialDB.joinRoom()
    })
  })
})

// --- 

const { 
   'social-db': {
    'data-store': { dataStore },
    sharing: { globalUserOnly, roomUserOnly, friends, roomReadOnly, systemAccessible, publicGlobal, collaborative }
   },
} = dsls


const myRooms = DataStore('myRooms', {
  impl: dataStore('myRooms', globalUserOnly())
})

DataStore('chatRoom', {
  impl: dataStore('room', collaborative(), { dataStructure: 'array' })
})

DataStore('privateChat', {
  impl: dataStore('privateChat', roomUserOnly(), { dataStructure: 'array' })
})

DataStore('usersActivity', {
  impl: dataStore('users-activity', collaborative())
})

DataStore('roomSettings', {
  impl: dataStore('settings', collaborative())
})

DataStore('userSettings', {
  impl: dataStore('userSettings', globalUserOnly())
})

DataStore('userProfile', {
  impl: dataStore('profile', friends())
})

Action('socialDB.joinRoom', {
  params: [
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'roomId', as: 'string', defaultValue: '%$roomId%'}
  ],
  impl: async (ctx, {userId, roomId}) => {
    if (!roomId || roomId == 'undefined') {
      return
    }
    await Promise.all([
        roomSettingsCT.refine(userId, roomId, roomSettings => {
         roomSettings.participants = roomSettings.participants || {} // No room scenario
        const usedColors = new Set(Object.values(roomSettings.participants).map(p => p.color))
        const color = userColors.find(c => !usedColors.has(c)) || userColors[Math.floor(Math.random() * userColors.length)]
        roomSettings.participants[userId] = {
          id: userId,
          name: `User ${userId}`,
          color: color
        }
        return roomSettings
      }),
      (async () => {
        if (db == 'local') {
          myRoomsCache = await myRoomsInLocalDB.refine(userId, roomId, myRooms => 
            ({ 
              private: myRooms.private || 'pr' + Math.random().toString(36).slice(2, 11), 
              encryptedUserIdForFriends: myRooms.encryptedUserIdForFriends || 'pr' + Math.random().toString(36).slice(2, 11), 
              rooms: [...new Set([...(myRooms.rooms || []), roomId])]
            })
            , {action: 'joinRoom', data: {userId, roomId}})
        } else {
          myRoomsCache = await joinRoomWithLambda(userId, roomId)
          notifyInternalActivity(userId, roomId, {fullUrl, op: 'refine', action: 'joinRoom', data: {userId, roomId}})
        }
      })()
    ])  
  }
})

Action('socialDB.createRoom', {
  params: [
    {id: 'userId', as: 'string', defaultValue: '%$userId%'},
    {id: 'displayName', as: 'string', mandatory: true},
  ],
  impl: async (ctx, {userId, displayName}) => {
    const roomId = 'r' + Math.random().toString(36).slice(2, 11)
    displayName = displayName || 'general'
    const roomSettingsContent = { roomId, roomPublicKey: 'rpub' + Math.random().toString(36).slice(2, 11), displayName, participants: {} }
    
    const results = await Promise.all([ 
      roomSettingsDS.$run().put(userId, roomId, roomSettingsContent, {action: 'createRoom', data: roomSettingsContent}),
      chatRoom.put(userId, roomId,[]),
      roomItems.put(userId, roomId,[])
    ])
    if (results.some(x=>x == null)) {
        console.error('failed to create room file', response.status)
        throw new Error(`Failed to create room: ${response.status}`)
    }
    await joinRoom(userId, roomId) // must come after creating the room settings
  
    return roomId  
  }
})