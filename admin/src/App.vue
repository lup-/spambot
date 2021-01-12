<template>
    <v-app id="botofarmer">
        <v-alert type="error" v-model="showError" dismissible tile class="global-error">{{appError}}</v-alert>
        <v-navigation-drawer v-model="drawer" app clipped>
            <v-list dense>
                <v-list-item link @click="$router.push({name: 'stats'})" :disabled="$route.name === 'stats'">
                    <v-list-item-action>
                        <v-icon>mdi-database</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>Статистика</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <v-list-item link @click="$router.push({name: 'adsList'})" :disabled="$route.name === 'adsList'">
                    <v-list-item-action>
                        <v-icon>mdi-cash-usd</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>Приписки</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <v-list-item link @click="$router.push({name: 'mailingList'})" :disabled="$route.name === 'mailingList'">
                    <v-list-item-action>
                        <v-icon>mdi-email</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>Рассылки</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <v-list-item link @click="$router.push({name: 'refUsersList'})" :disabled="$route.name === 'refUsersList'">
                    <v-list-item-action>
                        <v-icon>mdi-account-multiple</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>Админы</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <v-list-item link @click="$router.push({name: 'vacanciesList'})" :disabled="$route.name === 'vacanciesList'">
                    <v-list-item-action>
                        <v-icon>mdi-briefcase</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>Вакансии</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app clipped-left>
            <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
            <v-toolbar-title>Ботовод</v-toolbar-title>
        </v-app-bar>

        <v-main>
            <router-view></router-view>
        </v-main>

        <v-footer app>
        </v-footer>
    </v-app>
</template>

<script>
    export default {
        name: 'App',
        data: () => ({
            drawer: null,
            showError: false,
        }),
        watch: {
            appError() {
                this.showError = true;
            }
        },
        async created() {
            await this.$store.dispatch('loadAds');
            await this.$store.dispatch('loadBots');
            await this.$store.dispatch('loadMessages');
            return true;
        },
        computed: {
            appError() {
                return this.$store.state.appError;
            },
        }
    }
</script>

<style>
    .v-application .error {z-index: 100}
</style>
