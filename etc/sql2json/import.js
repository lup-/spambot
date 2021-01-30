const {getDb} = require('../bot/modules/Database');

const fs = require('fs');
const fileName = process.argv[2];
const dbName = process.argv[3] || fileName.split('.')[0];

(async () => {
    let jsonTables = fs.readFileSync(fileName).toString();
    let tables = JSON.parse(jsonTables);

    let db = await getDb(dbName);
    console.log(`Создается база ${dbName}`);
    for (const table of tables) {
        console.log(`Импорт ${table.name}`);
        if (table.records && table.records.length > 0) {
            await db.collection(table.name).insertMany(table.records);
        }
        else {
            console.log('Пусто');
        }
    }
    console.log('Готово');
    process.exit();
})();