import axios from "axios";
import he from "he";

function trimHTML(html) {
    return he.decode(html.replace(/<\/*[a-z]+.*?>/ig, '').replace(/ +/, ' ')).trim();
}

function truncateString(str, len) {
    if (str.length > len) {
        return str.substring(0, len-3)+'...';
    }

    return str;
}

export default {
    state: {
        list: [],
    },
    getters: {
        tags(state) {
            let allTags = state.list.reduce((res, message) => {
                return res.concat(message.tags || []);
            }, []).filter((tag, index, array) => array.indexOf(tag) === index);

            return allTags;
        },
        messages(state) {
            return (botNames, tags) => {
                botNames = botNames ? botNames : [];
                tags = tags ? tags : [];
                let anyBots = botNames.length === 0;
                let anyTags = tags.length === 0;

                return state.list.filter(message => {
                    let hasBot = message.bot && message.bot.length > 0;
                    let hasNoBot = !hasBot;
                    let botsFit = hasBot && botNames.includes(message.bot);

                    let hasTags = message.tags && message.tags.length > 0;
                    let hasNoTags = !hasTags;
                    let commonTags = hasTags ? message.tags.filter(tag => tags.includes(tag)) : [];
                    let tagsFit = hasTags && commonTags.length > 0;

                    return (anyBots || hasNoBot || botsFit) && (anyTags || hasNoTags || tagsFit);
                });
            }
        },
        textMessages(state, getters) {
            return (botNames, tags) => {
                const MAX_LEN = 50;
                let messages = JSON.parse(JSON.stringify( getters.messages(botNames, tags) ));

                return messages.map(message => {
                    message.text = truncateString( trimHTML(message.text), MAX_LEN );
                    return message;
                });
            }
        }
    },
    actions: {
        async loadMessages({commit}, filter = {}) {
            let response = await axios.post(`/api/messages/list`, {filter});
            return commit('setMessages', response.data.messages);
        },
    },
    mutations: {
        setMessages(state, messages) {
            state.list = messages;
        },
    }
}