import express from 'express'
import child from 'child_process'
import { readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
dotenv.config();

const settings = {
  open_editor_cmd: process.env.open_editor_cmd || 'code -r -g '
};

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkgsDir = path.join(__dirname, '../packages')

const app = express()
const port = 8083

app.use('/packages', express.static(path.join(__dirname, '../packages')))

app.get('/import-map.json', async (_req, res) => {
  const entries = await readdir(pkgsDir, { withFileTypes: true })
  const folders = entries.filter(e => e.isDirectory()).map(e => e.name)
  const runtime = Object.fromEntries(
    folders.flatMap(f => [
      [`@jb6/${f}`,   `/packages/${f}/index.js`],
      [`@jb6/${f}/`, `/packages/${f}/`]          // enables sub-path imports
    ])
  )
  const internalAlias = { '#jb6/': '/packages/' }

  res.json({ imports: { ...runtime, ...internalAlias } })
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})

app.get('/gotoSource', (req, res) => {
  const cmd = [settings.open_editor_cmd,req.query.filePos].join(' ')
  console.log(cmd)
  child.exec(cmd,{})
  res.status(200).send('cmd')
})

