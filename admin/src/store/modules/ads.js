import axios from "axios";

export default {
    state: {
        list: [],
        current: false,
        currentFilter: {}
    },
    actions: {
        async loadAds({commit}, filter = {}) {
            let response = await axios.post(`/api/amsg/list`, {filter});
            await commit('setFilter', filter);
            return commit('setAds', response.data.ads);
        },
        async setCurrentAd({commit, state}, adId) {
            let ad = state.list.find(item => item.id === adId);
            if (ad) {
                commit('setCurrentAd', ad);
            }
        },
        async newAd({dispatch, state}, ad) {
            let result = await axios.post(`/api/amsg/add`, {ad});
            dispatch('setCurrentAd', result.data.ad);
            return dispatch('loadAds', state.filter);
        },
        async editAd({dispatch, state}, ad) {
            await axios.post(`/api/amsg/update`, {ad});
            return dispatch('loadAds', state.filter);
        },
        async deleteAd({dispatch, state}, ad) {
            await axios.post(`/api/amsg/delete`, {ad});
            return dispatch('loadAds', state.filter);
        },
    },
    mutations: {
        setAds(state, ads) {
            state.list = ads;
        },
        setCurrentAd(state, ad) {
            state.current = ad;
        },
        setFilter(state, filter) {
            state.currentFilter = filter;
        }
    }
}