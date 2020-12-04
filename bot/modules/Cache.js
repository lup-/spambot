const {getDb} = require('./Database');
const moment = require('moment');
const redis = require("redis");

let cacheInstance = null;

function CacheManager() {
    let redisClient = null;
    let mongoCache = null;

    return {
        async init() {
            // redisClient = redis.createClient({
            //     host: process.env.REDIS_HOST || '127.0.0.1',
            //     port: process.env.REDIS_PORT || 6379,
            // });

            let db = await getDb('botofarmer');
            mongoCache = db.collection('cache');

            return this;
        },

        async getPermanent(key, getFn, timeSec = 86400) {
            let cacheItem = await mongoCache.findOne({key});

            if (!cacheItem) {
                let value = await getFn();
                let created = moment().unix();
                let timeout = created + timeSec;

                await mongoCache.insertOne({key, value, created, timeout});
                return value;
            }

            let currentTime = moment().unix();
            let isCacheInvalid = cacheItem.timeout < currentTime;
            if (isCacheInvalid) {
                try {
                    let value = await getFn();
                    let created = moment().unix();
                    let timeout = created + timeSec;

                    await mongoCache.findOneAndReplace({key}, {key, value, created, timeout});
                    return value;
                }
                catch (e) {
                    return cacheItem.value;
                }
            }

            return cacheItem.value;
        }
    }
}

async function getCache() {
    if (cacheInstance) {
        return cacheInstance;
    }

    cacheInstance = new CacheManager();
    await cacheInstance.init();
    return cacheInstance;
}

module.exports = {getCache};