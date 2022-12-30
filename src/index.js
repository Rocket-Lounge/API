require('dotenv').config()
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const ReplayManager = require('./replays')
const PORT = process.env.PORT || 8080

const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(express.static('public'))
app.get('/health', async (_,res) => {
  const replaySlugs = await ReplayManager.GetAvailableReplaySlugs()
  res.send({ status: 'ok', replays: replaySlugs.length })
})
app.get('/download', async (_,res) => {
  res.download('./plugin/A1RocketLounge.dll')
})
app.get('/mock/record/:platform/:userId/:tickRate', (req,res) => {
  const { platform, userId, tickRate } = req.params
  const slug = `${platform}/${userId}`
  if (ReplayManager.IsRecording(slug)) {
    // stop and save
    ReplayManager.SaveRecording(slug, Number(tickRate || 120))
    res.send('saved')
  } else {
    // start recording
    ReplayManager.StartRecording(slug)
    res.send('recording')
  }
})

app.get('/mock/trim/:platform/:userId', (req,res) => {
  const { platform, userId } = req.params
  const slug = `${platform}/${userId}`
  if (ReplayManager.IsTrimming[slug]) {
    ReplayManager.SaveTrimming(slug)
    res.send('saved')
  } else {
    ReplayManager.StartTrimming(slug)
    res.send('recording')
  }
})

io.on('connection', socket => {
  console.info(`<${socket.id}> connected`)
  socket.on('disconnect', () => console.info(`<${socket.id}> disconnected`))
  socket.on('self', (...payload) => {
    ReplayManager.AllowRecording(payload)
    io.emit('player', ...payload)
  })
})

// important! must listen from `server` not `app`
server.listen(PORT, () => console.log(`API listening on port ${PORT}!`))
ReplayManager.Init()
  .SetReplayRefreshInterval(1000)
  .OnReplayEmit((eventName, ...payload) => io.emit(eventName, ...payload))
