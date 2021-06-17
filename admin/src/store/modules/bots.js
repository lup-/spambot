import axios from "axios";

export default {
    state: {
        list: [],
        settings: false,
    },
    getters: {
        botNames(state) {
            return state.list.map(bot => bot.botName);
        },
        botTgField(state) {
            return (botId, field) => {
                let bot = state.list.find(bot => bot.id === botId);
                return bot && bot.tg ? bot.tg[field] || false : false;
            }
        },
        allowedBotList(state, getters, rootState) {
            let currentUser = rootState.user.current;
            let allowedBots = currentUser.botRights || [];
            let anyBotAllowed = allowedBots.length === 0;

            return state.list.filter(bot => {
                return anyBotAllowed || allowedBots.indexOf(bot.botName) !== -1;
            });
        },
        allowedBotListForSelect(state, getters) {
            return getters.allowedBotList.map(bot => {
                return {text: bot.botName, value: bot.botName};
            });
        },
        allowedBotNames(state, getters) {
            return getters.allowedBotList.map(bot => bot.botName);
        },
        allowedBotFilter(state, getters) {
            return botPropName => {
                let filter = {};
                let allowedBots = getters.allowedBotNames;
                if (allowedBots.length > 0) {
                    filter[botPropName] = {$in: allowedBots};
                }

                return filter;
            }
        }
    },
    actions: {
        async loadBots({commit}, filter) {
            let response = await axios.post(`/api/bots/list`, {filter});
            return commit('setBots', response.data.bots);
        },
        async loadSettings({commit}, botName) {
            let response = await axios.post(`/api/bots/getSettings`, {botName});
            return commit('setSettings', response.data.settings);
        },
        async saveSettings({commit}, settings) {
            let response = await axios.post(`/api/bots/saveSettings`, {settings});
            return commit('setSettings', response.data.settings);
        },
        async restartBots({getters}, botNames) {
            if (!botNames) {
                botNames = getters.botNames;
            }
            return axios.post(`/api/bots/restart`, {botNames});
        },
        async reloadBotAds({getters}, botNames) {
            if (!botNames) {
                botNames = getters.botNames;
            }
            return axios.post(`/api/bots/reloadAds`, {botNames});
        },
        async reloadBotMessages({getters}, botNames) {
            if (!botNames) {
                botNames = getters.botNames;
            }
            return axios.post(`/api/bots/reloadMessages`, {botNames});
        },
    },
    mutations: {
        setBots(state, bots) {
            state.list = bots;
        },
        setSettings(state, settings) {
            state.settings = settings;
        },
    }
}