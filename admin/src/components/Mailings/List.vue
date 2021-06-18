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
                        :item-class="itemClass"
                        multi-sort
                        :sort-by="['archived', 'created']"
                        :sort-desc="[false, true]"
                        locale="ru"
                >
                    <template v-slot:item.progress="{ item }">
                        {{ item.processed && item.total ? (item.processed / item.total * 100).toFixed(2)+'%' : ''}}
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <div class="actions d-flex flex-row">
                            <v-btn icon small @click="gotoMailingEdit(item.id)" v-if="!item.archived"><v-icon>mdi-pencil</v-icon></v-btn>
                            <v-btn icon small @click="copyMailing(item)"><v-icon>mdi-content-copy</v-icon></v-btn>
                            <v-btn icon small @click="archiveMailing(item)" v-if="item.dateStarted && !item.archived"><v-icon>mdi-archive-arrow-down</v-icon></v-btn>
                            <v-btn icon small @click="deleteMailing(item)" v-if="!item.dateStarted"><v-icon>mdi-delete</v-icon></v-btn>
                            <v-btn icon small @click="startMailing(item)" v-if="item.status === 'paused' && !item.archived"><v-icon>mdi-play</v-icon></v-btn>
                            <v-btn icon small @click="stopMailing(item)" v-else-if="item.dateStarted && item.status !== 'finished' && !item.archived"><v-icon>mdi-pause</v-icon></v-btn>
                        </div>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import moment from "moment";

    function trimHTML(html) {
        if (!html) {
            return '';
        }

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
                refreshSeconds: 15,
                refreshIndervalId: false,
                isLoading: false,
                headers: [
                    {text: 'Дата начала', value: 'startAt'},
                    {text: 'Текст', value: 'preview'},
                    {text: 'Статус', value: 'status'},
                    {text: 'Прогресс', value: 'progress'},
                    {text: 'Успешно', value: 'success'},
                    {text: 'Блокировок', value: 'blocks'},
                    {text: 'Ошибок', value: 'errors'},
                    {text: 'Отправлено', value: 'processed'},
                    {text: 'Очередь', value: 'total'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            }
        },
        async mounted() {
            await this.loadMailings();
            this.startRefreshing();
        },
        beforeDestroy() {
            this.stopRefreshing();
        },
        methods: {
            async copyMailing(mailing) {
                let newMailing = {};
                const allowedFields = ['target', 'photos', 'videos', 'buttons', 'text', 'photoAsLink', 'isTest'];
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
            archiveMailing(mailing) {
                this.$store.dispatch('archiveMailing', mailing);
            },
            getFilter() {
                let hasBotRestrictions = this.$store.state.user.current && this.$store.state.user.current.botRights && this.$store.state.user.current.botRights.length > 0;
                let showAllBotsMailings = !hasBotRestrictions;
                let filterSingleBot = hasBotRestrictions && this.$store.state.user.current.botRights.length === 1;
                return this.$store.getters.allowedBotFilter('target.value', filterSingleBot, showAllBotsMailings);
            },
            async loadMailings() {
                this.isLoading = true;
                await this.$store.dispatch('loadMailings', this.getFilter());
                this.isLoading = false;
            },
            async silentLoadMailings() {
                await this.$store.dispatch('loadMailings', this.getFilter());
            },
            gotoMailingEdit(id) {
                this.$router.push({name: 'mailingEdit', params: {id}});
            },
            startMailing(mailing) {
                this.$store.dispatch('startMailing', mailing);
            },
            stopMailing(mailing) {
                this.$store.dispatch('stopMailing', mailing);
            },
            startRefreshing() {
                if (this.refreshSeconds > 0) {
                    this.refreshIndervalId = setInterval(this.silentLoadMailings, this.refreshSeconds * 1000);
                }
            },
            stopRefreshing() {
                if (this.refreshIndervalId) {
                    clearInterval(this.refreshIndervalId);
                }
            },
            itemClass(item) {
                return item.archived && item.archived > 0 ? 'row-archived' : '';
            }
        },
        computed: {
            mailings() {
                return this.isLoading ? [] : this.$store.state.mailing.list.map(mailing => {
                    let newMailing = clone(mailing);
                    newMailing.startAt = mailing.startAt ? moment.unix(mailing.startAt).format('DD.MM.YYYY HH:mm') : '-';
                    newMailing.preview = Array.from(trimHTML(mailing.text)).slice(0, 50).join('')+'...';
                    return newMailing;
                });
            },
            isEmpty() {
                return this.mailings.length === 0 && this.isLoading === false;
            }
        }
    }
</script>

<style>
    .row-archived {color: darkgray}
</style>