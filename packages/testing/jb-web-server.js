import express from 'express'
import child from 'child_process'
import dotenv from 'dotenv'
dotenv.config()
import { serveImportMap } from '@jb6/server-utils'
import { coreUtils } from '@jb6/core'
import { } from '@jb6/core/utils/jb-cli.js'

const { runNodeCli}  = coreUtils
const app = express()
const port = process.env.PORT || 8083

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))  

serveImportMap(app, {express})
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})

app.get('/gotoSource', (req, res) => {
  const open_editor_cmd = process.env.open_editor_cmd || 'code -r -g '
  const cmd = [open_editor_cmd,req.query.filePos].join(' ')
  console.log(cmd)
  child.exec(cmd,{})
  res.status(200).send('cmd')
})

app.post('/run-cli', async (req, res) => {
  const { script, cwd } = req.body
  const result = await runNodeCli(script, cwd)
  res.status(200).json({ result })
})
