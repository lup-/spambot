<template>
    <v-app id="botofarmer">
        <v-alert type="error" v-model="showError" dismissible tile class="global-error">{{appError}}</v-alert>
        <v-navigation-drawer v-model="drawer" app clipped v-if="isLoggedIn">
            <v-list dense>
                <v-list-item v-for="route in routes" :key="route.code"
                    link
                    @click="$router.push({name: route.code})"
                    :disabled="$route.name === route.code"
                >
                    <v-list-item-action>
                        <v-icon v-text="route.icon"></v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>{{route.title}}</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <v-list-item v-if="$store.getters.isLoggedIn" link @click="logout">
                    <v-list-item-action>
                        <v-icon>mdi-logout</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>Выход</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app clipped-left>
            <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
            <v-toolbar-title>Ботовод</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn v-if="canRestart && systemIsOk !== null" @click="restart" :color="systemIsOk ? 'success' : 'warning'" :x-small="systemIsOk">
                <v-icon v-text="systemIsOk ? 'mdi-check-circle' : 'mdi-alert'" class="mr-2" :x-small="systemIsOk"></v-icon>
                {{systemIsOk ? 'Система в порядке' : 'Перегрузить систему'}}
            </v-btn>

            <v-progress-linear
                    :active="isLoading"
                    :indeterminate="isLoading"
                    absolute
                    bottom
            ></v-progress-linear>
        </v-app-bar>

        <v-main v-if="initDone">
            <router-view></router-view>
        </v-main>

        <v-footer app>
        </v-footer>

        <v-snackbar v-model="showMessage" :timeout="5000" :color="appMessage.color">
            {{ appMessage.text }}
            <template v-slot:action="{ attrs }">
                <v-btn icon v-bind="attrs" @click="showMessage = false"> <v-icon>mdi-close</v-icon> </v-btn>
            </template>
        </v-snackbar>
    </v-app>
</template>

<script>
    export default {
        name: 'App',
        data: () => ({
            drawer: null,
            showError: false,
            showMessage: false,
            initDone: false,
        }),
        watch: {
            appError() {
                this.showError = true;
            },
            appMessage() {
                this.showMessage = true;
            }
        },
        async created() {
            this.initDone = false;
            await this.$store.dispatch('loginLocalUser');
            await this.$store.dispatch('loadBots');
            await this.$store.dispatch('loadSystemStatus');
            this.initDone = true;
            await this.$store.dispatch('loadAds');
            await this.$store.dispatch('loadMessages');
            return true;
        },
        methods: {
            async logout() {
                await this.$store.dispatch('logoutUser');
                return this.$router.push({name: 'login'});
            },
            async restart() {
                if (this.systemIsOk) {
                    this.$store.commit('setSuccessMessage', 'Система в порядке, перезагрузка не требуется');
                    return;
                }

                await this.$store.dispatch('restartSystem');
                return this.$store.commit('setInfoMessage', 'Перезагрузка системы запущена');
            }
        },
        computed: {
            appError() {
                return this.$store.state.appError;
            },
            appMessage() {
                return this.$store.state.appMessage;
            },
            routes() {
                return this.$store.getters.allowedRoutes(this.$router.options.routes);
            },
            isLoggedIn() {
                return this.$store.getters.isLoggedIn;
            },
            canRestart() {
                return this.$store.state.user.current.isAdmin;
            },
            systemIsOk() {
                return this.$store.state.system.systemOk;
            },
            isLoading() {
                return this.$store.state.system.restartInProgress;
            }
        }
    }
</script>

<style>
    .v-application .error {z-index: 100}
</style>
