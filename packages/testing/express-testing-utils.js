import express from 'express'
import path from 'path'
import { readFile } from 'fs/promises'
import { coreUtils } from '@jb6/core'
import { serverUtils } from '@jb6/server-utils'
import '@jb6/server-utils/serve-mjpeg.js'
import '@jb6/server-utils/serve-mcp.js'
import '@jb6/server-utils/serve-edit-source.js'
import '@jb6/server-utils/serve-bucket.js'

const { calcRepoRoot }  = coreUtils
const { serveImportMap, serveCli, serveCliStream, serveGotoSource, serveEditSource, serveMcpViaCli, serveMjpeg, serveFramesToMp4, serveBucket}  = serverUtils

export async function expressTestServices(app) {
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))  

  serveImportMap(app, {express})
  serveMcpViaCli(app, {express})
  serveCli(app)
  serveCliStream(app)
  serveGotoSource(app)
  serveEditSource(app, {express})
  serveBucket(app, {express, seedFiles: {'metadata/cities.json': 'packages/react/cities.json'}})
  //serveMjpeg(app)
  //serveFramesToMp4(app)

  const repoRoot = await calcRepoRoot()
  app.get('/repoRoot', async (req, res) => {
    res.status(200).send(repoRoot)
  })
  app.get('/env', async (req, res) => {
    const env = await readFile(path.join(repoRoot, '.env'), 'utf8')
    res.status(200).send(env)
  })

  app.use('/hosts', express.static(path.join(repoRoot, 'hosts')))
  // a dry run of scripts/upload-jb-react-to-bucket.sh stages here, so the exact artifact (page + rewritten
  // import map) is browsable and harvestable before it is uploaded
  app.use('/upload-stage', express.static(path.join(repoRoot, '.tmp/upload-stage')))
}