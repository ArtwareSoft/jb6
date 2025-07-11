import { dsls,jb, coreUtils } from '@jb6/core'

const { 
  tgp: { TgpType },
  'social-db': { DbImpl, CollaborativeWrite }
} = dsls

// Operation logging for precise recovery - tracks what each stamp was trying to accomplish
const operationLog = new Map()  // stamp -> operation details

function logOperation(stamp, operation) {
  operationLog.set(stamp, {
    stamp,
    type: operation.type,        // 'ADD_ITEM', 'UPDATE_ITEM', 'DELETE_ITEM', 'SEND_MESSAGE'
    item: operation.item,        // The item being modified
    targetId: operation.targetId, // For deletes
    timestamp: Date.now(),
    userId: stamp.split(':')[0]
  })
  
  // Clean old operations (keep last 1000 for recovery)
  if (operationLog.size > 1000) {
    const oldestStamps = Array.from(operationLog.keys()).slice(0, 100)
    oldestStamps.forEach(stamp => operationLog.delete(stamp))
  }
}

function getOperationByStamp(stamp) {
  return operationLog.get(stamp)
}

CollaborativeWrite('multiUserDistributed', {
  params: [
    {id: 'latestActivityDetection', type: 'latest-activity-detection', defaultValue: fileBased()}
  ],
  impl: (ctx, {latestActivityDetection}) => {
    
    return {
      isAlone: latestActivityDetection.isAlone,
      subscribeToUpdates: latestActivityDetection.subscribeToActivity,
      notifyInternalActivity: latestActivityDetection.notifyMyActivity,
      
      // Race condition recovery: merge fresh server data with local cache to detect lost items
      // Follows patterns from refine-race-problem-llm-guide.js
      mergeReadWithCache: (freshDataFromServer, cachedDataLocal, dataStructure) => {
        if (!cachedDataLocal || cachedDataLocal.length === 0)
          return freshDataFromServer || []
        const localKeys = dataStructure == 'appendOnly' ? Object.fromEntries(cachedDataLocal.map(x=[x.id,true])) : cachedDataLocal
        const serverKeys = dataStructure == 'appendOnly' ? freshDataFromServer.map(x=x.id) : Object.keys(freshDataFromServer)
        const missingKeys = serverKeys.filter(k=>!localKeys[k])
        if (dataStructure == 'appendOnly')
            freshDataFromServer.push(missingKeys.map(k=>cachedDataLocal.find(x=>x.id == key)))
        else
            missingKeys.map.forEach(k=>freshDataFromServer[k] = cachedDataLocal[k])
      },
      reCheckRefine: async ({stamp, url, content, dataStoreArgs}) => {
        
      }
    }
  }
})

// =============================================================================
// ACTIVITY DETECTION - Orchestrates polling + notifications
// =============================================================================

const LatestActivityDetection = TgpType('latest-activity-detection', 'social-db')

