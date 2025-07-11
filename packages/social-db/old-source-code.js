/*
please keep this remark!!!
all functions return promise
# CoRefine Chat API Interface

## data layer - user + shared room context:
readFile(url, defaultValue, {userId, roomId})
saveFile(url, updateAction, {initialValue, retriesLeft = 3, userId, roomId})

## 1. basic user/room services built on top of the data layer
* `createRoom(userId, displayName, itemCategory)` - Create a new chat room with specific goals - returns roomId. add it to myRooms
* `getMyRooms(userId)`
* `joinRoom(userId, roomId)` - Join an existing room. add it to myRooms
* `subscribeToUpdates(userId, roomId, callback)` - Subscribe to real-time updates

## 2. Higher level services
* `chatRoom.sendMessage(userId, roomId, message)` - Send a user message to the chat system
* `chatRoom.get(userId, roomId)` - get messages
* `chatRoom.refine(userId, roomId, updateAction)`

* `roomSettingsCT.get(userId, roomId)`
* `roomSettingsCT.refine(userId, roomId, updateAction)`

* `privateChat.get(userId, roomId)`
* `privateChat.refine(userId, roomId, updateAction)`

* `roomItems.get(userId, roomId)`
* `roomItems.refine(userId, roomId, updateAction)` - refine Action is json imutable action set, splice,

please keep this remark!!!

AI/LLM/CURSUR should never change this code!!! if need to change, please ask me first!!!
*/

import { notificationsServerBase } from './core-utils.js'
import { getMyRoomsWithLambda, joinRoomWithLambda } from './oauth2.js'
import { logger } from './core-utils.js'
const isLocalHost = location.hostname === 'localhost'
let { db, inTest } = Object.fromEntries(new URLSearchParams(location.search).entries())
db = db || isLocalHost && 'local'

const storagePrefix =  'https://storage.googleapis.com'
const wonderBucketName = 'indiviai-wonder'

function roomPath(roomId) {
  return db == 'local' ? `files/rooms/${roomId}` : `${storagePrefix}/${wonderBucketName}/${roomId}`
}

function fullUrl(CT_type, userId, roomId, fileName) {
  const _roomPath = roomPath(roomId)
  if (['userPerRoom','userGlobal'].indexOf(CT_type) != -1 && db != 'local' && !myRoomsCache)
    console.error('myRoomsCache not set', userId, CT_type)

  const userPublishPath = db == 'local' ? `files/usersPub/${userId}` : `${storagePrefix}/${wonderBucketName}/usersPub/${userId}`
  const wonderPub = db == 'local' ? `files/usersPub/wonder` : `${storagePrefix}/${wonderBucketName}/usersPub/wonder`
  const enriptedUserId = userId // todo: use wonder public key to encrypt userId
  const userPublishToWonderPath = db == 'local' ? `files/usersPub/${enriptedUserId}` : `${storagePrefix}/${wonderBucketName}/usersPub/${enriptedUserId}`
  const userPath = db == 'local' ? `files/users/${userId}` : `${storagePrefix}/${wonderBucketName}/${myRoomsCache?.private}`
  const path = CT_type == 'room' ? `${_roomPath}/${fileName}` 
    : CT_type == 'userGlobal' ? `${userPath}/${fileName}` 
    : CT_type == 'userPerRoom' ? `${userPath}/${roomId}-${fileName}` 
    : CT_type == 'userPublish' ? `${userPublishPath}/${fileName}` 
    : CT_type == 'wonderPublish' ? `${wonderPub}/${fileName}` 
    : CT_type == 'userPublishToWonder' ? `${userPublishToWonderPath}/${fileName}` 
    : console.error('unknown contentType', CT_type)
  return `${path}.json?${cacheKiller()}`
}

