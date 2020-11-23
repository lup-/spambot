import axios from "axios";

export default {
    state: {
        stats: [],
    },
    actions: {
        async loadStats({commit}, filter) {
            let response = await axios.post(`/api/stats/list`, {filter});
            return commit('setStats', response.data.stats);
        },
    },
    mutations: {
        setStats(state, stats) {
            state.stats = stats;
        },
    }
}