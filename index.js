const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const PORT = process.env.PORT || 8080

let seen
const recordJson = []
function recordPlayer(slug, payload) {
  const fs = require('fs')
  if (payload[0] === slug) {
    if (!seen) seen = new Date().getTime()
    if (new Date().getTime() - seen >= 5000) recordJson.push(payload)
    if (new Date().getTime() - seen >= 15000) fs.writeFileSync(__dirname + '/mock.json', JSON.stringify(recordJson))
  }
}

let mockInterval
function mockPlayer(slug='epic/Boomer', displayName='Boomer', tickRate=120) {
  const mockJson = require('./mock.json')
  let i = 0;
  mockInterval = setInterval(() => {
    if (i >= mockJson.length) i = 0
    const [,, ...payload] = mockJson[i++]
    io.emit('player', slug, displayName, ...payload)
  }, 1000/tickRate)
}

const app = express()
app.get('/health', (_,res) => res.send('ok'))
app.get('/mock/on', (_,res) => {
  mockPlayer('foo/bar', 'Mocky Boi', 240)
  res.send('ok')
})
app.get('/mock/off', (_,res) => {
  clearInterval(mockInterval)
  res.send('ok')
})


const server = http.createServer(app)
const io = socketio(server)
// will fire for every new websocket connection
io.on('connection', socket => {
  console.info(`<${socket.id}> connected`)
  socket.on('disconnect', () => console.info(`<${socket.id}> disconnected`))
  socket.on('self', (...payload) => {
    console.log(...payload)
    io.emit('player', ...payload)
  })
})

// important! must listen from `server` not `app`
server.listen(PORT, () => console.log(`API listening on port ${PORT}!`))