LatestActivityDetection('fileBased', {
  params: [
    {id: 'pollingStrategy', type: 'polling-strategy<social-db>', defaultValue: adaptive()},
    {id: 'notificationMechanism', type: 'notification-mechanism<social-db>', defaultValue: none()},
    {id: 'aloneTimeThreshold', as: 'number', defaultValue: 300000}, // 5 minutes to be considered alone
    {id: 'idleStopThreshold', as: 'number', defaultValue: 1800000} // 30 minutes - stop polling
  ],
  impl: (ctx, {pollingStrategy, notificationMechanism, aloneTimeThreshold, idleStopThreshold}) => {
    
    // Activity tracking state
    let myLastActivity = Date.now()
    let lastExternalActivity = globalThis.inTest ? (Date.now() - 10000) : -1
    let myLastNotifiedActivity = Date.now()
    let usersActivityData = null
    const handlers = {}
    
    // Time calculations
    const timeSinceExternalActivity = () => lastExternalActivity === -1 ? 10000000 : Date.now() - lastExternalActivity
    const timeSinceMyLastActivity = () => Date.now() - myLastActivity
    
    // Core presence detection
    const isAlone = (customThreshold) => timeSinceExternalActivity() > (customThreshold || aloneTimeThreshold)
    
    // Activity notification system
    function notifyExternalActivity(userId, roomId, event) {
      lastExternalActivity = Date.now()
      pollingStrategy.recordExternalActivity()
      
      ;(handlers[roomId] || []).forEach(h => h({
        externalActivity: true, 
        latestTimestamp: lastExternalActivity,
        pollingStats: pollingStrategy.getStats(),
        notificationStats: notificationMechanism.getStats(),
        ...event
      }))
    }
    
    // Cross-user activity broadcasting
    async function updateMyActivityToOthers(userId, roomId, event) {
      if (globalThis.testing) return
      
      // Notify others via notification mechanism
      if (event?.action === 'sendMessage') {
        await notificationMechanism.notifyOthers(userId, roomId, event)
      }
      
      // Update individual activity file
      try {
        if (myLastActivity <= myLastNotifiedActivity) return
        
        const {computeUrl} = jb.socialDbUtils
        const activityUrl = computeUrl(userId, roomId, {
          bucketName: '', storagePrefix: 'files', fileName: `active-${userId}`, 
          writeAccess: 'multiUser', readVisibility: 'roomMembers'
        }).replace('.json', '.txt')
        
        await fetch(activityUrl, {
          method: 'PUT',
          headers: {'Content-Type': 'text/plain'},
          body: Date.now().toString()
        })
        myLastNotifiedActivity = Date.now()
      } catch (err) {
        console.warn('Failed to update activity file:', err)
      }
    }
    
    // Activity monitoring implementation  
    async function doListenToOthers(userId, roomId) {
      try {
        const {computeUrl, readFile, writeFile} = jb.socialDbUtils
        
        // Get aggregated activity data
        const activityUrl = computeUrl(userId, roomId, {
          bucketName: '', storagePrefix: 'files', fileName: 'users-activity',
          writeAccess: 'multiUser', readVisibility: 'roomMembers'
        })
        usersActivityData = await readFile(activityUrl, {}, {})
        
        // Check for external activity
        let latestExternalActivity = Object.entries(usersActivityData)
          .filter(([id]) => id !== userId)
          .sort((a, b) => b[1] - a[1])[0]?.[1]
          
        if (lastExternalActivity === -1) {
          lastExternalActivity = latestExternalActivity || 0
        }
        
        if (latestExternalActivity > lastExternalActivity) {
          notifyExternalActivity(userId, roomId, {})
          return true // Activity detected
        }
        
        const myLastActivityInUsersActivity = usersActivityData[userId]
        if (myLastActivity <= (myLastActivityInUsersActivity || 0)) return false
        
        // Update aggregated activity data
        const settingsUrl = computeUrl(userId, roomId, {
          bucketName: '', storagePrefix: 'files', fileName: 'settings',
          writeAccess: 'multiUser', readVisibility: 'roomMembers'
        })
        const roomSettings = await readFile(settingsUrl, {}, {})
        const otherUsers = Object.keys(roomSettings.participants || {}).filter(x => x !== userId)
        
        // Check individual activity files
        const allDates = await Promise.all(otherUsers.map(async (otherUserId) => {
          const activityFileUrl = computeUrl(otherUserId, roomId, {
            bucketName: '', storagePrefix: 'files', fileName: `active-${otherUserId}`,
            writeAccess: 'multiUser', readVisibility: 'roomMembers'
          }).replace('.json', '.txt')
          
          try {
            const response = await fetch(activityFileUrl, {method: 'HEAD', cache: 'no-cache'})
            const lastModified = response.ok ? new Date(response.headers?.get('Last-Modified')).getTime() : 0
            return [otherUserId, lastModified]
          } catch {
            return [otherUserId, 0]
          }
        }))
        
        latestExternalActivity = allDates.sort((a, b) => b[1] - a[1])[0]?.[1]
        if (latestExternalActivity > lastExternalActivity) {
          notifyExternalActivity(userId, roomId, {})
        }
        
        // Update aggregated activity
        usersActivityData = Object.fromEntries([...allDates, [userId, myLastActivity]])
        await writeFile(activityUrl, usersActivityData, {})
        
        return false // No new activity detected
        
      } catch (err) {
        console.warn('Listen to others error:', err)
        
        // Create activity file if missing
        if (err.message?.includes('Cannot convert undefined or null to object')) {
          try {
            usersActivityData = {[userId]: myLastActivity}
            const activityUrl = computeUrl(userId, roomId, {
              bucketName: '', storagePrefix: 'files', fileName: 'users-activity',
              writeAccess: 'multiUser', readVisibility: 'roomMembers'
            })
            await jb.socialDbUtils.writeFile(activityUrl, usersActivityData, {})
            notifyExternalActivity(userId, roomId, {})
          } catch (putErr) {
            console.warn('Failed to create activity file:', putErr)
          }
        }
        return false
      }
    }
    
    // Core LatestActivityDetection interface
    return {
      // Core interface - what consumers actually need:
      getLatestExternalActivity: async (userId, roomId) => lastExternalActivity,
      
      subscribeToActivity: (userId, roomId, callback, {triggerNow} = {}) => {
        if (!handlers[roomId]) {
          handlers[roomId] = [callback]
          
          // Start intelligent polling
          pollingStrategy.startPolling(() => doListenToOthers(userId, roomId))
        } else {
          handlers[roomId].push(callback)
        }
        
        if (triggerNow) callback({
          internalActivity: true, 
          latestTimestamp: myLastActivity,
          pollingStats: pollingStrategy.getStats(),
          notificationStats: notificationMechanism.getStats()
        })
        
        return function unSubscribe() {
          const index = handlers[roomId]?.findIndex(h => h === callback)
          if (index !== -1) {
            handlers[roomId].splice(index, 1)
            
            // Stop polling if no more subscribers
            if (handlers[roomId].length === 0) {
              pollingStrategy.stopPolling()
            }
          }
        }
      },
      
      notifyMyActivity: async (userId, roomId, action) => {
        myLastActivity = Date.now()
        if (!action?.scroll) {
          (handlers[roomId] || []).forEach(h => h({
            internalActivity: true, 
            latestTimestamp: myLastActivity,
            pollingStats: pollingStrategy.getStats(),
            notificationStats: notificationMechanism.getStats(),
            ...action
          }))
        }
        updateMyActivityToOthers(userId, roomId, action)
      },
      
      // Additional utilities
      isAlone: () => isAlone(),
      timeSinceExternalActivity,
      timeSinceMyLastActivity,
      
      // Component access
      getPollingStats: () => pollingStrategy.getStats(),
      getNotificationStats: () => notificationMechanism.getStats()
    }
  }
})