export class ContentType {
  constructor(fileName, { messaging, array, type = 'room', cacheMethod, mediaType = 'json'} = {}) {
    this.messaging = messaging // boolean
    this.fileName = fileName
    this.array = messaging || array
    this.type = type // room, userPerRoom, userGlobal, userPublish, userPublishToWonder, wonderPublish
    this.mediaType = mediaType // 'json', 'binary'
    this.cache = {}
    this.cacheMethod = cacheMethod // 'private', 'no_cache', 'alone_in_the_room'
      || type.indexOf('user') == 0 && 'private'
      || 'alone_in_the_room'
  }
  put(userId, roomId, initialValue, {doNotUpdateRoomActivity, doNotLog, action, data} ={} /* change to evAction, evData */ ) { // just put the content ignoring the current content
    return putFile(this.getUrl(userId, roomId), initialValue || (this.array ? [] : {}), {
      userId, roomId, doNotUpdateRoomActivity, doNotLog,
      mediaType: this.mediaType,
      event: {fileName: this.fileName, action, data}
    } )
  }
  get(userId, roomId, {doNotUpdateRoomActivity, doNotLog, action, data, useCache}={}) {
    const cache = this.cache[roomId]
    if (cache && (useCache || this.cacheMethod == 'private')) return cache
    if (cache && this.cacheMethod == 'alone_in_the_room' && isAlone() ) return cache
    return this.cache[roomId] = readFile(this.getUrl(userId, roomId), this.array ? [] : {}, {
      userId, roomId, doNotUpdateRoomActivity, doNotLog,
      mediaType: this.mediaType,
      event: {fileName: this.fileName, action, data}
    })
  }
  refine(userId, roomId, updateAction, {action, data} = {}) {
    return this.cache[roomId] = refineFile(this.getUrl(userId, roomId), updateAction, {
      userId, roomId, 
      initialValue: this.array ? [] : {},
      mediaType: this.mediaType,
      event: {fileName: this.fileName, action, data}
    })
  }
  sendMessage(userId, roomId, message) {
    if (!this.messaging)
      return console.error('must be messaging content type', this.fileName)
    return sendMessage(userId, roomId, message, { contentType: this })
  }

  getUrl(userId, roomId) {
    return fullUrl(this.type, userId, roomId, this.fileName)
  }
}

export const chatRoom = new ContentType('room', { messaging: true })
export const roomSettingsCT = new ContentType('settings', {cacheMethod: 'no_cache'})
export const roomItems = new ContentType('items')
export const usersActivity = new ContentType('users-activity', {cacheMethod: 'no_cache'})
export const userSettings = new ContentType('userSettings', { type: 'userGlobal', cacheMethod: 'no_cache' })
export const publishedProfile = new ContentType('profile', { type: 'userPublish' , cacheMethod: 'no_cache'})
export const vectorsPublicDB = new ContentType('vectors', { type: 'userPublish', cacheMethod: 'no_cache' })
export const moviesDB = new ContentType('movies-256', { type: 'wonderPublish' })
export let usersActivityData = null

export const privateChat = new ContentType('privateChat', { messaging: true, type: 'userPerRoom' })

// ContentType implementation 

