import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify';
import {router, store} from './router'

import VueTrix from "vue-trix";
import Chartist from "vue-chartist";

import 'chartist/dist/chartist.min.css';

Vue.config.productionTip = false

Vue.config.errorHandler = function (err) {
  if (vueInstance) {
    vueInstance.$store.commit('setAppError', err);
  }
  let c = console;
  c.error(err);
};

Vue.use(VueTrix);
Vue.use(Chartist, {
  messageNoData: "Недостаточно данных",
  classNoData: "empty"
})

let vueInstance = new Vue({
  vuetify,
  store,
  router,
  render: h => h(App)
}).$mount('#app')
