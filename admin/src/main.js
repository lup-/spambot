import Vue from 'vue';
import App from './App.vue';
import VueRouter from 'vue-router';
import routes from "@/routes";
import vuetify from './plugins/vuetify';
import store from "@/store";

import VueTrix from "vue-trix";

let vueInstance;
const router = new VueRouter({
  routes
});

Vue.config.productionTip = false;
Vue.config.errorHandler = function (err) {
  if (vueInstance) {
    vueInstance.$store.commit('setAppError', err);
  }
  let c = console;
  c.error(err);
};

Vue.use(VueRouter);
Vue.use(VueTrix);

vueInstance = new Vue({
  store,
  router,
  vuetify,
  render: h => h(App)
}).$mount('#app')