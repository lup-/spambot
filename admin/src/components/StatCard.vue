<template>
    <v-card>
        <v-card-title @click="gotoBotStats(stats.botId)">{{getTgUsername(stats.botId)}}
            <v-card-subtitle>{{stats.botId}}</v-card-subtitle>
            <v-card-subtitle v-if="stats.external">Внешний</v-card-subtitle>
        </v-card-title>
        <v-list dense>
            <v-list-item>
                <v-list-item-content>
                    <v-list-item-title>Пользователей</v-list-item-title>
                </v-list-item-content>
                <v-list-item-action>
                    <v-list-item-action-text>{{stats.users.count || 0}}</v-list-item-action-text>
                </v-list-item-action>
            </v-list-item>
            <v-divider v-if="stats.refs && stats.refs.length > 0"></v-divider>
            <v-list-item v-if="stats.refs && stats.refs.length > 0">
                <v-list-item-content>
                    <v-list-item-title>Ссылки</v-list-item-title>
                </v-list-item-content>
            </v-list-item>
            <v-list-item v-for="(ref, index) in stats.refs" :key="ref.code" :style="{backgroundColor: index % 2 === 0 ? 'white' : 'rgba(0,0,0,0.1)'}">
                <v-list-item-content>
                    <v-list-item-title>{{ref.code}}</v-list-item-title>
                </v-list-item-content>
                <v-list-item-action>
                    <v-list-item-action-text>{{ref.count || 0}}</v-list-item-action-text>
                </v-list-item-action>
            </v-list-item>
        </v-list>
        <v-card-actions>
            <v-btn @click="gotoBotStats(stats.botId)">Статистика</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
    export default {
        name: "StatCard",
        props: ['stats'],
        methods: {
            getTgUsername(botId) {
                return '@' + this.$store.getters.botTgField(botId, 'username');
            },
            gotoBotStats(botId) {
                this.$router.push({name: 'statsDetails', params: {id: botId}});
            }
        }
    }
</script>

<style scoped>

</style>