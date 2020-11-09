const {getManager} = require('./managers');
const shortid = require('shortid');

(async () => {
    let chatId = 483896081;
    let botId = 1443282945;

    let mailing = {
        id: shortid.generate(),
        botId,
        chats: Array(100000).fill(chatId),
        text: 'Ну еще капельку!',
    }

    let mailingManager = await getManager('mailing');
    let result = await mailingManager.saveMailing(mailing);
    console.log(result.id);
    return true;
})();