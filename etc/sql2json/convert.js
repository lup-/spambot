const fs = require('fs');
const fileName = process.argv[2];

function getTables(dump) {
    let tablesRegex = /CREATE TABLE ([^ ]+) \(.*?\);/gms;
    let tableRegex = /CREATE TABLE ([^ ]+) \((.*?)\);/ms;
    let tableMatches = dump.match(tablesRegex);

    let tables = [];
    for (const tableSql of tableMatches) {
        let tableParams = tableSql.match(tableRegex);

        let name = tableParams[1];
        let fieldSql = tableParams[2];
        let fields = [];
        for (const fieldDef of fieldSql.split(',')) {
            let fieldParams = fieldDef.trim().split(' ');
            fields.push({name: fieldParams[0], type: fieldParams[1]});
        }

        tables.push({name, fields});
    }

    return tables;
}
function getRecords(dump) {
    let recordsRegex = /INSERT INTO ([^ ]+) \(.*?\) VALUES \(.*?\);/gms;
    let recordRegex = /INSERT INTO ([^ ]+) \((.*?)\) VALUES \((.*?)\);/ms;
    let valuesRegex = /([\"\'].+?[\'\"]|[\da-z]+?)(?=,|$)/gsi;
    let recordMatches = dump.match(recordsRegex);

    let records = [];
    for (const recordSql of recordMatches) {
        let recordParams = recordSql.match(recordRegex);
        let table = recordParams[1];
        let fieldNames = recordParams[2].split(',').map(field => {
            let name = field.trim();
            let isQuoted = name.indexOf("'") === 0 || name.indexOf('"') === 0 || name.indexOf('`') === 0;
            if (isQuoted) {
                name = name.substr(1, name.length - 2);
            }

            return name;
        });
        let values = recordParams[3].match(valuesRegex).map(value => {
            value = value.trim();

            let isText = value.indexOf("'") === 0 || value.indexOf('"') === 0;
            let isNumeric = /^\d+$/.test(value);
            let isFloat = /^[\d\.]+$/.test(value);

            if (value === 'NULL') {
                value = null;
            }
            else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                value = value.toLowerCase() === 'true' ? true : false;
            }
            else if (isNumeric) {
                value = parseInt(value);
            }
            else if (isFloat) {
                value = parseFloat(value);
            }
            else if (isText) {
                value = value
                    .substr(1, value.length-2)
                    .replace(/''/g, "'");
            }

            return value;
        });

        let fields = fieldNames.reduce((result, key, index) => {
            result[key] = values[index];
            return result;
        }, {});

        records.push({table, fields});
    }

    return records;
}

(async () => {
    let dump = fs.readFileSync(fileName).toString();
    let tables = getTables(dump);
    let records = getRecords(dump);

    let tablesWithRecords = tables.map(table => {
        let tableRecords = records.filter(record => record.table === table.name).map(record => record.fields);
        table.records = tableRecords;
        return table;
    });

    console.log(JSON.stringify(tablesWithRecords));
})();