import express from 'express'
import child from 'child_process'

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
dotenv.config();

const settings = {
  open_editor_cmd: process.env.open_editor_cmd || 'code -r -g '
};

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = 8083

app.use('/plugins', express.static(path.join(__dirname, '../plugins')))
app.use('/tests', express.static(path.join(__dirname, '../tests')))
app.use('/packages', express.static(path.join(__dirname, '../packages')))
app.use('/libs', express.static(path.join(__dirname, '../libs')))

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})

app.get('/gotoSource', (req, res) => {
  const cmd = [settings.open_editor_cmd,req.query.filePos].join(' ')
  console.log(cmd)
  child.exec(cmd,{})
  res.status(200).send('cmd')
})

