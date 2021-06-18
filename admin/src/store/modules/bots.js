import axios from "axios";

export default {
    state: {
        list: [],
        settings: false,
        allSettings: [],
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
            return (botPropName, filterSingle = false, allowAll = false) => {
                let filter = {};
                let allowedBots = getters.allowedBotNames.slice();
                if (allowAll) {
                    allowedBots.push(false);
                    allowedBots.push(null);
                }

                if (allowedBots.length > 0) {
                    filter[botPropName] = filterSingle
                        ? {$in: allowedBots, $size: 1}
                        : {$in: allowedBots};
                }

                return filter;
            }
        },
        botSettings(state) {
            return neededBotNames => {
                return state.allSettings.filter(botSettings => neededBotNames.indexOf(botSettings.botName) !== -1);
            }
        }
    },
    actions: {
        async loadBots({commit}, filter) {
            let response = await axios.post(`/api/bots/list`, {filter});
            await commit('setBots', response.data.bots);
            if (response.data.settings) {
                commit('setAllSettings', response.data.settings);
            }
        },
        async loadSettings({commit}, botName) {
            let response = await axios.post(`/api/bots/getSettings`, {botName});
            return commit('setSettings', response.data.settings);
        },
        async loadAllSettings({commit}) {
            let response = await axios.post(`/api/bots/getAllSettings`);
            return commit('setAllSettings', response.data.settings);
        },
        async saveSettings({commit, dispatch}, settings) {
            let response = await axios.post(`/api/bots/saveSettings`, {settings});
            commit('setSettings', response.data.settings);
            return dispatch('loadAllSettings');
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
        setAllSettings(state, settings) {
            state.allSettings = settings;
        },
    }
}