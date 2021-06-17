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
            return dispatch('loadMailings', state.currentFilter);
        },
        async editMailing({dispatch, state}, mailing) {
            await axios.post(`/api/mailing/update`, {mailing});
            return dispatch('loadMailings', state.currentFilter);
        },
        async deleteMailing({dispatch, commit, state}, mailing) {
            await axios.post(`/api/mailing/delete`, {mailing});
            commit('setSuccessMessage', 'Рассылка удалена!');
            return dispatch('loadMailings', state.currentFilter);
        },
        async archiveMailing({dispatch, commit, state}, mailing) {
            await axios.post(`/api/mailing/archive`, {mailing});
            commit('setSuccessMessage', 'Рассылка архивирована!');
            return dispatch('loadMailings', state.currentFilter);
        },
        async startMailing({dispatch, commit}, mailing) {
            try {
                let response = await axios.post(`/api/mailing/play`, {mailing});
                if (response && response.data && response.data.success) {
                    commit('setSuccessMessage', 'Рассылка запущена!');
                }
                else {
                    commit('setErrorMessage', 'Ошибка запуска рассылки!');
                }
            }
            catch (e) {
                commit('setErrorMessage', 'Ошибка запуска рассылки! '+e.toString());
            }
            await dispatch('loadMailings');
        },
        async stopMailing({dispatch, commit}, mailing) {
            try {
                let response = await axios.post(`/api/mailing/pause`, {mailing});
                if (response && response.data && response.data.success) {
                    commit('setSuccessMessage', 'Рассылка остановлена!');
                }
                else {
                    commit('setErrorMessage', 'Ошибка остановки рассылки!');
                }
            }
            catch (e) {
                commit('setErrorMessage', 'Ошибка остановки рассылки! '+e.toString());
            }
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