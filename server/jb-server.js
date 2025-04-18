import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = 8083

app.use('/plugins', express.static(path.join(__dirname, '../plugins')))
app.use('/tests', express.static(path.join(__dirname, '../tests')))
app.use('/packages', express.static(path.join(__dirname, '../packages')))

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
