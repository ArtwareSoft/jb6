import { dsls } from '@jb6/core'

const { 
  common: { Data, Action,
    data: { asIs }
   },
   'social-db': { DataStore,
    'data-store': { dataStore },
    sharing: { userOnly, roomUserOnly, friends, roomReadOnly, systemAccessible, publicGlobal, collaborative }
   },
  tgp: { TgpType }
} = dsls


DataStore('chatRoom', {
  impl: dataStore({
    fileName: 'room',
    sharing: collaborative(),
    dataStructure: 'array'
  })
})

DataStore('privateChat', {
  impl: dataStore({
    fileName: 'privateChat',
    sharing: userOnly(),
    dataStructure: 'array'
  })
})

DataStore('roomItems', {
  impl: dataStore({
    fileName: 'items',
    sharing: collaborative(),
    dataStructure: 'keyValue'
  })
})

DataStore('usersActivity', {
  impl: dataStore({
    fileName: 'users-activity',
    sharing: collaborative(),
    dataStructure: 'keyValue'
  })
})

DataStore('vectorsPublicDB', {
  impl: dataStore({
    fileName: 'vectors',
    sharing: publicGlobal(),
    dataStructure: 'keyValue'
  })
})

DataStore('moviesDB', {
  impl: dataStore({
    fileName: 'movies-256',
    sharing: publicGlobal(),
    dataStructure: 'keyValue'
  })
})

DataStore('roomSettings', {
  impl: dataStore({
    fileName: 'settings',
    sharing: collaborative(),
    dataStructure: 'keyValue'
  })
})

DataStore('userSettings', {
  impl: dataStore({
    fileName: 'userSettings',
    sharing: userOnly(),
    dataStructure: 'keyValue'
  })
})

DataStore('userProfile', {
  impl: dataStore({
    fileName: 'profile',
    sharing: friends(),
    dataStructure: 'keyValue'
  })
})


const joinRoomAction = Action('joinRoom', {
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

Action('createRoom', {
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