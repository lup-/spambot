import Vue from 'vue';
import VueRouter from 'vue-router';

import Home from "../components/Home";
import PaymentsList from "../components/Payments/List";
import Login from '../components/Users/Login';
import UsersEdit from '../components/Users/Edit';
import UsersList from '../components/Users/List';
import CoursesList from '../components/Courses/List';
import CourseEdit from '../components/Courses/Edit';
import CategoriesList from '../components/Categories/List';
import CategoryEdit from '../components/Categories/Edit';

import store from "../store";

Vue.use(VueRouter);

const routes = [
    { name: 'home', path: '/', component: Home, meta: {requiresAuth: true, group: 'home'} },
    { name: 'login', path: '/login', component: Login },
    { name: 'paymentsList', path: '/payments/', component: PaymentsList, meta: {requiresAuth: true, group: 'paymentsList'} },
    { name: 'usersList', path: '/users/', component: UsersList, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userNew', path: '/users/new', component: UsersEdit, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userEdit', path: '/users/:id', component: UsersEdit, meta: {requiresAuth: true, group: 'usersList'} },

    { name: 'coursesList', path: '/courses/', component: CoursesList, meta: {requiresAuth: true, group: 'coursesList'} },
    { name: 'courseNew', path: '/courses/new', component: CourseEdit, meta: {requiresAuth: true, group: 'coursesList'} },
    { name: 'courseEdit', path: '/courses/:id', component: CourseEdit, meta: {requiresAuth: true, group: 'coursesList'} },

    { name: 'categoriesList', path: '/categories/', component: CategoriesList, meta: {requiresAuth: true, group: 'categoriesList'} },
    { name: 'categoryNew', path: '/categories/new', component: CategoryEdit, meta: {requiresAuth: true, group: 'categoriesList'} },
    { name: 'categoryEdit', path: '/categories/:id', component: CategoryEdit, meta: {requiresAuth: true, group: 'categoriesList'} },
]

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

router.beforeEach(async (to, from, next) => {
    if (to.matched.some(record => record.meta.requiresAuth)) {
        await store.dispatch('loginLocalUser');
        let isNotLoggedIn = !store.getters.isLoggedIn;
        let loginTo = {
            path: '/login',
            query: { redirect: to.fullPath }
        };

        if (isNotLoggedIn) {
            next(loginTo);
        }
        else {
            let routeGroup = to.matched && to.matched[0] ? to.matched[0].meta.group : false;

            if (routeGroup && store.getters.userHasRights(routeGroup)) {
                next();
            }
            else {
                store.commit('setErrorMessage', 'Не достаточно прав!');
                next(loginTo);
            }
        }
    }
    else {
        next();
    }
})

export {router, store};