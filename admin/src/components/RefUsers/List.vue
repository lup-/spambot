<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="headers"
                        :items="refUsers"
                        :loading="isLoading"
                        :items-per-page="50"
                >
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="gotoUserEdit(item.id)"><v-icon>mdi-pencil</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "RefUsersList",
        data() {
            return {
                isLoading: false,
                headers: [
                    {text: 'Имя', value: 'name'},
                    {text: 'Имя пользователя', value: 'username'},
                    {text: 'Доступные рефки', value: 'refs'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            }
        },
        async mounted() {
            await this.loadRefUsers();
        },
        methods: {
            async loadRefUsers() {
                this.isLoading = true;
                await this.$store.dispatch('loadRefUsers');
                this.isLoading = false;
            },
            gotoUserEdit(userId) {
                this.$router.push({name: 'refUsersEdit', params: {id: userId}});
            }
        },
        computed: {
            refUsers() {
                return this.isLoading ? [] : this.$store.state.stats.refUsersList.map(profile => ({
                    id: profile.id,
                    name: [profile.user.first_name, profile.user.last_name].join(' '),
                    username: '@'+profile.user.username,
                    refs: profile.refs && profile.refs.length > 0
                        ? profile.refs.join(', ')
                        : ''
                }));
            },
            isEmpty() {
                return this.refUsers.length === 0 && this.isLoading === false;
            }
        }
    }
</script>

<style scoped>

</style>