LatestActivityDetection('pushNotifications', {
  params: [
    {id: 'pushServerUrl', as: 'string', mandatory: true},
    {id: 'fallbackToPolling', as: 'boolean', defaultValue: true},
    {id: 'pollingInterval', as: 'number', defaultValue: 5000} // Slower polling as backup
  ],
  impl: (ctx, {pushServerUrl, fallbackToPolling, pollingInterval}) => {
    
    let lastExternalActivity = -1
    let myLastActivity = Date.now()
    const handlers = {}
    
    // Push notification handling
    function setupPushNotifications(userId, roomId) {
      // In a real implementation, this would establish WebSocket or SSE connection
      // For now, just placeholder
      console.log(`Setting up push notifications for ${userId} in ${roomId}`)
    }
    
    return {
      getLatestExternalActivity: async (userId, roomId) => lastExternalActivity,
      subscribeToActivity: (userId, roomId, callback, {triggerNow} = {}) => {
        if (!handlers[roomId]) {
          handlers[roomId] = [callback]
          setupPushNotifications(userId, roomId)
        } else {
          handlers[roomId].push(callback)
        }
        
        if (triggerNow) callback({internalActivity: true, latestTimestamp: myLastActivity})
        
        return function unSubscribe() {
          const index = handlers[roomId]?.findIndex(h => h === callback)
          if (index !== -1) {
            handlers[roomId].splice(index, 1)
          }
        }
      },
      notifyMyActivity: async (userId, roomId, action) => {
        myLastActivity = Date.now()
        
        // Send push notification
        try {
          await fetch(`${pushServerUrl}/notify`, {
            method: 'POST',
            body: JSON.stringify({userId, roomId, action, timestamp: myLastActivity})
          })
        } catch (err) {
          console.warn('Push notification failed:', err)
        }
        
        // Notify local handlers
        (handlers[roomId] || []).forEach(h => h({internalActivity: true, latestTimestamp: myLastActivity, ...action}))
      },
      
      isAlone: () => false, // Push notifications assume always connected
      timeSinceExternalActivity: () => lastExternalActivity === -1 ? 10000000 : Date.now() - lastExternalActivity,
      timeSinceMyLastActivity: () => Date.now() - myLastActivity
    }
  }
})

// =============================================================================
// SINGLE-FILE IMPLEMENTATIONS - For comparison and specific use cases
// =============================================================================

