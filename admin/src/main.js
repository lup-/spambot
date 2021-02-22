import Vue from 'vue';
import App from './App.vue';
import VueRouter from 'vue-router';
import vuetify from './plugins/vuetify';
import {router, store} from '@/router';

import VueTrix from "vue-trix";

let vueInstance;

Vue.config.productionTip = false;
Vue.config.silent = true;
Vue.config.errorHandler = function (err) {
  let skipError = err.toString().toLowerCase().indexOf('navigation') !== -1;
  if (skipError) {
    return;
  }

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