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
import system from "@/store/modules/system";

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
        dashboard,
        system
    },
    state: {
        appError: false,
        appMessage: false,
        routes: [
            {code: 'stats', title: 'Боты', icon: 'mdi-robot', componentName: 'Stats'},
            {code: 'adsList', title: 'Приписки', icon: 'mdi-cash-usd', componentName: 'AdsList'},
            {code: 'mailingList', title: 'Рассылки', icon: 'mdi-email', componentName: 'MailingsList'},
            {code: 'refUsersList', title: 'Админы каналов', icon: 'mdi-account-multiple', componentName: 'RefUsersList'},
            {code: 'vacanciesList', title: 'Вакансии', icon: 'mdi-briefcase', componentName: 'VacanciesList'},
            {code: 'usersList', title: 'Пользователи админки', icon: 'mdi-account', componentName: 'UsersList'},
        ]
    },
    getters: {
        allowedRoutes(state, getters) {
            return (allRoutes) => {
                return state.routes.filter(button => {
                    let requiresAdmin = allRoutes
                        .filter(route => route.meta && route.meta.group === button.code)
                        .some(route => route.meta && route.meta.requiresAdmin === true);

                    return getters.userHasRights(button.code, requiresAdmin);
                });
            }
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
