import express from 'express'
import dotenv from 'dotenv'
dotenv.config()
import { expressTestServices } from './express-testing-utils.js'
const app = express()
const port = process.env.PORT || 8083
expressTestServices(app)

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
