import express from 'express'
import child from 'child_process'
import path from 'path'
import { serveImportMap } from '@jb6/server-utils'
import { coreUtils } from '@jb6/core'
import { } from '@jb6/core/utils/jb-cli.js'

const { runNodeCli, calcRepoRoot}  = coreUtils

export async function expressTestServices(app) {
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))  

  serveImportMap(app, {express})

  app.get('/gotoSource', (req, res) => {
    const open_editor_cmd = process.env.open_editor_cmd || 'code -r -g '
    const cmd = [open_editor_cmd,req.query.filePos].join(' ')
    console.log(cmd)
    child.exec(cmd,{})
    res.status(200).send('cmd')
  })

  app.post('/run-cli', async (req, res) => {
    const { script, importMap } = req.body
    const result = await runNodeCli(script, {importMap})
    res.status(200).json({ result })
  })

  const repoRoot = await calcRepoRoot()
  app.get('/repoRoot', async (req, res) => {
    res.status(200).send(repoRoot)
  })
  app.use('/hosts', express.static(path.join(repoRoot, 'hosts')))
}