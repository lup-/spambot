import axios from "axios";

export default {
    state: {
        list: [],
        categories: [],
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
        async setCurrentVacancy({commit, state}, vacancyId) {
            let vacancy = state.list.find(item => item.id === vacancyId);
            if (vacancy) {
                commit('setCurrentVacancy', vacancy);
            }
        },
        async newVacancy({dispatch, state}, vacancy) {
            let result = await axios.post(`/api/vacancy/add`, {vacancy});
            dispatch('setCurrentVacancy', result.data.vacancy);
            return dispatch('loadVacancies', state.filter);
        },
        async editVacancy({dispatch, state}, vacancy) {
            await axios.post(`/api/vacancy/update`, {vacancy});
            return dispatch('loadVacancies', state.filter);
        },
        async deleteVacancy({dispatch, state}, vacancy) {
            await axios.post(`/api/vacancy/delete`, {vacancy});
            return dispatch('loadVacancies', state.filter);
        },
    },
    mutations: {
        setVacancies(state, vacancies) {
            state.list = vacancies;
        },
        setCategories(state, categories) {
            state.categories = categories;
        },
        setCurrentVacancy(state, vacancy) {
            state.current = vacancy;
        },
        setFilter(state, filter) {
            state.currentFilter = filter;
        }
    }
}