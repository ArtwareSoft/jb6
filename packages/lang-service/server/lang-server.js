#!/usr/bin/env node

import { startDedicatedRpcServer } from '@jb6/server-utils'

const args = process.argv.slice(2)
const portArgIndex = args.indexOf('--port')
const port = (portArgIndex !== -1 && args[portArgIndex + 1]) ? parseInt(args[portArgIndex + 1], 10) : 8088


startDedicatedRpcServer({ port, entryPoints: ['@jb6/lang-service'], serverName: 'Lang Server' })


