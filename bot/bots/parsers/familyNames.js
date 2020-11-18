const fs = require('fs');
const {parseUrl} = require('../helpers/parser');
const {getDb} = require('../../modules/Database');

const URLS_FILE = __dirname + "/familyNameUrls.json";

getDb().then(async (db) => {
    let allFamilyNamesUrls = JSON.parse( fs.readFileSync(URLS_FILE) ) || [];
    let familyNames = db.collection('familyNames');

    let savedRecords = await familyNames.find({}).toArray();
    let savedFamilyNames = savedRecords.map(record => record.familyName);
    let filteredFamilyNames = allFamilyNamesUrls.filter( record => savedFamilyNames.indexOf(record.familyName) === -1 );
    // let lastFamilyName = 'Винтенко';
    // let familyNameIndex = allFamilyNamesUrls.findIndex(item => item.familyName === lastFamilyName);
    // allFamilyNamesUrls.splice(0, familyNameIndex);
    // let filteredFamilyNames = allFamilyNamesUrls;

    for (const {familyName, url} of filteredFamilyNames) {
        console.log(familyName);
        let {versions} = await parseUrl(url, {
            versions: (document) => {
                let versions = [];

                let versionEls = document.querySelectorAll('[id^=name_descr_vers_]');
                versionEls.forEach(versionEl => {
                    let person = false;
                    let personEl = versionEl.querySelector('.block_person');
                    if (personEl) {
                        let nameEl = versionEl.querySelector('.block_person .row_name b');
                        let datesEl = versionEl.querySelector('.block_person .row_d');
                        let roleEl = versionEl.querySelector('.block_person .row_d + div');

                        person = {
                            name: nameEl ? nameEl.innerHTML.trim() : false,
                            dates: datesEl ? datesEl.innerHTML.trim() : false,
                            role: roleEl ? roleEl.innerHTML.trim() : false,
                        }
                    }

                    let textEl = versionEl.querySelector('div[style]');
                    let titleEl = versionEl.querySelector('h3');

                    let text = textEl ? textEl.innerHTML.replace(/\<br\>/gi, '\n').trim() : false;
                    let title = titleEl ? titleEl.innerHTML.trim() : false;

                    versions.push({title, text, person});
                });

                return versions;
            }
        });

        await familyNames.findOneAndReplace({familyName}, {familyName, versions, url}, {upsert: true, returnOriginal: false});
    }
});