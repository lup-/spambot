import Vue from 'vue';
import VueRouter from 'vue-router';
import routes from "./routes";
import store from "../store";

Vue.use(VueRouter);

const router = new VueRouter({
    routes
});

router.beforeEach(async (to, from, next) => {
    if (to.matched.some(record => record.meta.requiresAuth || record.meta.requiresAdmin)) {
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
            let requiresAdmin = to.matched && to.matched[0] ? to.matched[0].meta.requiresAdmin : false;

            let userHasRights = routeGroup && store.getters.userHasRights(routeGroup, requiresAdmin);

            if (userHasRights) {
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
