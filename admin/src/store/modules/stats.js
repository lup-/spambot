import axios from "axios";

export default {
    state: {
        stats: [],
        details: [],
    },
    getters: {
        plotlyDetails(state) {
            return state.details.map(botStat => {
                return {
                    x: botStat.stats.map(item => item.tag),
                    y: botStat.stats.map(item => item.count),
                    type: 'scatter',
                    name: botStat.botId,
                }
            });
        }
    },
    actions: {
        async loadStats({commit}, filter) {
            let response = await axios.post(`/api/stats/list`, {filter});
            return commit('setStats', response.data.stats);
        },
        async loadDetails({commit}, params) {
            let response = await axios.post(`/api/stats/details`, params);
            return commit('setDetails', response.data.stats);
        },
    },
    mutations: {
        setStats(state, stats) {
            state.stats = stats;
        },
        setDetails(state, stats) {
            state.details = stats;
        }
    }
}