async function readFile(fullUrl, defaultValue, {userId, roomId, doNotUpdateRoomActivity, doNotLog, mediaType = 'json', event = {}}) {
  const start = Date.now()
  if (mediaType != 'json')
    throw new Error(`readFile supports only json ${fullUrl}, in case of image use geturl`)
  try {
    !doNotUpdateRoomActivity && notifyInternalActivity(userId, roomId, {fullUrl, op: 'read'})
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
}

async function putFile(fullUrl, content, {userId, roomId, doNotUpdateRoomActivity, doNotLog, event, mediaType = 'json' }) {
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
  !doNotUpdateRoomActivity && notifyInternalActivity(userId, roomId, {fullUrl, op: 'put', ...event})
  !doNotLog && logger.info({t:'putFile', duration: Date.now() - start, userId, fileName: event?.fileName, mediaType })
  return content
}

async function refineFile(fullUrl, updateAction, {userId, roomId, initialValue, retriesLeft = 3, event, mediaType = 'json' }) {
  const start = Date.now()
  if (mediaType != 'json')
    throw new Error(`refineFile supports only json ${fullUrl}`)
  if (retriesLeft == 0)
    throw new Error(`Failed to update: ${fullUrl} Max retries exceeded`)

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
  const saveResponse = await fetch(fullUrl, {
      method: 'PUT',
      headers: saveHeaders,
      body: JSON.stringify(newData,null,2)
    })
  if (!saveResponse.ok) throw new Error(`Failed to save: ${saveResponse.status}`)
  notifyInternalActivity(userId, roomId, {fullUrl, op: 'refine', ...event})
  // TODO: wait 1 sec and check that our stamp is there otherwise writeContent with 1 less retry
  logger.info({t:'refineFile', duration: Date.now() - start,fetchTime, putTime: Date.now() - fetchTime, userId, fileName: event?.fileName, isInitialValue: !response.ok })
  return content
}

function cacheKiller() { return Math.floor(Math.random() * 1000000000000) }

// -- specific chat services

export async function sendMessage(userId, roomId, message, messagingContentType = chatRoom)  {
  

  const newMessage = typeof message == 'string' ? {
    id: Math.random().toString(36).slice(2,12),
    time: Date.now(),
    sender: userId,
    type: 'text',
    content: message,
  } : message
  
  const result = await messagingContentType.refine(userId, roomId, (messages) => [...messages, newMessage], {action: 'sendMessage', data: newMessage})
  
  if (result == null) {
    console.error('failed to save message after retries', result.error)
    return null
  }
  
  return newMessage
}

const myRoomsInLocalDB = new ContentType('myRooms', {type: 'userGlobal' })

export async function createRoom(userId, displayName, {roomId = 'r' + Math.random().toString(36).slice(2, 11)} = {}) {
   // todo - add region to roomId
  displayName = displayName || 'general'
  const roomSettingsContent = { roomId, displayName, participants: {} }
  
  const results = await Promise.all([ 
    roomSettingsCT.put(userId, roomId, roomSettingsContent, {action: 'createRoom', data: roomSettingsContent}),
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

const userColors = ['bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-pink-500', 'bg-yellow-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-rose-500']

export let myRoomsCache = null
export async function getMyRooms(userId) {
  const start = Date.now()
  if (!myRoomsCache)
    myRoomsCache = db == 'local' ? await myRoomsInLocalDB.get(userId) : await getMyRoomsWithLambda(userId)
  logger.info({t:'getMyRooms', duration: Date.now() - start, userId, sessionId: globalThis.sessionId,numberOfRooms: myRoomsCache?.rooms?.length})
  return myRoomsCache
}

export async function joinRoom(userId, roomId) {
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

// ** room updates and subscription

const handlers = {}
export function subscribeToUpdates(userId, roomId, callback, {triggerNow} = {}) {
  if (!handlers[roomId]) {
    handlers[roomId] = [callback]
    listenToOthers(userId, roomId, {startListen: true})
  } else {
    handlers[roomId].push(callback)
  }
  if (triggerNow) callback({internalActivity: true})

  return function unSubscribe() {
    const index = handlers[roomId].findIndex(h=>h == callback)
    if (index != -1)
    handlers[roomId].splice(index,1)
  }
}

// ** room updates and subscription impl

let myLastActivity = Date.now()
let lastExternalActivity = inTest ? (Date.now() - 10000) : -1
const timeSinceExternalActivity = () => lastExternalActivity == -1 ? 10000000 : Date.now()- lastExternalActivity
const timeSinceMyLastActivity = () => Date.now()- myLastActivity
const timeSinceAnyActivity = () => Math.min(timeSinceMyLastActivity(), timeSinceExternalActivity())
function isAlone(timeAlone = 300000) { return timeSinceExternalActivity() > timeAlone }

function notifyExternalActivity(userId, roomId,event) {
  lastExternalActivity = Date.now()
  ;(handlers[roomId] || []).forEach(h=>h({externalActivity: true, ...event}))
}

globalThis.notifyExternalActivity = notifyExternalActivity

export function notifyInternalActivity(userId, roomId, event) {
  if (!roomId) return
  console.log(userId, 'notifyInternalActivity', formatSeconds(myLastActivity), event)
  myLastActivity = Date.now()
  if (!event?.scroll) {
    (handlers[roomId] || []).forEach(h=>h({internalActivity: true, ...event}))
  }
  updateMyActivityToOthers(userId, roomId,event)
}

let myLastNotifiedActivity = Date.now()
async function updateMyActivityToOthers(userId, roomId,event) {
  if (globalThis.testing) return
  if( event?.action == 'sendMessage') {
    const senderProfile = await publishedProfile.get(userId,roomId,{doNotUpdateRoomActivity: true, useCache: true})
    const _roomSettings = await roomSettingsCT.get(userId,roomId,{doNotUpdateRoomActivity: true, useCache: true})
    //const otherUsers = Object.keys(_roomSettings.participants || {}).filter(x=>x!=userId).join(',')
    const otherUsers = Object.keys(_roomSettings.participants || {}).join(',') // for testing
    if (!otherUsers) return
    console.log('push to subscribers',otherUsers,event.data)
    fetch(`${notificationsServerBase}/notifications/notifySubscribers?subscribers=${otherUsers}`, { // do not await
      method: 'POST',
      body: JSON.stringify({...event, senderProfile})
    })
  }
  try {
    //const debounceTreshHold = isAlone() ? 30000 : 3000
    if (myLastActivity < myLastNotifiedActivity)
        return
    await fetch(`${roomPath(roomId)}/active-${userId}.txt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: Date.now()
    })
    myLastNotifiedActivity = Date.now()
  } catch (err) {
    console.error('failed to update active.txt', err.message)
    return false
  }
}

let listenToOthersTimeout = null
function listenToOthers(userId, roomId, {startListen} = {}) {
  if (!roomId || globalThis.testing) return
  if (!startListen && timeSinceMyLastActivity() > 30 * 60000) { // 30 min idle, stop listening, we will get notification
    listenToOthersTimeout = null
    return
  }
  clearTimeout(listenToOthersTimeout)
  doListenToOthers(userId, roomId)
  const nextCheck = inTest ? 100 
    : isAlone() ? 10000 
    : timeSinceAnyActivity() > 30000 ? 3000 
    : 1000
  // console.log('timeSinceExternalActivity',timeSinceExternalActivity())
  // console.log('nextCheck',nextCheck)
  listenToOthersTimeout = setTimeout(() => listenToOthers(userId, roomId), nextCheck)
}

async function doListenToOthers(userId, roomId) {
  try {
    // check user-activity.json
    usersActivityData = await usersActivity.get(userId, roomId,{doNotUpdateRoomActivity: true, doNotLog: true})
    //console.log('get usersActivityData',usersActivityData)
    
    // Initialize usersActivityData if it doesn't exist yet
    if (!usersActivityData) {
      usersActivityData = {}
    }
    
    let latestExternalActivity = Object.entries(usersActivityData).filter(e=>e[0] != userId)
      .sort((a, b) => b[1] - a[1])[0]?.[1]
    if (lastExternalActivity == -1)
      lastExternalActivity = latestExternalActivity

    if (inTest)
      console.log(userId, 'latestExternalActivity, lastExternalActivity', formatSeconds(latestExternalActivity), formatSeconds(lastExternalActivity))
    if (latestExternalActivity > lastExternalActivity) // userActivity was updated by other participant
        return notifyExternalActivity(userId, roomId)
    const myLastActivityInUsersActivity = usersActivityData[userId]
    if (myLastActivity <= (myLastActivityInUsersActivity || 0)) return

    // build user-acitivity.json - our service for all participants
    const _roomSettings = await roomSettingsCT.get(userId,roomId,{doNotUpdateRoomActivity: true, doNotLog: true})
    const otherUsers = Object.keys(_roomSettings.participants || {}).filter(x=>x!=userId)
    const allDates = await Promise.all(otherUsers.map( async (userId) => {
      const response = await fetch(`${roomPath(roomId)}/active-${userId}.txt`, { method: 'HEAD', cache: 'no-cache' })
      return [userId, response.ok ? new Date(response.headers && response.headers.get('Last-Modified')).getTime() : 0 ]
    }))
    latestExternalActivity = allDates.sort((a, b) => b[1] - a[1])[0]?.[1]
    if (latestExternalActivity > lastExternalActivity)
      notifyExternalActivity(userId, roomId)
    usersActivityData = Object.fromEntries([...allDates,[userId, myLastActivity]])
    console.log(userId,'put usersActivity now, myLastActivity, myLastActivityInUsersActivity',formatSeconds(Date.now()), formatSeconds(myLastActivity)
      , formatSeconds(myLastActivityInUsersActivity), usersActivityData)
    await usersActivity.put(userId,roomId, usersActivityData,{doNotUpdateRoomActivity: true, doNotLog: true})
  } catch (err) {
    console.log(userId,'listenToOthers error', err)
    // Try to create the activity file if it doesn't exist
    if (err.message.includes('Cannot convert undefined or null to object')) {
      try {
        usersActivityData = { [userId]: myLastActivity }
        await usersActivity.put(userId, roomId, usersActivityData, {doNotUpdateRoomActivity: true, doNotLog: true})
        // Force a check for new messages
        notifyExternalActivity(userId, roomId)
      } catch (putErr) {
        console.error('failed to create activity file', putErr.message)
      }
    }
    return false
  }
}

function formatSeconds(dateInt) {
  return String(new Date(dateInt).getSeconds()).padStart(2, '0')
}

function fixBinaryName(path, blob) {
  const EXT = {
    'image/jpeg': 'jpg',
    'image/png' : 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  }
  
  if (!(blob instanceof Blob)) return
  const ext = EXT[blob.type] || blob.type.split('/').pop()
  if (!ext) return
  return path.replace(/\.[^./]+$/, '') + '.' + ext
}