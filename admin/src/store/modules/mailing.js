import axios from "axios";

export default {
    state: {
        list: [],
        current: false,
        currentFilter: false,
    },
    actions: {
        async loadMailings({commit}, filter = {}) {
            let response = await axios.post(`/api/mailing/list`, {filter});
            await commit('setFilter', filter);
            return commit('setMailings', response.data.mailings);
        },
        async setCurrentMailing({commit, state}, mailingId) {
            let mailing = state.list.find(item => item.id === mailingId);
            if (mailing) {
                commit('setCurrentMailing', mailing);
            }
        },
        async newMailing({dispatch, state}, mailing) {
            let result = await axios.post(`/api/mailing/add`, {mailing});
            dispatch('setCurrentAd', result.data.mailing);
            return dispatch('loadMailings', state.filter);
        },
        async editMailing({dispatch, state}, mailing) {
            await axios.post(`/api/mailing/update`, {mailing});
            return dispatch('loadMailings', state.filter);
        },
        async deleteMailing({dispatch, commit, state}, mailing) {
            await axios.post(`/api/mailing/delete`, {mailing});
            commit('setSuccessMessage', 'Рассылка удалена!');
            return dispatch('loadMailings', state.filter);
        },
        async archiveMailing({dispatch, commit, state}, mailing) {
            await axios.post(`/api/mailing/archive`, {mailing});
            commit('setSuccessMessage', 'Рассылка архивирована!');
            return dispatch('loadMailings', state.filter);
        },
        async startMailing({dispatch}, mailing) {
            await axios.post(`/api/mailing/play`, {mailing});
            await dispatch('loadMailings');
        },
        async stopMailing({dispatch}, mailing) {
            await axios.post(`/api/mailing/pause`, {mailing});
            await dispatch('loadMailings');
        },
    },
    mutations: {
        setMailings(state, mailings) {
            state.list = mailings;
        },
        setCurrentMailing(state, mailing) {
            state.current = mailing;
        },
        setFilter(state, filter) {
            state.currentFilter = filter;
        }
    }
}