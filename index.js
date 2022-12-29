const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const PORT = process.env.PORT || 8080

const app = express()
app.get('/health', (_,res) => res.send('ok'))

const server = http.createServer(app)
const io = socketio(server)
// will fire for every new websocket connection
io.on('connection', socket => {
  console.info(`<${socket.id}> connected`)
  socket.on('disconnect', () => console.info(`<${socket.id}> disconnected`))
  socket.on('self', (...payload) => {
    console.log(...payload)
    // lookup slug and reconcile to username for steam people?
    io.emit('player', ...payload)
  })
})

// important! must listen from `server` not `app`
server.listen(PORT, () => console.log(`API listening on port ${PORT}!`))




