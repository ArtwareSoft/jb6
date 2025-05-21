import express from 'express'
import child from 'child_process'
import dotenv from 'dotenv'
dotenv.config()
import { serveImportMap } from '@jb6/server-utils'

const app = express()
const port = process.env.PORT || 8083

serveImportMap(app)
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

