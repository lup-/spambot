<template>
    <v-container class="fill-height align-start">
        <v-row :align="isEmpty || isLoading ? 'center' : 'start'" :justify="isEmpty || isLoading ? 'center' : 'start'">
            <v-btn fab bottom right fixed large color="primary"
                    @click="$router.push({name: 'mailingNew'})"
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>

            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="headers"
                        :items="mailings"
                        :loading="isLoading"
                        :items-per-page="50"
                >
                    <template v-slot:item.progress="{ item }">
                        {{ (item.progress * 100).toFixed(2)+'%' }}
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="gotoMailingEdit(item.id)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small @click="copyMailing(item)"><v-icon>mdi-content-copy</v-icon></v-btn>
                        <v-btn icon small @click="deleteMailing(item)" v-if="!item.dateStarted"><v-icon>mdi-delete</v-icon></v-btn>
                        <v-btn icon small @click="startMailing(item)" v-if="item.status === 'paused'"><v-icon>mdi-play</v-icon></v-btn>
                        <v-btn icon small @click="stopMailing(item)" v-else><v-icon>mdi-pause</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import moment from "moment";

    function trimHTML(html) {
        return html
            .replace(/<!--.*?-->/ig, ' ')
            .replace(/<\/*[a-z]+.*?>/ig, ' ')
            .replace(/ +/, ' ')
            .trim();
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    export default {
        name: "MailingsList",
        data() {
            return {
                isLoading: false,
                headers: [
                    {text: 'Дата начала', value: 'startAt'},
                    {text: 'Текст', value: 'preview'},
                    {text: 'Статус', value: 'status'},
                    {text: 'Прогресс', value: 'progress'},
                    {text: 'Успешно', value: 'success'},
                    {text: 'Ошибок', value: 'errors'},
                    {text: 'Отправлено', value: 'processed'},
                    {text: 'Очередь', value: 'total'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            }
        },
        async mounted() {
            await this.loadMailings();
        },
        methods: {
            async copyMailing(mailing) {
                let newMailing = {};
                const allowedFields = ['target', 'photos', 'buttons', 'text', 'photoAsLink'];
                for (const field of allowedFields) {
                    if (typeof(mailing[field]) !== 'undefined') {
                        newMailing[field] = mailing[field];
                    }
                }

                await this.$store.dispatch('newMailing', newMailing);
                await this.loadMailings();
            },
            deleteMailing(mailing) {
                this.$store.dispatch('deleteMailing', mailing);
            },
            async loadMailings() {
                this.isLoading = true;
                await this.$store.dispatch('loadMailings', {});
                this.isLoading = false;
            },
            gotoMailingEdit(id) {
                this.$router.push({name: 'mailingEdit', params: {id}});
            },
            startMailing(mailing) {
                this.$store.dispatch('startMailing', mailing);
            },
            stopMailing(mailing) {
                this.$store.dispatch('stopMailing', mailing);
            }
        },
        computed: {
            mailings() {
                return this.isLoading ? [] : this.$store.state.mailing.list.map(mailing => {
                    let newMailing = clone(mailing);
                    newMailing.startAt = mailing.startAt ? moment.unix(mailing.startAt).format('DD.MM.YYYY HH:mm') : '-';
                    newMailing.preview = trimHTML(mailing.text).substring(0, 50)+'...';
                    return newMailing;
                });
            },
            isEmpty() {
                return this.mailings.length === 0 && this.isLoading === false;
            }
        }
    }
</script>

<style scoped>

</style>