<template>
    <v-card>
        <v-card-title>{{stats.botId}}</v-card-title>
        <v-list>
            <v-list-item>
                <v-list-item-content>
                    <v-list-item-title>Пользователей</v-list-item-title>
                </v-list-item-content>
                <v-list-item-action>
                    <v-list-item-action-text>{{stats.users.count || 0}}</v-list-item-action-text>
                </v-list-item-action>
            </v-list-item>
            <v-list-item v-for="ref in stats.refs" :key="ref.code">
                <v-list-item-content>
                    <v-list-item-title>Переходов по ссылке</v-list-item-title>
                    <v-list-item-subtitle>{{ref.code}}</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                    <v-list-item-action-text>{{ref.count || 0}}</v-list-item-action-text>
                </v-list-item-action>
            </v-list-item>
        </v-list>
    </v-card>
</template>

<script>
    export default {
        name: "StatCard",
        props: ['stats'],
    }
</script>

<style scoped>

</style>