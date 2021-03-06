import Vue from 'vue';
import Vuex from 'vuex';

import user from "./modules/user";
import payment from "./modules/payment";
import course from "@/store/modules/course";
import category from "@/store/modules/category";
import subscriber from "@/store/modules/subscriber";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        appError: false,
        appMessage: false,
        routes: [
            {code: 'coursesList', title: 'Курсы', icon: 'mdi-school'},
            {code: 'categoriesList', title: 'Категории', icon: 'mdi-tag-multiple'},
            {code: 'paymentsList', title: 'Платежи', icon: 'mdi-cash'},
            {code: 'subscribersList', title: 'Подписчики', icon: 'mdi-account-cash'},
            {code: 'usersList', title: 'Пользователи админки', icon: 'mdi-account-hard-hat', space: true},
            {code: 'stats', routeName: 'statDashboard', title: 'Статистика', icon: 'mdi-database', space: true},
        ]
    },
    getters: {
        allowedRoutes(state, getters) {
            return state.routes.filter(route => getters.userHasRights(route.code));
        }
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
    },
    actions: {},
    modules: {
        user,
        payment,
        course,
        category,
        subscriber
    }
})
