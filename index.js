const fs = require('fs')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const PORT = process.env.PORT || 8080

const app = express()
app.get('/health', (_,res) => res.send('ok'))
app.get('/mock/record/:platform/:userId/:tickRate', (req,res) => {
  const { platform, userId, tickRate } = req.params
  const slug = `${platform}/${userId}`
  if (Mock.IsRecording(slug)) {
    // stop and save
    Mock.SaveRecording(slug, tickRate)
    res.send('saved')
  } else {
    // start recording
    Mock.StartRecording(slug)
    res.send('recording')
  }
})

app.get('/mock/trim/:platform/:userId', (req,res) => {
  const { platform, userId } = req.params
  const slug = `${platform}/${userId}`
  if (Mock.IsTrimming[slug]) {
    Mock.SaveTrimming()
    res.send('saved')
  } else {
    Mock.StartTrimming(slug)
    res.send('recording')
  }
})


const server = http.createServer(app)
const io = socketio(server)
// will fire for every new websocket connection
io.on('connection', socket => {
  console.info(`<${socket.id}> connected`)
  socket.on('disconnect', () => console.info(`<${socket.id}> disconnected`))
  socket.on('self', (...payload) => {
    Mock.AllowRecording(payload)
    io.emit('player', ...payload)
  })
})

// important! must listen from `server` not `app`
server.listen(PORT, () => console.log(`API listening on port ${PORT}!`))

// Refresh mocks every 1s
setInterval(() => Mock.PropagateMocks(), 1000)

class Mock {
  static FilePath = `${__dirname}/mocks`
  static RecordingMap = {}
  static MockIterators = {}
  static MockIntervals = {}
  static IsTrimming = {}

  static IsRecording(slug) {
    return Boolean(this.RecordingMap[slug])
  }
  static StartTrimming(slug) {
    this.IsTrimming[slug] = true
    Mock.StartRecording(slug)
  }
  static SaveTrimming(slug) {
    this.IsTrimming[slug] = false
    const { tickRate } = require(this.MockFilePath(slug))
    Mock.SaveRecording(slug, tickRate)
  }
  static StartRecording(slug) {
    this.RecordingMap[slug] = []
  }
  static SaveRecording(slug, tickRate) {
    fs.unlinkSync(this.MockFilePath(slug))
    fs.writeFileSync(this.MockFilePath(slug), JSON.stringify({ tickRate, timestamp: new Date().getTime(), data: this.RecordingMap[slug] }))
    clearInterval(this.MockIntervals[slug])
    delete this.MockIntervals[slug]
    this.RecordingMap[slug] = null
  }
  static AllowRecording(payload) {
    const [slug] = payload
    if (this.RecordingMap[slug] && !this.IsTrimming[slug]) {
      this.RecordingMap[slug].push(payload)
    }
  }

  static AllowMockFile(file) {
    const slug = Buffer(file, 'base64').toString('ascii')
    if (!this.MockIntervals[slug]) {
      const rawData = fs.readFileSync(`${this.FilePath}/${file}`)
      const { tickRate } = JSON.parse(rawData)
      this.MockIterators[slug] = 0
      this.MockIntervals[slug] = setInterval(() => this.PropagateMock(slug), 1000/tickRate)
    }
  }

  static PropagateMocks() {
    fs.readdir(this.FilePath, (err, files) => {
      if (err) return console.log('Unable to scan directory: ' + err)
      for(const file of files) this.AllowMockFile(file)
    })
  }

  static MockFilePath(slug) {
    return `${Mock.FilePath}/${Buffer(slug).toString('base64')}.json`
  }

  static PropagateMock(slug) {
    const rawData = fs.readFileSync(this.MockFilePath(slug))
    const { data } = JSON.parse(rawData)
    if (!data) return
    if (this.MockIterators[slug] >= data.length) this.MockIterators[slug] = 0
    const realPayload = data[this.MockIterators[slug]++]
    if (this.IsTrimming[slug]) {
      this.RecordingMap[slug].push(realPayload)
    }
    const [, displayName, ...datum] = realPayload
    const mockPayload = [`npc/${slug}`, `(NPC) ${displayName}`, ...datum]
    io.emit('player', ...mockPayload)
  }
}
