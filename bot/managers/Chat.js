const {getDb} = require('../modules/Database');
const moment = require('moment');

let chatInstance = null;

function ChatManager() {
    return {
        async init() {
            return this;
        },
        async saveChat(chatFields, botName = false) {
            const db = await getDb(botName);
            const chats = db.collection('chats');
            const id = chatFields.id;

            if (!chatFields.date_registered) {
                chatFields.date_registered = moment().unix();
            }

            let updateResult = await chats.findOneAndReplace({id}, chatFields, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },

    }
}

function getInstance() {
    if (chatInstance) {
        return chatInstance;
    }

    chatInstance = new ChatManager();
    return chatInstance;
}

module.exports = getInstance;