LatestActivityDetection('singleSharedFile', {
  params: [
    {id: 'pollingStrategy', type: 'polling-strategy<social-db>', defaultValue: fixed({interval: 3000})},
    {id: 'notificationMechanism', type: 'notification-mechanism<social-db>', defaultValue: none()},
    {id: 'maxRetries', as: 'number', defaultValue: 3, description: 'Retries for conflict resolution'}
  ],
  impl: (ctx, {pollingStrategy, notificationMechanism, maxRetries}) => {
    
    let lastExternalActivity = -1
    let myLastActivity = Date.now()
    let conflictCount = 0
    const handlers = {}
    
    // Activity notification system
    function notifyExternalActivity(userId, roomId, event) {
      lastExternalActivity = Date.now()
      pollingStrategy.recordExternalActivity()
      
      ;(handlers[roomId] || []).forEach(h => h({
        externalActivity: true, 
        latestTimestamp: lastExternalActivity,
        pollingStats: pollingStrategy.getStats(),
        notificationStats: notificationMechanism.getStats(),
        conflictCount,
        ...event
      }))
    }
    
    // Smart polling function
    async function pollForActivity(userId, roomId) {
      try {
        const {computeUrl, readFile} = jb.socialDbUtils
        const activityUrl = computeUrl(userId, roomId, {
          bucketName: '', storagePrefix: 'files', fileName: 'shared-activity',
          writeAccess: 'multiUser', readVisibility: 'roomMembers'
        })
        
        const sharedActivity = await readFile(activityUrl, {}, {})
        
        // Find latest external activity
        const otherUsers = Object.keys(sharedActivity).filter(k => k !== userId && k !== 'lastUpdate' && k !== 'updateCount')
        const latestExternal = otherUsers
          .map(id => sharedActivity[id]?.timestamp || 0)
          .reduce((max, ts) => Math.max(max, ts), 0)
        
        const activityDetected = latestExternal > lastExternalActivity
        
        if (activityDetected) {
          const activeUser = otherUsers.find(id => 
            sharedActivity[id]?.timestamp === latestExternal
          )
          
          notifyExternalActivity(userId, roomId, {
            fromUser: activeUser,
            userCount: otherUsers.length + 1
          })
        }
        
        return activityDetected
        
      } catch (err) {
        console.warn('Failed to poll shared activity:', err)
        return false
      }
    }
    
    // Optimistic update without excessive retries
    async function updateSharedActivityFile(userId, roomId, action) {
      const {computeUrl, readFile, writeFile} = jb.socialDbUtils
      const activityUrl = computeUrl(userId, roomId, {
        bucketName: '', storagePrefix: 'files', fileName: 'shared-activity',
        writeAccess: 'multiUser', readVisibility: 'roomMembers'
      })
      
      try {
        const currentActivity = await readFile(activityUrl, {}, {})
        const updatedActivity = {
          ...currentActivity,
          [userId]: {
            timestamp: myLastActivity,
            action: action?.action || 'activity'
          },
          lastUpdate: Date.now(),
          updateCount: (currentActivity.updateCount || 0) + 1
        }
        
        await writeFile(activityUrl, updatedActivity, {})
        return updatedActivity
        
      } catch (err) {
        conflictCount++
        console.warn(`Conflict updating shared file for ${userId}:`, err.message)
        throw err
      }
    }
    
    return {
      getLatestExternalActivity: async (userId, roomId) => lastExternalActivity,
      
      subscribeToActivity: (userId, roomId, callback, {triggerNow} = {}) => {
        if (!handlers[roomId]) {
          handlers[roomId] = [callback]
          
          // Start intelligent polling
          pollingStrategy.startPolling(() => pollForActivity(userId, roomId))
        } else {
          handlers[roomId].push(callback)
        }
        
        if (triggerNow) callback({
          internalActivity: true, 
          latestTimestamp: myLastActivity,
          pollingStats: pollingStrategy.getStats(),
          notificationStats: notificationMechanism.getStats()
        })
        
        return function unSubscribe() {
          const index = handlers[roomId]?.findIndex(h => h === callback)
          if (index !== -1) {
            handlers[roomId].splice(index, 1)
            
            // Stop polling if no more subscribers
            if (handlers[roomId].length === 0) {
              pollingStrategy.stopPolling()
            }
          }
        }
      },
      
      notifyMyActivity: async (userId, roomId, action) => {
        myLastActivity = Date.now()
        
        // Immediate local notification (optimistic)
        if (!action?.scroll) {
          (handlers[roomId] || []).forEach(h => h({
            internalActivity: true, 
            latestTimestamp: myLastActivity,
            pollingStats: pollingStrategy.getStats(),
            notificationStats: notificationMechanism.getStats(),
            ...action
          }))
        }
        
        // Notify others via notification mechanism
        if (action?.action === 'sendMessage') {
          await notificationMechanism.notifyOthers(userId, roomId, action)
        }
        
        // Best-effort update to shared file
        try {
          await updateSharedActivityFile(userId, roomId, action)
        } catch (err) {
          // Silent failure - polling will detect eventual consistency
        }
      },
      
      // Utilities
      isAlone: () => lastExternalActivity === -1 || (Date.now() - lastExternalActivity) > 300000,
      timeSinceExternalActivity: () => lastExternalActivity === -1 ? 10000000 : Date.now() - lastExternalActivity,
      timeSinceMyLastActivity: () => Date.now() - myLastActivity,
      
      // Stats
      getPollingStats: () => pollingStrategy.getStats(),
      getNotificationStats: () => notificationMechanism.getStats(),
      getConflictStats: () => ({
        conflictCount,
        recommendation: conflictCount > 20 ? 'SWITCH_TO_FILE_BASED' : conflictCount > 10 ? 'REDUCE_USERS' : 'OK'
      })
    }
  }
})

