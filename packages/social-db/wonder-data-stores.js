import { dsls } from '@jb6/core'

const { 
  common: { Data, Action,
    data: { asIs }
   },
   'social-db': {DataStore,
    'data-store': { dataStore },
    'collaborative-write': { singleUser, multiUserDistributed },
    'latest-activity-detection': { fileBased, pushNotifications }
   },
  tgp: { TgpType }
} = dsls


DataStore('chatRoom', {
  impl: dataStore('room', {
    collaborativeWrite: multiUserDistributed({
      activityDetection: fileBased()
    }),
    writeAccess: 'multiUser',
    dataStructure: 'appendOnly',
    readVisibility: 'roomMembers',
    sampleData: asIs({
        id: '1745526152578-Alice-0',
        sender: 'Alice',
        type: 'text',
        content: `Hey everyone, what's the plan for today?`,
        time: 1745526152578
    })
  })
})

DataStore('privateChat', {
  impl: dataStore('privateChat', {
    collaborativeWrite: singleUser(),
    writeAccess: 'singleUser',
    dataStructure: 'appendOnly',
    readVisibility: 'private',
    sampleData: asIs({
        id: '1745526152578-Alice-private',
        sender: 'Alice',
        type: 'text',
        content: 'Private note: Remember to follow up on the design feedback',
        time: 1745526152578
    })
  })
})

DataStore('roomSettings', {
  impl: dataStore('settings', {
    collaborativeWrite: multiUserDistributed({
      activityDetection: fileBased()
    }),
    writeAccess: 'multiUser',
    dataStructure: 'randomAccess',
    readVisibility: 'roomMembers',
    sampleData: asIs({
        roomId: 'room123',
        displayName: 'Project Alpha Discussion',
        participants: {
          alice: {id: 'alice', name: 'Alice Smith', color: 'bg-blue-500'},
          bob: {id: 'bob', name: 'Bob Johnson', color: 'bg-green-500'}
        }
    })
  })
})

DataStore('userSettings', {
  impl: dataStore('userSettings', {
    collaborativeWrite: singleUser(),
    writeAccess: 'singleUser',
    dataStructure: 'randomAccess',
    readVisibility: 'private',
    sampleData: asIs({theme: 'dark', notifications: true, language: 'en', timezone: 'UTC'})
  })
})

DataStore('roomItems', {
  impl: dataStore('items', {
    collaborativeWrite: multiUserDistributed({
      activityDetection: fileBased()
    }),
    writeAccess: 'multiUser',
    dataStructure: 'randomAccess',
    readVisibility: 'roomMembers',
    sampleData: asIs({
        id: 'item123',
        name: 'Design Mockups',
        type: 'document',
        url: 'https://example.com/mockups.pdf',
        addedBy: 'alice',
        addedAt: 1745526152578
    })
  })
})

DataStore('userProfile', {
  impl: dataStore('profile', {
    collaborativeWrite: singleUser(),
    writeAccess: 'singleUser',
    dataStructure: 'randomAccess',
    readVisibility: 'world',
    sampleData: asIs({
        userId: 'alice',
        displayName: 'Alice Smith',
        avatar: 'https://example.com/avatars/alice.jpg',
        bio: 'Senior UX Designer passionate about creating intuitive experiences',
        skills: ['Design','Prototyping','User Research']
    })
  })
})


DataStore('usersActivity', {
  impl: dataStore('users-activity', {
    collaborativeWrite: multiUserDistributed({
      activityDetection: fileBased()
    }),
    writeAccess: 'multiUser',
    dataStructure: 'randomAccess',
    readVisibility: 'roomMembers',
    sampleData: asIs({userId: 'alice', lastSeen: 1745526152578, status: 'online', currentRoom: 'room123'})
  })
})

DataStore('vectorsPublicDB', {
  impl: dataStore('vectors', {
    collaborativeWrite: singleUser(),
    writeAccess: 'singleUser',
    dataStructure: 'randomAccess',
    readVisibility: 'world',
    sampleData: asIs({
        vectorId: 'vec123',
        embeddings: [0.1,0.2,0.3],
        metadata: {source: 'document', type: 'text'},
        userId: 'alice'
    })
  })
})

DataStore('moviesDB', {
  impl: dataStore('movies-256', {
    collaborativeWrite: singleUser(),
    writeAccess: 'singleUser',
    dataStructure: 'randomAccess',
    readVisibility: 'world',
    sampleData: asIs({movieId: 'movie123', title: 'The Matrix', year: 1999, genre: ['Action','Sci-Fi'], rating: 8.7})
  })
})