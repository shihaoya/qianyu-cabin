import express from 'express'
import { config } from './config/index.js'
import authRoutes from './routes/auth.js'
import guestbookRoutes from './routes/guestbook.js'
import adminRoutes from './routes/admin.js'
import { errorHandler } from './middleware/error.js'

const app = express()

app.use(express.json())
app.get('/api/health', (req, res) => res.json({ code: 0, data: { ok: true }, message: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/guestbook', guestbookRoutes)
app.use('/api/admin', adminRoutes)
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Qianyu server listening on :${config.port}`)
})
