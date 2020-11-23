<template>
    <v-app id="botofarmer">
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
        }),
        mounted() {
        },
    };
</script>

<style>
    .theme--light.v-btn.red,
    .theme--light.v-btn.green {
        color: white;
    }
</style>
