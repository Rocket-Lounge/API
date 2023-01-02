require('dotenv').config()
const http = require('http')
const enet = require('enet')
const express = require('express')
const socketio = require('socket.io')
const ReplayManager = require('./replays')
const PORT = process.env.PORT || 8080

const app = express()
const server = http.createServer(app)
const io = socketio(server)

enet.init((ip, port) => {
  // if(ip === '192.168.0.22')  return 0
    return 1 //permit the packet
})
enet.createServer({
	address: { address: "0.0.0.0", port: 7777 }, /* the address the server host will bind to */
	peers:32, /* allow up to 32 clients and/or outgoing connections */
	channels:2, /* allow up to 2 channels to be used, 0 and 1 */
	down:0, /* assume any amount of incoming bandwidth */
	up:0 /* assume any amount of outgoing bandwidth */
}, (err, host) => {
	if(err) return console.log('couldnt create host')
  console.log('created host')
	host.on("connect", (peer,data) => {
    console.log('client connected')
		peer.on("message", (packet,channel) => {
      host.broadcast("message", packet.data().toString())
      console.log('data received')
			console.log("received packet contents:",packet.data().toString())
		})
	})

	//start polling the host for events at 10ms intervals
	host.start(10)
})
// https://github.com/mnaamani/enet-npm/blob/master/Tutorial.md
// server.destroy()

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
  socket.on('chat', (...payload) => io.emit('chat', ...payload))
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

