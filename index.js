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


const server = http.createServer(app)
const io = socketio(server)
// will fire for every new websocket connection
io.on('connection', socket => {
  console.info(`<${socket.id}> connected`)
  socket.on('disconnect', () => console.info(`<${socket.id}> disconnected`))
  socket.on('self', (...payload) => {
    Mock.PropagateMocks()
    Mock.AllowRecording(payload)
    io.emit('player', ...payload)
    console.log(...payload)
  })
})

// important! must listen from `server` not `app`
server.listen(PORT, () => console.log(`API listening on port ${PORT}!`))

class Mock {
  static FilePath = `${__dirname}/mocks`
  static RecordingMap = {}
  static MockIterators = {}
  static MockIntervals = {}

  static IsRecording(slug) {
    return Boolean(this.RecordingMap[slug])
  }
  static StartRecording(slug) {
    this.RecordingMap[slug] = []
  }
  static SaveRecording(slug, tickRate) {
    const filePath = `${this.FilePath}/${Buffer(slug).toString('base64')}.json`
    fs.writeFileSync(filePath, JSON.stringify({ tickRate, data: this.RecordingMap[slug] }))
    this.StopRecording(slug)
  }
  static StopRecording(slug) {
    clearInterval(this.MockIntervals[slug])
    delete this.MockIntervals[slug]
    this.RecordingMap[slug] = null
  }
  static AllowRecording(payload) {
    if (this.RecordingMap[payload[0]]) this.RecordingMap[payload[0]].push(payload)
  }

  static PropagateMocks() {
    fs.readdir(this.FilePath, (err, files) => {
      if (err) return console.log('Unable to scan directory: ' + err)
      for(const file of files) {
        const slug = Buffer(file, 'base64').toString('ascii')
        if (!this.MockIntervals[slug]) {
          const { tickRate, data } = require(`${this.FilePath}/${file}`)
          this.MockIterators[slug] = 0
          this.MockIntervals[slug] = setInterval(() => {
            if (this.MockIterators[slug] >= data.length) this.MockIterators[slug] = 0
            const [, displayName, ...datum] = data[this.MockIterators[slug]++]
            const mockPayload = [`ghost/${slug}`, `(Ghost) ${displayName}`, ...datum]
            io.emit('player', ...mockPayload)
            console.log(...mockPayload)
          }, 1000/tickRate)
        }
      }
    })
  }
}
