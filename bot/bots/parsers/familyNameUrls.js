const fs = require('fs');
const {parseUrl} = require('../helpers/parser');
const {wait} = require('../../modules/Helpers');
const pagePauseMs = 50;

const RESULT_FILE = __dirname + "/familyNameUrls.json";

let namesListUrl = 'https://names.neolove.ru/last_names/';
let baseUrl = 'https://names.neolove.ru';

(async () => {
    let {letterUrls} = await parseUrl(namesListUrl, {
        letterUrls: (document) => {
            let results = [];

            document.querySelectorAll('div.let ul li a').forEach(el => {
                results.push({
                    letter: el.innerHTML,
                    url: el.getAttribute('href').replace(/^\/\//, 'https://'),
                });
            });

            return results;
        }
    });

    let allFamilyNamesUrls = [];
    // if ( fs.existsSync(RESULT_FILE) ) {
    //     let lastLetter = 'Й';
    //     let lastLetterIndex = letterUrls.findIndex(item => item.letter === lastLetter);
    //     letterUrls.splice(0, lastLetterIndex);
    //     allFamilyNamesUrls = JSON.parse( fs.readFileSync(RESULT_FILE) );
    // }

    for (const letter of letterUrls) {
        console.log(letter.letter);
        let {lastUrl} = await parseUrl(letter.url, {
            lastUrl: (document) => {
                let pagerLinks = document.querySelectorAll('.pager.pagertop a');
                let lastLink = pagerLinks[pagerLinks.length - 1];
                let lastUrl = lastLink ? lastLink.getAttribute('href') : false;

                return lastUrl;
            }
        });

        if (!lastUrl) {
            continue;
        }

        let [, maxPageNum] = lastUrl.match(/=(\d+)/i);
        let urlTemplate = lastUrl.replace(maxPageNum, ':page:');

        let letterPageUrls = Array( parseInt(maxPageNum) ).fill(urlTemplate).map((url, index) => url.replace(':page:', index+1));

        for (const letterPageUrl of letterPageUrls) {
            console.log(letterPageUrl);
            let {familyUrls} = await parseUrl(letterPageUrl, {
                familyUrls: document => {
                    let results = [];

                    document.querySelectorAll('.list_names:not(.subletters) a').forEach(el => {
                        results.push({
                            familyName: el.innerHTML,
                            url: baseUrl + el.getAttribute('href').replace(/^\/\//, 'https://'),
                        });
                    });

                    return results;
                }
            });

            allFamilyNamesUrls = allFamilyNamesUrls.concat(familyUrls);
            fs.writeFileSync(RESULT_FILE, JSON.stringify(allFamilyNamesUrls));
            await wait(pagePauseMs);
        }

    }


})();
