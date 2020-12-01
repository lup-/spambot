const {Client} = require('pg');

const {PG_HOST, PG_PORT, PG_USER, PG_PASS} = process.env;

async function getPg(dbName) {
    const client = new Client({
        host: PG_HOST,
        port: PG_PORT,
        user: PG_USER,
        password: PG_PASS,
        database: dbName,
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    });

    await client.connect();
    return client;
}

module.exports = {
    getPg,
}