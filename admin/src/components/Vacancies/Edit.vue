<template>
    <v-container class="fill-height">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>{{isNew ? 'Новая вакансия' : 'Редактирование вакансии'}}</v-card-title>
                    <v-card-text>
                        <v-text-field readonly v-if="!isNew" :value="linkTemplate"></v-text-field>
                        <v-form autocomplete="off">
                            <v-switch v-model="vacancy.remote" label="Удаленка"></v-switch>
                            <v-switch v-model="vacancy.internship" label="Стажировка"></v-switch>

                            <v-combobox
                                    v-model="vacancy.name"
                                    :items="names"
                                    :loading="namesLoading"
                                    :search-input.sync="searchName"
                                    no-data-text="Начните набирать, чтобы увидеть подсказки"
                                    label="Название вакансии"
                                    :return-object="false"
                            ></v-combobox>
                            <v-combobox
                                    v-if="!vacancy.remote"
                                    v-model="vacancy.city"
                                    :items="cities"
                                    :loading="citiesLoading"
                                    :search-input.sync="searchCity"
                                    no-data-text="Начните набирать, чтобы увидеть подсказки"
                                    label="Город"
                                    :return-object="false"
                            ></v-combobox>
                            <v-autocomplete
                                    :items="categories"
                                    v-model="vacancy.categories"
                                    chips
                                    deletable-chips
                                    multiple
                                    label="Категории"
                            ></v-autocomplete>
                            <v-textarea
                                    v-model="vacancy.responsibilities"
                                    label="Обязанности"
                            ></v-textarea>
                            <v-textarea
                                    v-model="vacancy.conditions"
                                    label="Условия"
                            ></v-textarea>
                            <v-textarea
                                    v-model="vacancy.requirements"
                                    label="Требования"
                            ></v-textarea>
                            <v-row>
                                <v-col cols="12" md="4">
                                    <v-text-field v-model="vacancy.salary.from" label="Зарплата, от"></v-text-field>
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-text-field v-model="vacancy.salary.to" label="Зарплата, до"></v-text-field>
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-combobox v-model="vacancy.salary.currency" :items="currencies" label="Валюта"></v-combobox>
                                </v-col>
                            </v-row>
                            <v-textarea
                                    v-model="vacancy.contacts"
                                    label="Контакты"
                            ></v-textarea>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="$router.push({name: 'vacanciesList'})">К списку</v-btn>
                        <v-btn large color="primary" @click="save">Сохранить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import axios from "axios";

    export default {
        name: "VacancyEdit",
        data() {
            return {
                vacancy: {salary: {}},
                defaultVacancy: {salary: {}},
                currencies: ['руб', 'usd', 'eur'],

                cities: [],
                citiesLoading: false,
                searchCity: null,

                names: [],
                namesLoading: false,
                searchName: null,
            }
        },
        async created() {
            if (this.vacancyId) {
                if (this.allVacancies.length === 0) {
                    await this.$store.dispatch('loadVacancies');
                }

                this.$store.dispatch('setCurrentVacancy', this.vacancyId);
            }
            await this.$store.dispatch('loadCategories');
        },
        watch: {
            vacancyId() {
                this.$store.dispatch('setCurrentVacancy', this.vacancyId);
            },
            allVacancies: {
                deep: true,
                handler() {
                    if (this.vacancyId) {
                        this.$store.dispatch('setCurrentVacancy', this.vacancyId);
                    }
                }
            },
            storeVacancy() {
                if (this.storeVacancy) {
                    this.vacancy = this.storeVacancy;
                }
                else {
                    this.vacancy = this.defaultVacancy;
                }
            },
            async searchCity(val) {
                if (this.citiesLoading) {
                    return;
                }

                if (val.length < 3) {
                    return;
                }

                try {
                    this.citiesLoading = true;
                    let response = await axios.get('https://api.hh.ru/suggests/areas', {
                        params: {
                            text: val,
                            locale: 'RU'
                        }
                    });

                    this.cities = response.data && response.data.items
                        ? response.data.items.map(suggest => ({text: suggest.text, value: suggest.text}))
                        : [];
                }
                finally {
                    this.citiesLoading = false;
                }

                return this.cities;
            },
            async searchName(val) {
                if (this.namesLoading) {
                    return;
                }

                if (val.length < 3) {
                    return;
                }

                try {
                    this.namesLoading = true;
                    let response = await axios.get('https://api.hh.ru/suggests/positions', {
                        params: {
                            text: val
                        }
                    });

                    this.names = response.data && response.data.items
                        ? response.data.items.map(suggest => ({text: suggest.text, value: suggest.text}))
                        : [];
                }
                finally {
                    this.namesLoading = false;
                }

                return this.names;
            }
        },
        methods: {
            async save() {
                if (this.isNew) {
                    await this.$store.dispatch('newVacancy', this.vacancy);
                }
                else {
                    await this.$store.dispatch('editVacancy', this.vacancy);
                }

                await this.$router.push({name: 'vacanciesList'});
            },
        },
        computed: {
            isNew() {
                return !(this.$route.params && this.$route.params.id);
            },
            vacancyId() {
                return (this.$route.params && this.$route.params.id) || false;
            },
            storeVacancy() {
                return this.$store.state.vacancy.current;
            },
            allVacancies() {
                return this.$store.state.vacancy.list;
            },
            categories() {
                return this.$store.state.vacancy.categories
                    ? this.$store.state.vacancy.categories.map(item => ({text: item.title, value: item.id}))
                    : [];
            },
            botId() {
                if (this.vacancy.internship) {
                    return 'traineeship_bot';
                }
                else if (this.vacancy.remote) {
                    return 'BeemBam_bot';
                }
                else {
                    return 'WorkHantbot';
                }
            },
            linkTemplate() {
                return `https://t.me/${this.botId}?start=<ref>=${this.vacancyId}`;
            }
        }
    }
</script>

<style scoped>

</style>