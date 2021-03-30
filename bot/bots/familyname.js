const { Telegraf } = require('telegraf');
const {catchErrors} = require('./helpers/common');
const Markup = require('telegraf/markup');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');
const {getDb} = require('../modules/Database');
const {__} = require('../modules/Messages');
let bus = init('bus');

async function getMeanings(familyName) {
    let db = await getDb();

    let namesCollection = db.collection('familyNames');

    let ucName = capitalizeFirstLetter(familyName);

    let results = await namesCollection.findOne({familyName: ucName});
    return results;
}

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function keyboard(familyName) {

    let meaning = await getMeanings(familyName);
    let buttonBack = Markup.callbackButton('Выбрать другую фамилию', 'back');

    if (meaning) {
        let buttons = meaning.versions.map((item, index) => {
            return Markup.callbackButton(index+1, `action${index}/${familyName}`);
        });

        let allButtons = [
            buttons,
            [buttonBack]
        ];

        return Markup.inlineKeyboard(allButtons).extra();
    }
    else {
        return Markup.inlineKeyboard(buttonBack).extra();
    }
}

function getMessage(meanings, index) {
    if (meanings) {
        let version = meanings.versions[index].text;
        return __(`<b>Версия ${index+1}</b> 
    
${version}`, ['content', 'family']);
    }
    else {
        return "Такая фамилия у нас не значится "
    }
}

const BOT_TOKEN = process.env.BOT_TOKEN;

let tbot = new Telegraf(BOT_TOKEN);

tbot = setupBot(tbot)
    .addHandleBlocks()
    .addRefSave()
    .addUserSave()
    .addSaveActivity()
    .get()

tbot.catch(catchErrors);

tbot.start( async (ctx) => {
    return ctx.replyWithHTML('Назовите фамилию, значение которой Вас интересует');
});

tbot.on('message', async (ctx) => {

    let msg = ctx.update.message;

    if (msg) {
        let familyName = msg.text;
        let meanings = await getMeanings(familyName);

        return ctx.replyWithHTML( getMessage(meanings, 0), await keyboard(familyName) );
    }
    else {
        return ctx.replyWithHTML('Введите фамилию')
    }
});

tbot.action(/action([0-9]+)\/(.*)/, async ctx => {
    let i = ctx.match[1];
    let familyName = ctx.match[2];
    try {
        let index = parseInt(i);
        let meanings = await getMeanings(familyName);
        let extra = await keyboard(familyName);
        extra.parse_mode = 'HTML';

        await ctx.editMessageText(getMessage(meanings, index), extra);
    }
    catch (e) {}

    return;
});

tbot.action('back', ctx => {
    return ctx.replyWithHTML('Введите фамилию');
});

tbot.launch();
bus.listenCommands();

