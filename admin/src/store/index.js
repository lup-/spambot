import Vue from 'vue';
import Vuex from "vuex";

import stats from "./modules/stats";
import ads from "./modules/ads";
import bots from "./modules/bots";
import messages from "@/store/modules/messages";
import mailing from "@/store/modules/mailing";
import vacancy from "./modules/vacancy";
import user from "./modules/user";
import dashboard from "@/store/modules/dashboard";

Vue.use(Vuex);

export default new Vuex.Store({
    modules: {
        stats,
        ads,
        mailing,
        bots,
        messages,
        vacancy,
        user,
        dashboard
    },
    state: {
        appError: false,
        appMessage: false,
        routes: [
            {code: 'stats', title: 'Боты', icon: 'mdi-robot'},
            {code: 'adsList', title: 'Приписки', icon: 'mdi-cash-usd'},
            {code: 'mailingList', title: 'Рассылки', icon: 'mdi-email'},
            {code: 'refUsersList', title: 'Админы каналов', icon: 'mdi-account-multiple'},
            {code: 'vacanciesList', title: 'Вакансии', icon: 'mdi-briefcase'},
            {code: 'usersList', title: 'Пользователи админки', icon: 'mdi-account'},
        ]
    },
    getters: {
        allowedRoutes(state, getters) {
            return state.routes.filter(route => getters.userHasRights(route.code));
        }
    },
    actions: {
    },
    mutations: {
        setAppError(state, error) {
            state.appError = error;
        },
        setErrorMessage(state, text) {
            state.appMessage = {text, color: 'error'};
        },
        setSuccessMessage(state, text) {
            state.appMessage = {text, color: 'success'};
        },
        setInfoMessage(state, text) {
            state.appMessage = {text, color: 'info'};
        },
    }
});
