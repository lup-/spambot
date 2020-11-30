import Vue from 'vue';
import Vuex from "vuex";

import stats from "./modules/stats";
import ads from "./modules/ads";
import bots from "./modules/bots";
import messages from "@/store/modules/messages";

Vue.use(Vuex);

export default new Vuex.Store({
    modules: {
        stats,
        ads,
        bots,
        messages
    },
    state: {
        appError: false
    },
    actions: {
    },
    mutations: {
        setAppError(state, error) {
            state.appError = error;
        },
    }
});