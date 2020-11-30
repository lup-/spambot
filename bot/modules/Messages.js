const messages = require('../messages');
const {getDb} = require('../modules/Database');
const {truncateString} = require('./Helpers');
const shortid = require('shortid');

let ads = [];
let botMessages = [];

function getTemplate(code) {
    return messages[code] || '';
}
function escapeMarkdown(text) {
    //см. https://core.telegram.org/bots/api#markdownv2-style

    let pairedSymbols = [
        {from: '*', to: '@@asterisk@@'},
        {from: '__', to: '@@underline@@'},
        {from: '_', to: '@@underscore@@'},
        {from: '~', to: '@@strikethrough@@'},
        {from: '```', to: '@@blockcode@@'},
        {from: '`', to: '@@inlinecode@@'},
    ];

    let allSymbols = pairedSymbols.concat([
        {from: '[', to: '@@lsqb@@'},
        {from: ']', to: '@@rsqb@@'},
        {from: '(', to: '@@lcrb@@'},
        {from: ')', to: '@@rcrb@@'},
    ]);

    let safeText = text;
    for (const replacement of pairedSymbols) {
        let fromRegexp = new RegExp("\\"+replacement.from+"(.*?)\\"+replacement.from, 'gms');
        let toExp = replacement.to+'$1'+replacement.to;

        safeText = safeText.replace( fromRegexp, toExp );
    }

    safeText = safeText.replace(
        /\[(.*?)\]\((.*?)\)/g,
        '@@lsqb@@$1@@rsqb@@@@lcrb@@$2@@rcrb@@'
    );

    safeText = safeText.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    for (const replacement of allSymbols) {
        let allRegexp = new RegExp( "\\"+replacement.to, 'g' );
        safeText = safeText.replace(allRegexp, replacement.from);
    }

    return safeText;
}
function getMessage(code, data = {}) {
    let message = getTemplate(code);

    for (const key in data) {
        const value = data[key];

        let replaceRegexp = new RegExp(`%${key}%`, 'g');
        message = message.replace(replaceRegexp, value);
    }

    if (!message) {
        message = code;
    }

    return message;
}

async function loadAds(bot) {
    let db = await getDb('botofarmer');
    let allAds = db.collection('ads');

    let filter = {
        $or: [
            {bots: {$in: [bot, null, false, []]}},
            {bots: {$elemMatch: {$eq: bot}}},
        ],
        'type': 'small',
        'deleted': {$in: [null, false]}
    };

    ads = await allAds.find(filter).toArray();
}
async function loadMessages(bot) {
    let db = await getDb('botofarmer');
    let allMessages = db.collection('messages');

    let filter = {
        'bot': bot,
    };

    botMessages = await allMessages.find(filter).toArray();
}
function reloadAds() {
    return loadAds(getBotName());
}
function reloadMessages() {
    return loadMessages(getBotName());
}

async function addNewMessage(posId, text, tags) {
    let bot = getBotName();
    let db = await getDb('botofarmer');
    let allMessages = db.collection('messages');
    let id = shortid.generate();

    return allMessages.insertOne({id, posId, text, tags, bot});
}
async function addDisplay(ad) {
    let db = await getDb('botofarmer');
    let ads = db.collection('ads');
    return ads.updateOne({id: ad.id}, {$inc: {display: 1}});
}

function getBacktrace() {
    let stackText = new Error().stack;
    let stack = stackText.split('\n').map(btLine => {
        let stackFullRegexp = / +at *([^ ]*?) \((.*?):(\d+?):(\d+?)\)/i;
        let stackAnonRegexp = / +at *(.*?):(\d+?):(\d+?)/i;
        if (stackFullRegexp.test(btLine)) {
            let [, functionName, fileName, line, char] = btLine.match(stackFullRegexp);
            return {fileName, functionName, line, char};
        }
        else if (stackAnonRegexp.test(btLine)) {
            let [, fileName, line, char] = btLine.match(stackAnonRegexp);
            let functionName = false;
            return {fileName, functionName, line, char};
        }
        else {
            return null;
        }
    }).filter(item => item !== null);

    return stack;
}
function getMessagePosition() {
    let backtrace = getBacktrace();
    let msgFnIndex = backtrace.findIndex(item => item.functionName === 'getExtendedMessage');
    let msgCallIndex = msgFnIndex+1;

    return backtrace[msgCallIndex] || false;
}
function getMessagePositionId() {
    let pos = getMessagePosition();
    if (!pos) {
        return false;
    }

    pos.functionName = pos.functionName ? pos.functionName : '*anon*';
    pos.fileName = pos.fileName.replace( process.cwd()+'/', '' );

    return [pos.fileName, pos.line, pos.char].join(':');
}

function getAd(message, tags) {
    let posId = getMessagePositionId();
    let dbMessage = botMessages.find(msg => msg.posId === posId || msg.text === message);

    if (!dbMessage) {

        (async () => {
            await addNewMessage(posId, message, tags);
            await reloadMessages();
        })();

        return false;
    }

    let noLoadedAds = !ads || (ads && ads.length === 0);
    if (noLoadedAds) {
        return false;
    }

    let fitAds = ads.filter(ad => {
        let hasBotTarget = ad.bots && ad.bots.length > 0;
        let hasNoBotTarget = !hasBotTarget;
        let fitByBot = hasBotTarget && ad.bots.includes(getBotName());

        let hasMessageTarget = ad.messages && ad.messages.length > 0;
        let hasNoMessageTarget = !hasMessageTarget;
        let fitByMessage = hasMessageTarget && ad.messages.indexOf(dbMessage.id) !== -1;

        let hasTagsTarget = ad.tags && ad.tags.length > 0;
        let hasNoTagsTarget = !hasTagsTarget;
        let commonTags = hasTagsTarget
            ? ad.tags.filter(tag => tags.includes(tag))
            : [];
        let fitByTag = hasTagsTarget && commonTags && commonTags.length > 0;

        let messageFits = (fitByBot || hasNoBotTarget) &&
            (fitByMessage || hasNoMessageTarget) &&
            (fitByTag || hasNoTagsTarget);

        return messageFits;
    });

    let totalProb = fitAds.reduce((sum, ad) => {
        sum+=Math.round(ad.prob *100);
        return sum;
    }, 0);

    let probArray = Array(100).fill(false);

    let probIndex = 0;
    for (const ad of fitAds) {
        let itemsCount = Math.round(ad.prob*100);
        if (totalProb > 100) {
            itemsCount = Math.round(itemsCount * 100 / totalProb);
        }

        for (let i = 0; i <= itemsCount; i++) {
            probArray[probIndex] = ad;
            probIndex++;
        }
    }

    probArray.sort(_ => Math.random() - 0.5);
    let ad = probArray[0] || false;
    if (ad) {
        addDisplay(ad);

        return ad;
    }

    return false;
}
function getExtendedMessage(message, tags, type) {
    let MAX_LEN = type === 'photo' ? 1024 : 4096;
    let ad = getAd(message, tags);

    return ad
        ? truncateString(`${message}\n\n${ad.text}`, MAX_LEN)
        : message;
}
function getBotName() {
    let bot = process.env.BOT_NAME;
    return bot;
}

(async () => {
    let bot = getBotName();
    await loadAds(bot);
    await loadMessages(bot);
})();

module.exports = {
    __: getExtendedMessage,
    __md: (code, data = {}) => escapeMarkdown(getMessage(code, data)),
    reloadAds,
    reloadMessages,
}