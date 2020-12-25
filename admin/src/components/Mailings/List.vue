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
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="gotoMailingEdit(item.id)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small @click="deleteMailing(item)"><v-icon>mdi-delete</v-icon></v-btn>
                        <v-btn icon small @click="stopMailing(item.id)"><v-icon>mdi-pause</v-icon></v-btn>
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
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            }
        },
        async mounted() {
            await this.loadMailings();
        },
        methods: {
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
            stopMailing() {

            }
        },
        computed: {
            mailings() {
                return this.isLoading ? [] : this.$store.state.mailing.list.map(mailing => {
                    let newMailing = clone(mailing);
                    newMailing.startAt = moment.unix(mailing.startAt).format('DD.MM.YYYY');
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