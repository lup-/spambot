<template>
    <v-container class="fill-height align-start">
        <v-row :align="isEmpty || isLoading ? 'center' : 'start'" :justify="isEmpty || isLoading ? 'center' : 'start'">
            <v-btn fab bottom right fixed large color="primary"
                    @click="$router.push({name: 'vacancyNew'})"
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>

            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="headers"
                        :items="vacancies"
                        :loading="isLoading"
                        :items-per-page="50"
                >
                    <template v-slot:item.remote="{ item }">
                        <v-simple-checkbox v-model="item.remote" disabled></v-simple-checkbox>
                    </template>
                    <template v-slot:item.internship="{ item }">
                        <v-simple-checkbox v-model="item.internship" disabled></v-simple-checkbox>
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="gotoVacancyEdit(item.id)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small @click="deleteVacancy(item)"><v-icon>mdi-delete</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "VacanciesList",
        data() {
            return {
                isLoading: true,
                headers: [
                    {text: 'Название', value: 'name'},
                    {text: 'Город', value: 'city'},
                    {text: 'Удаленка', value: 'remote'},
                    {text: 'Стажировка', value: 'internship'},
                    {text: 'Боты', value: 'bots'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            }
        },
        async mounted() {
            await this.loadVacancies();
        },
        methods: {
            deleteVacancy(vacancy) {
                this.$store.dispatch('deleteVacancy', vacancy);
            },
            async loadVacancies() {
                this.isLoading = true;
                let showAllBotsVacancies = !this.ignoreCommonVacancies;
                let filter = this.$store.getters.allowedBotFilter('bots', false, showAllBotsVacancies);
                await this.$store.dispatch('loadVacancies', filter);
                this.isLoading = false;
            },
            gotoVacancyEdit(id) {
                this.$router.push({name: 'vacancyEdit', params: {id}});
            },
        },
        computed: {
            vacancies() {
                return this.isLoading ? [] : this.$store.state.vacancy.list;
            },
            isEmpty() {
                return this.vacancies.length === 0 && this.isLoading === false;
            },
            ignoreCommonVacancies() {
                let allSettings = this.$store.getters.botSettings(this.$store.getters.allowedBotNames);
                let vacancyBotsSettings = allSettings.filter(setting => setting.botType === 'vacancies');
                let hasRestrictionToBot = vacancyBotsSettings.every(bot => bot.restrictToBot);

                return hasRestrictionToBot;
            }
        }
    }
</script>

<style scoped>

</style>