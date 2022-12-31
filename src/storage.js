const { MongoClient } = require('mongodb')

class StorageManager {    
    static db
    static replays
    static mongoClient

    static async Connect() {
        if (this.db) return
        const { MONGO_CONN_STR, MONGO_DB_NAME } = process.env
        this.mongoClient = new MongoClient(MONGO_CONN_STR)
        await this.mongoClient.connect()
        this.db = this.mongoClient.db(MONGO_DB_NAME)
        this.replays = this.db.collection('replays')
    }

    static async GetAllReplaySlugs() {
        await this.Connect()
        return this.replays.find({}, { slug: 1, _id: 0 }).toArray()
    }

    static async GetReplay(slug) {
        await this.Connect()
        return this.replays.findOne({ slug })
    }
    static async GetReplayTickRate(slug) {
        await this.Connect()
        return this.replays.findOne({ slug }, { tickRate: 1, _id: 0 })
    }
    static async SaveReplay({ slug, tickRate, replay }) {
        await this.Connect()
        const existing = await this.GetReplay(slug)
        if (existing) await this.replays.deleteOne({ slug })
        console.log('[+] Inserting replay into DB for', slug, 'with length', replay.length, 'at', tickRate, 'ticks/sec')
        return this.replays.insertOne({ slug, tickRate, replay })
    }
}

module.exports = StorageManager
