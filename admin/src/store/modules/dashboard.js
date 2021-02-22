import axios from "axios";

export default {
    state: {
        data: {},
    },
    getters: {},
    actions: {
        async loadDashboard({commit}, params) {
            let response = await axios.post(`/api/stats/dashboard`, params);
            return commit('setDashboardData', response.data);
        },
    },
    mutations: {
        setDashboardData(state, data) {
            state.data = data;
        },
    }
}
