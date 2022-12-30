const StorageManager = require('./storage')

class ReplayManager {
    // public
    static Init() {
        this.RefreshInterval = setInterval(() => ReplayManager.PropagateReplays(), this.RefreshIntervalDuration)
        return this
    }
    static OnReplayEmit(callback) {
        this.ReplayEmitCallbacks.push(callback)
        return this
    }
    static SetReplayRefreshInterval(durationMs) {
        this.RefreshIntervalDuration = durationMs
        clearTimeout(this.RefreshInterval)
        return this.Init()
    }

    static IsRecording(slug) {
        return Boolean(this.RecordingMap[slug])
    }
    static StartTrimming(slug) {
        console.log('[ ] Starting replay trim for', slug)
        this.IsTrimming[slug] = true
        ReplayManager.StartRecording(slug)
    }
    static async SaveTrimming(slug) {
        console.log('[.] Stopping replay trim for', slug)
        this.IsTrimming[slug] = false
        ReplayManager.SaveRecording(slug)
    }
    static StartRecording(slug) {
        console.log('[$] Starting replay recording for', slug)
        this.RecordingMap[slug] = []
    }
    static async SaveRecording(slug, tickRate=0) {
        console.log('[+] Saving replay recording for', slug, 'at', tickRate, 'ticks/sec')
        const replay = [...this.RecordingMap[slug]]
        this.RecordingMap[slug] = null
        if (!tickRate || typeof tickRate !== typeof 1) {
            const lastReplay = await StorageManager.GetReplay(slug)
            if (!lastReplay) {
                console.log('[!] Cannot save replay without explicit and/or existing numerically-typed tickRate')
                return
            }
            tickRate = lastReplay.tickRate
        }
        await StorageManager.SaveReplay({ slug, tickRate, replay })
        clearInterval(this.ReplayEmissionIntervals[slug])
        delete this.ReplayEmissionIntervals[slug]
    }
    static AllowRecording(payload) {
        const [slug] = payload
        if (this.RecordingMap[slug] && !this.IsTrimming[slug]) {
            this.RecordingMap[slug].push(payload)
        }
    }

    // private
    static IsTrimming = {}
    static RecordingMap = {}
    static ReplayDatumIdx = {}
    static ReplayEmitCallbacks = []
    static ReplayEmissionIntervals = {}
    static RefreshIntervalDuration = 1000
    static RefreshInterval

    static async AllowReplayPropagation(slug) {
        if (!this.ReplayEmissionIntervals[slug]) {
            this.ReplayEmissionIntervals[slug] = true
            const replayData = await StorageManager.GetReplay(slug)
            const { tickRate } = replayData
            console.log('[&] Starting new replay playback interval for', slug, 'at', tickRate, 'ticks/sec')
            this.ReplayDatumIdx[slug] = 0
            this.ReplayEmissionIntervals[slug] = setInterval(() => this.PropagateReplay(replayData), 1000 / tickRate)
        }
    }

    static async PropagateReplays() {
        const replaySlugs = await StorageManager.GetAllReplaySlugs()
        for (const { slug } of replaySlugs) this.AllowReplayPropagation(slug)
    }

    static async PropagateReplay({ slug, replay }) {
        if (this.ReplayDatumIdx[slug] >= replay.length) this.ReplayDatumIdx[slug] = 0
        const realPayload = replay[this.ReplayDatumIdx[slug]++]
        if (this.IsTrimming[slug]) this.RecordingMap[slug].push(realPayload)
        const [, displayName, ...datum] = realPayload
        const mockPayload = [`npc/${slug}`, `(NPC) ${displayName}`, ...datum]
        for (const callback of this.ReplayEmitCallbacks) callback('player', ...mockPayload)
    }
}

module.exports = ReplayManager