// =============================================================================
// NOTIFICATION MECHANISMS - How to alert other users about activity
// =============================================================================

const NotificationMechanism = TgpType('notification-mechanism', 'social-db')

NotificationMechanism('none', {
  impl: () => ({
    notifyOthers: async () => {}, // No-op
    getStats: () => ({type: 'none', sent: 0, failed: 0})
  })
})

NotificationMechanism('pushNotifications', {
  params: [
    {id: 'serverUrl', as: 'string', mandatory: true},
    {id: 'timeout', as: 'number', defaultValue: 5000}
  ],
  impl: (ctx, {serverUrl, timeout}) => {
    let sentCount = 0
    let failedCount = 0
    
    return {
      notifyOthers: async (userId, roomId, event) => {
        try {
          const {computeUrl, readFile} = jb.socialDbUtils
          const settingsUrl = computeUrl(userId, roomId, {
            bucketName: '', storagePrefix: 'files', fileName: 'settings', 
            writeAccess: 'multiUser', readVisibility: 'roomMembers'
          })
          const roomSettings = await readFile(settingsUrl, {}, {})
          const otherUsers = Object.keys(roomSettings.participants || {}).filter(x => x !== userId)
          
          if (otherUsers.length === 0) return
          
          const response = await fetch(`${serverUrl}/notifications/notifySubscribers?subscribers=${otherUsers.join(',')}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({...event, senderId: userId}),
            signal: AbortSignal.timeout(timeout)
          })
          
          if (response.ok) {
            sentCount++
          } else {
            failedCount++
            console.warn('Push notification failed:', response.status)
          }
        } catch (err) {
          failedCount++
          console.warn('Push notification error:', err.message)
        }
      },
      
      getStats: () => ({
        type: 'pushNotifications',
        sent: sentCount,
        failed: failedCount,
        successRate: sentCount + failedCount > 0 ? `${(sentCount / (sentCount + failedCount) * 100).toFixed(1)}%` : '100%'
      })
    }
  }
})

NotificationMechanism('webhook', {
  params: [
    {id: 'webhookUrl', as: 'string', mandatory: true},
    {id: 'secret', as: 'string', description: 'Optional webhook secret for authentication'},
    {id: 'retries', as: 'number', defaultValue: 2}
  ],
  impl: (ctx, {webhookUrl, secret, retries}) => {
    let sentCount = 0
    let failedCount = 0
    
    return {
      notifyOthers: async (userId, roomId, event) => {
        const payload = {
          timestamp: Date.now(),
          userId,
          roomId,
          event,
          signature: secret ? generateSignature(event, secret) : undefined
        }
        
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(secret && {'X-Webhook-Signature': payload.signature})
              },
              body: JSON.stringify(payload)
            })
            
            if (response.ok) {
              sentCount++
              return
            }
          } catch (err) {
            if (attempt === retries) {
              failedCount++
              console.warn('Webhook notification failed after retries:', err.message)
            }
          }
        }
      },
      
      getStats: () => ({
        type: 'webhook',
        sent: sentCount,
        failed: failedCount,
        retryRate: retries
      })
    }
    
    function generateSignature(event, secret) {
      // Simple signature - in real implementation use HMAC
      return btoa(JSON.stringify(event) + secret).substring(0, 16)
    }
  }
})

// =============================================================================
// POLLING STRATEGIES - When and how often to check for activity
// =============================================================================

const PollingStrategy = TgpType('polling-strategy', 'social-db')

PollingStrategy('adaptive', {
  params: [
    {id: 'baseInterval', as: 'number', defaultValue: 1000, description: 'Base polling interval in ms'},
    {id: 'maxInterval', as: 'number', defaultValue: 30000, description: 'Maximum interval when room is quiet'},
    {id: 'minInterval', as: 'number', defaultValue: 200, description: 'Minimum interval during high activity'},
    {id: 'activityWindow', as: 'number', defaultValue: 300000, description: 'Time window to analyze activity (5 min)'},
    {id: 'adaptationRate', as: 'number', defaultValue: 0.1, description: 'How quickly to adapt (0.1 = gradual)'}
  ],
  impl: (ctx, {baseInterval, maxInterval, minInterval, activityWindow, adaptationRate}) => {
    
    let currentInterval = baseInterval
    let activityHistory = []
    let currentTimeout = null
    let isPolling = false
    
    // Track activity patterns
    function recordActivity(timestamp = Date.now()) {
      activityHistory.push(timestamp)
      // Keep only recent activity within window
      const cutoff = Date.now() - activityWindow
      activityHistory = activityHistory.filter(t => t > cutoff)
    }
    
    // Calculate activity rate (events per minute)
    function getActivityRate() {
      if (activityHistory.length < 2) return 0
      const timeSpan = Math.max(Date.now() - activityHistory[0], 60000) // At least 1 minute
      return (activityHistory.length / timeSpan) * 60000 // Events per minute
    }
    
    // Determine optimal polling interval based on activity
    function calculateOptimalInterval() {
      const activityRate = getActivityRate()
      
      if (activityRate === 0) {
        // No recent activity - slow down gradually
        return Math.min(currentInterval * 1.5, maxInterval)
      } else if (activityRate > 10) {
        // High activity (>10 events/min) - poll faster  
        return Math.max(minInterval, currentInterval * 0.7)
      } else if (activityRate > 2) {
        // Medium activity (2-10 events/min) - moderate polling
        return Math.max(baseInterval, currentInterval * 0.9)
      } else {
        // Low activity (1-2 events/min) - slow down slightly
        return Math.min(currentInterval * 1.2, maxInterval)
      }
    }
    
    // Adaptive interval adjustment
    function adaptInterval() {
      const optimal = calculateOptimalInterval()
      // Gradual adaptation to avoid oscillation
      currentInterval = currentInterval + (optimal - currentInterval) * adaptationRate
      return Math.round(currentInterval)
    }
    
    return {
      // Core polling interface
      startPolling: (pollFunction) => {
        if (isPolling) return
        isPolling = true
        
        const poll = async () => {
          if (!isPolling) return
          
          try {
            const activityDetected = await pollFunction()
            if (activityDetected) {
              recordActivity()
            }
          } catch (err) {
            console.warn('Polling error:', err)
          }
          
          // Adapt interval based on recent activity
          const nextInterval = adaptInterval()
          currentTimeout = setTimeout(poll, nextInterval)
        }
        
        poll() // Start immediately
      },
      
      stopPolling: () => {
        isPolling = false
        if (currentTimeout) {
          clearTimeout(currentTimeout)
          currentTimeout = null
        }
      },
      
      // Activity tracking
      recordExternalActivity: () => recordActivity(),
      
      // Diagnostics
      getStats: () => ({
        type: 'adaptive',
        currentInterval: Math.round(currentInterval),
        activityRate: getActivityRate().toFixed(2) + ' events/min',
        recentActivity: activityHistory.length,
        recommendation: getRecommendation()
      })
    }
    
    function getRecommendation() {
      const rate = getActivityRate()
      if (rate > 20) return 'VERY_ACTIVE_ROOM'
      if (rate > 5) return 'ACTIVE_ROOM' 
      if (rate > 1) return 'MODERATE_ACTIVITY'
      if (rate > 0) return 'LOW_ACTIVITY'
      return 'QUIET_ROOM'
    }
  }
})

