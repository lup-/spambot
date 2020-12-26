//const {initManagers} = require('./managers');
const { Telegraf } = require('telegraf');
const {catchErrors} = require('./bots/helpers/common');
const Markup = require('telegraf/markup');
const {getDb} = require('./modules/Database');

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


let tbot = new Telegraf('1407429211:AAF0Etp7vkVQXsVbwSZLVI-Od4uAdTCdwHI');


function makeVersionsMenu(versions) {

    let versionButtons = []
    for (const version of versions) {
        versionButtons.push();
    }

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
        return `<b>Версия ${index+1}</b> 
    
${version}`;
    }
    else {
        return "Такая фамилия у нас не значится "
    }
}


//initManagers(['test', 'chat']).then( async  ({test, chat}) => {
    tbot.catch(catchErrors);

    tbot.start( async (ctx) => {
        return ctx.reply('Назовите фамилию, значение которой Вас интересует');
    });

    tbot.on('message', async (ctx) => {

        let msg = ctx.update.message;

        if (msg) {
            let familyName = msg.text;
            let meanings = await getMeanings(familyName);

            return ctx.replyWithHTML( getMessage(meanings, 0), await keyboard(familyName) );
        }
        else {
            return ctx.reply('Введите фамилию')
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
        return ctx.reply('Введите фамилию');
    });

    tbot.launch();

//})
