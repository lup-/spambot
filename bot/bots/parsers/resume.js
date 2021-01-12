const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const unoconv = require('unoconv2');
const moment = require('moment');
const dataConfig = require('./data/resume');
const tempWrite = require('temp-write');
const fs = require('fs');

const UNOCONV_BIN = process.env.UNOCONV_BIN || './unoconv-docker';
const UNOCONV_SHARED = process.env.UNOCONV_SHARED || __dirname;

function unique(array) {
    return array.filter( (item, index) => array.indexOf(item) === index );
}
function matchAll(text, regexp) {
    let flagsNoGlobal = regexp.flags.replace('g', '');
    let globalRegexp = new RegExp(regexp.source, flagsNoGlobal+'g');
    let localRegexp = new RegExp(regexp.source, flagsNoGlobal);
    let matches = text.match(globalRegexp);
    if (matches === null) {
        return null;
    }

    if (matches && matches.length === 0) {
        return null;
    }

    let matchesWithGroups = [];
    for (const subtext of matches) {
        matchesWithGroups.push( subtext.match(localRegexp) );
    }

    return matchesWithGroups;
}

function clearWhitespacesAndSpacySymbols(text) {
    return text
        .replace(/^[\s\.,\-_]+/, '')
        .replace(/[\s\.,\-_]+$/, '')
        .replace(/[\s\.,\-_]+/g, ' ');
}
function clearStopwords(text) {
    let stopWords = ['резюме', 'мужчина', 'женщина', 'resume', 'cv', 'male', 'female'].join('|');
    return clearWhitespacesAndSpacySymbols( text.replace(new RegExp(stopWords, 'gi'), '') );
}
function cleanWrongLanguageLetters(text) {
    let wrongPairs = [
        {en: 'a', ru: 'а'},
        {en: 'e', ru: 'е'},
        {en: 'o', ru: 'о'},
        {en: 'c', ru: 'с'},
        {en: 'x', ru: 'х'},
    ]
    let countRuLetters = text.replace(/[^а-яё]/gi, '').length;
    let countEnLetters = text.replace(/[^a-z]/gi, '').length;
    let convertEnToRu = countRuLetters >= countEnLetters;
    let fromTo = wrongPairs.map( pair => {
        let from = pair[ convertEnToRu ? 'en' : 'ru' ];
        let to = pair[ convertEnToRu ? 'ru' : 'en' ];
        return {from, to}
    });

    for (const pair of fromTo) {
        text = text.replace( new RegExp(pair.from, 'g'), pair.to);
        text = text.replace( new RegExp(pair.from.toLocaleUpperCase(), 'g'), pair.to.toLocaleUpperCase());
    }

    return text;
}
function clearWhitespaces(text) {
    return text.replace(/\s+/g, '');
}
function normalizeLink(link, urlBase) {
    try {
        let parsedLink = new URL(link);
        return parsedLink.toString();
    }
    catch (e) {
        link = link.replace(/^.*\//, '');
        return urlBase ? normalizeLink(urlBase+link) : false;
    }
}
function crossFindIndex(tokens, test) {
    let fullMatchIndex = tokens.indexOf(test);
    if (fullMatchIndex !== -1) {
        return fullMatchIndex;
    }

    let testWords = test.split(' ');
    let hasAnyTestWordsIndex = tokens.findIndex( token => {
        let tokenWords = token.split(' ');
        let arrayIntersect = tokenWords.filter(word => testWords.includes(word));
        return arrayIntersect.length > 0;
    });

    if (hasAnyTestWordsIndex !== -1) {
        return hasAnyTestWordsIndex;
    }

    return false;
}
function findRawField(text, aliases) {
    let fieldRegex = new RegExp( '(?<=(' +aliases.join('|') + '):\\s+)(.*)', 'gi' );
    let altFieldRegex = new RegExp( '(?<=(' +aliases.join('|') + ')\\s+)(@.*)', 'gi' );
    let result = text.match(fieldRegex);

    if (!result) {
        result = text.match(altFieldRegex);
    }

    return result;
}
function findLinks(text, aliases, urlBase) {
    let rawLinks = findRawField(text, aliases);
    let links = rawLinks ? unique(rawLinks.map( rawLink => normalizeLink(rawLink, urlBase) )): false;

    if (!links && urlBase) {
        let parsedUrl = new URL(urlBase);
        let host = parsedUrl.hostname;

        let urlRegex = new RegExp('\\S+'+host+'^\\S+', 'gi');
        rawLinks = text.match(urlRegex);
        links = rawLinks ? unique(rawLinks.map( rawLink => normalizeLink(rawLink, urlBase) )): false;
    }

    return links ? links[0] : false;
}
function findContact(text, aliases) {
    let rawContacts = findRawField(text, aliases);
    let contacts = rawContacts ? unique(rawContacts.map( clearWhitespaces )): false;
    return contacts[0] || false;
}
function parseDate(text, formats) {
    for (const format of formats) {
        try {
            let date = moment.utc(text, format);
            if (date.isValid()) {
                return date;
            }
        }
        catch (e) {
        }
    }

    return false;
}
function checkPhone(date, phones) {
    let dateNumbers = date.replace(/\D+/g, '');
    return phones.reduce( (matchingPhoneFound, phone) => {
        let currentPhoneMatches = phone.indexOf(dateNumbers) !== -1;
        return matchingPhoneFound || currentPhoneMatches;
    }, false);
}
function findDates(text) {
    let dateRegex = /(\d{2}\.\d{2}\.(\d{2}|\d{4})|(\d{2}|\d{4})-\d{2}-\d{2}|\d{1,2}\s[а-яa-z]+\s\d{4})/g;
    let rawDates = text.match(dateRegex);
    let dates = [];
    let phones = extractPhones(text);

    if (rawDates) {
        dates = rawDates
            .filter( (item, index) => rawDates.indexOf(item) === index )
            .filter( item => !checkPhone(item, phones) )
            .map((date) => parseDate(date, ['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD', 'YY-MM-DD', 'D MMMM YYYY']))
            .filter(item => item !== false)
            .filter(item => item.isValid());
    }

    return dates;
}
function normalizePhone(phone) {
    phone = phone.replace(/\D+/g, '').replace(/^\+8/, '+7');

    if (phone[0] === '8') {
        phone[0] = '7';
    }

    if (phone.length <= 10) {
        phone = '7'+phone;
    }

    return '+'+phone;
}
function filterNames(items) {
    return items.filter( item => {
        let itemParts = item.toLocaleLowerCase().split(/\s/);

        let hasName = false;
        let countFoundNames = 0;
        for (const part of itemParts) {
            //Иногда города называют по фамилиям людей. А иногда и фамилии по названиям городов. Москва, например. И город, и фамилия.
            let isNotCity = dataConfig.cities.indexOf(part) === -1;
            let isName = false;

            if (isNotCity) {
                isName = dataConfig.firstNames.indexOf(part) !== -1 || dataConfig.surNames.indexOf(part) !== -1 || dataConfig.familyNames.indexOf(part) !== -1;
                hasName = hasName || isName;
            }

            if (isName) {
                countFoundNames++;
            }
        }

        return hasName && (countFoundNames/itemParts.length > 0.5);
    });
}
function filterCities(items) {
    return items.filter( item => dataConfig.cities.indexOf(item.toLocale) !== -1 );
}
function splitFio(fio) {
    if (!fio) {
        return {f: false, i: false, o: false}
    }

    let lcParts = fio.toLocaleLowerCase().split(' ');
    let parts = fio.split(' ');

    if (parts.length === 3) {
        //есть фамилии которые как отчества. Викторович, например - и фамилия, и отчество.
        let isFamilyNameLast = dataConfig.familyNames.indexOf(lcParts[2]) !== -1 && dataConfig.surNames.indexOf(lcParts[2]) === -1;
        let isIOFpattern = isFamilyNameLast || dataConfig.firstNames.indexOf(lcParts[0]) !== -1;
        ;
        let [f, i, o] = parts;
        if (isIOFpattern) {
            [i, o, f] = parts;
        }

        return {f, i, o}
    }

    if (parts.length === 2) {
        let isIFpattern = dataConfig.familyNames.indexOf(lcParts[1]) !== -1 || dataConfig.firstNames.indexOf(lcParts[0]) !== -1;
        let [f, i] = parts;
        if (isIFpattern) {
            [i, f] = parts;
        }

        return {f, i, o: false}
    }

    if (parts.length === 1) {
        return {f: parts[0], i: false, o: false}
    }
}

function extractEmails(text) {
    let emailRegex = /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g;
    let rawEmails = text.match(emailRegex);
    let emails = false;

    if (rawEmails) {
        emails = unique( rawEmails );
    }

    return emails;
}
function extractPhones(text) {
    let phoneRegex = /(?<!\d)\+*\s*\d\s*\(*\d{3}\)*\s*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g;
    let rawPhones = text.match(phoneRegex);
    let phones = false;

    if (rawPhones) {
        phones = unique( rawPhones.map(normalizePhone) );
    }

    return phones;
}
function extractContacts(text) {
    return {
        email: extractEmails(text),
        phone: extractPhones(text),
        skype: findContact(text, ['Skype', 'Скайп']),
        telegram: findContact(text, ['Telegram', 'Telegramm', 'Телеграм', 'Телеграмм']),
        whatsapp: findContact(text, ['wh*atsapp*', 'WhatsApp', 'Вотсап', 'Вацап']),
    }
}
function extractName(text, fileName) {
    fileName = cleanWrongLanguageLetters(fileName);

    let nameRegex = /([А-ЯЁ][а-яё\-]+[\s\-_\.,]{1,2}){2,3}|([A-Z][a-z\-]+[\s\-_\.,]{1,2}){2}/gm;
    let names = text.match(nameRegex) ? text.match(nameRegex).map(clearStopwords): [];
    let namesFromFilename = fileName.match(nameRegex) ? fileName.match(nameRegex).map(clearStopwords) : [];

    let nameIndex = false;
    if (namesFromFilename.length > 0) {
        nameIndex = crossFindIndex(names, namesFromFilename[0]);
        if (nameIndex !== false) {
            return names[nameIndex];
        }
    }

    let filteredNames = filterNames(names.concat(namesFromFilename));
    return filteredNames.length > 0 ? filteredNames[0] : false;
}
function extractCity(text) {
    let fieldCityRegex = /(?<=(Проживает|Город|Resid.*|City): )([A-ZА-ЯЁ][a-zа-яё]+[ \-]*){1,2}/g;
    let rawCities = text.match(fieldCityRegex);
    let cities = rawCities ? unique(rawCities.map(clearWhitespacesAndSpacySymbols)): false;

    if (cities.length > 1) {
        cities = filterCities(cities);
        return cities.length > 0 ? cities[0] : false;
    }

    return cities[0] || false;
}
function extractSocialNets(text) {
    let facebook = findLinks(text, ['Facebook', 'FB'], 'https://www.facebook.com/');
    let vk = findLinks(text, ['ВКонтакте', 'VKontakte', 'VK', 'ВК'], 'https://vk.com/');
    let linkedin = findLinks(text, ['LinkedIn'], 'https://www.linkedin.com/in/');
    let github = findLinks(text, ['GitHub'], 'https://www.github.com/');

    return {
        facebook,
        vk,
        linkedin,
        github
    }
}
function extractAgeAndBirthday(text) {
    let birthday = false;
    let age = false;

    let hhAgeBirthdayRegex = /(\d+)\s[a-zа-я]+,\s(born\son|родился|родилась)\s(\d+\s[a-zа-я]+\s\d{4})/i;
    let hhDates = text.match(hhAgeBirthdayRegex);

    if (hhDates) {
        let isRu = hhDates[0].indexOf('родил') !== -1;
        let [__, rawAge, _, rawBirthday] = hhDates;
        moment.locale(isRu ? 'ru' : 'en');
        let date = moment.utc(rawBirthday, 'D MMMM YYYY');
        age = parseInt(rawAge);
        birthday = date.toISOString();
    }

    if (!birthday) {
        let dates = findDates(text);
        if (dates.length > 0) {
            let minAge = 18;
            let maxAge = 120;

            let deltas = dates
                .map(date => moment.utc().diff(date, 'years'))
                .map(delta => delta < 0 ? delta + 100 : delta);

            let ages = deltas.filter(delta => delta >= minAge && delta <= maxAge );

            if (ages.length > 0) {
                age = ages[0];
                birthday = dates[deltas.indexOf(age)].toISOString();
            }
        }
    }

    return {
        age,
        birthday
    }
}
function extractPosition(text) {
    let positionRegex = /(?<=(Желаемая\s+)*должность(\s+и\s+зарплата)*\s).*$/gm;
    let position = text.match(positionRegex) ? text.match(positionRegex).map(clearWhitespacesAndSpacySymbols): [];

    return position && position.length > 1 ? position[position.length-1] : false;
}
function extractSalary(text) {
    let salaryRegex = /[\d\s]{4,}\s*(руб|USD|\$|EUR)/gmi;
    let salary = text.match(salaryRegex) ? text.match(salaryRegex).map(clearWhitespacesAndSpacySymbols): [];
    if (!salary || (salary && salary.length === 0)) {
        return false;
    }
    let salaryText = salary[0];
    let currency = salaryText.replace(/^[\d\s]+/g, '').toLocaleLowerCase() || false;

    return {
        value: parseInt(salaryText.replace(/\D+/, '')),
        currency
    };
}
function extractSkills(text, skills) {
    if (!skills) {
        return false;
    }

    let foundSkills = skills.filter( skill => {
        return text.toLocaleLowerCase().indexOf( skill.toLocaleLowerCase() ) !== -1;
    }, []);

    return foundSkills;
}

function extractDataFromText(docText, fileName, allSkills = false) {
    let {age, birthday} = extractAgeAndBirthday(docText);
    let name = extractName(docText, fileName);

    let extractedData = {
        name,
        nameParts: splitFio(name),
        position: extractPosition(docText),
        salary: extractSalary(docText),
        city: extractCity(docText),
        age,
        birthday,
        contacts: extractContacts(docText),
        social: extractSocialNets(docText),
        skills: allSkills ? extractSkills(docText, allSkills) : [],
    }

    return extractedData;
}
async function extractImagesFromFile(filePath, onError) {
    let fileName = filePath.replace(/^.*\//, '');
    let dockerFileName = '/data/files/'+fileName;

    try {
        let docHTML = await getHTMLFromAny(dockerFileName);
        let images = matchAll(docHTML, /src=["']*data:(.*?);base64,([^"' ]+).*?width=["']*(\d+).*?height=["']*(\d+)/g);
        if (!images) {
            return false;
        }

        let parsedImages = [];
        for (const image of images) {
            let [, mimeType, base64, width, height] = image;
            width = parseInt(width);
            height = parseInt(height);

            parsedImages.push( {base64, mimeType, width, height} );
        }

        return parsedImages;
    }
    catch (e) {
        if (typeof (onError) === 'function') {
            onError(e);
        }
        return false;
    }
}

async function getUnoconvFormats() {
    return new Promise( (resolve, reject) => {
        unoconv.detectSupportedFormats({
            bin: UNOCONV_BIN,
        }, (err, detectedFormats) => {
            if (err) {
                reject(err);
                return;
            }

            let targetFormats = detectedFormats.document
                .concat( detectedFormats.presentation )
                .concat( detectedFormats.spreadsheet );

            resolve(targetFormats);
        });
    });
}
async function isFileConvertable(filePath) {
    let supportedFormats = await getUnoconvFormats();

    let supportedExtensions = supportedFormats.map(doc => doc.extension);
    let fileExtension = filePath.replace(/^.*\./, '').toLocaleLowerCase();

    return supportedExtensions.indexOf(fileExtension) !== -1;
}

async function getTextFromPdf(buffer) {
    let parsedData = await pdf(buffer);

    return parsedData.text;
}
async function getTextFromDocX(buffer) {
    let filePath = tempWrite.sync(buffer);
    let result = await mammoth.extractRawText({path: filePath});
    return result.value;
}
function getTextFromAny(file, format, retryNumber, resolve, reject) {
    if (typeof(format) === 'undefined') {
        format = 'txt';
    }

    if (typeof(retryNumber) === 'undefined') {
        retryNumber = 0;
    }

    let maxRetries = 5;

    if (!file.path) {
        let filePath = UNOCONV_SHARED + '/' + file.name;
        fs.writeFileSync(filePath, file.buffer);
        file.path = filePath;
        file.dockerPath = `/workdir/${file.name}`;
    }

    const promiseUnoconv = async (resolve, reject) => {
        let canConvert = await isFileConvertable(file.name);
        if (!canConvert) {
            reject();
            return;
        }

        unoconv.convert(file.dockerPath, format, {
            bin: UNOCONV_BIN,
        }, (err, resultBuffer) => {
            if (err) {
                retryNumber++;
                if (retryNumber < maxRetries) {
                    return getTextFromAny(file, format, retryNumber, resolve, reject);
                } else {
                    reject(err);
                    return;
                }
            }

            fs.unlinkSync(file.path);
            resolve(resultBuffer.toString());
        });
    };

    return retryNumber === 0
        ? new Promise( promiseUnoconv )
        : promiseUnoconv(resolve, reject);
}

function getHTMLFromAny(file) {
    return getTextFromAny(file, 'html');
}

async function parseFile(file, skills = []) {
    let {name, buffer} = file;
    let fileExtension = name.replace(/^.*\./, '').toLocaleLowerCase();

    try {
        let docText;
        switch (fileExtension) {
            case 'pdf':
                docText = await getTextFromPdf(buffer);
                break;
            case 'docx':
                docText = await getTextFromDocX(buffer);
                break;
            default:
                docText = await getTextFromAny(file);
                break;
        }

        let candidate = extractDataFromText(docText, name, skills);

        return {docText, candidate};
    }
    catch (e) {
        return false;
    }
}

module.exports = {parseFile, extractContacts, splitFio, extractSalary, extractImagesFromFile, extractDataFromText}