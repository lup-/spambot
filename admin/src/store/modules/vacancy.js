import axios from "axios";

export default {
    state: {
        list: [],
        categories: [],
        customCategories: [],
        current: false,
        currentFilter: {}
    },
    actions: {
        async loadVacancies({commit}, filter = {}) {
            let response = await axios.post(`/api/vacancy/list`, {filter});
            await commit('setFilter', filter);
            return commit('setVacancies', response.data.vacancies);
        },
        async loadCategories({commit}) {
            let response = await axios.post(`/api/vacancy/categories`);
            return commit('setCategories', response.data.categories);
        },
        async loadCustomCategories({commit}, botNames) {
            let response = await axios.post(`/api/vacancy/customCategories`, {botNames});
            return commit('setCustomCategories', response.data.categories);
        },
        async setCurrentVacancy({commit, state}, vacancyId) {
            let vacancy = state.list.find(item => item.id === vacancyId);
            if (vacancy) {
                commit('setCurrentVacancy', vacancy);
            }
        },
        async newVacancy({dispatch, state}, vacancy) {
            let result = await axios.post(`/api/vacancy/add`, {vacancy});
            dispatch('setCurrentVacancy', result.data.vacancy);
            return dispatch('loadVacancies', state.currentFilter);
        },
        async editVacancy({dispatch, state}, vacancy) {
            await axios.post(`/api/vacancy/update`, {vacancy});
            return dispatch('loadVacancies', state.currentFilter);
        },
        async deleteVacancy({dispatch, state}, vacancy) {
            await axios.post(`/api/vacancy/delete`, {vacancy});
            return dispatch('loadVacancies', state.currentFilter);
        },
    },
    mutations: {
        setVacancies(state, vacancies) {
            state.list = vacancies;
        },
        setCategories(state, categories) {
            state.categories = categories;
        },
        setCustomCategories(state, categories) {
            state.customCategories = categories;
        },
        setCurrentVacancy(state, vacancy) {
            state.current = vacancy;
        },
        setFilter(state, filter) {
            state.currentFilter = filter;
        }
    }
}