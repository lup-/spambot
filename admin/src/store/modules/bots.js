import axios from "axios";

export default {
    state: {
        list: [],
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
        }
    },
    actions: {
        async loadBots({commit}, filter) {
            let response = await axios.post(`/api/bots/list`, {filter});
            return commit('setBots', response.data.bots);
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
    }
}