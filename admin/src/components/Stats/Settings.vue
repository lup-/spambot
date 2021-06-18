<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>Настройки бота {{botName}}</v-card-title>
                    <v-card-text>
                        <v-form autocomplete="off">
                            <v-combobox v-model="needsSubscription"
                                label="Требовать подписку"
                                multiple
                                chips
                                deletable-chips
                                hint="Например: @vcblr"
                                persistent-hint
                            ></v-combobox>
                            <v-select v-model="settings.botType"
                                class="mt-4"
                                label="Тип бота"
                                :items="botTypes"
                            ></v-select>
                            <v-switch v-model="settings.useCustomCategories" v-if="settings.botType === 'vacancies'"
                                label="Использовать собственные категории"
                            ></v-switch>
                            <v-switch v-model="settings.restrictToBot" v-if="settings.botType === 'vacancies'"
                                    label="Показывать только вакансии этого бота и игнорировать общие"
                            ></v-switch>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="gotoList">К списку</v-btn>
                        <v-btn large color="primary" @click="save">Сохранить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "BotSettings",
        data() {
            return {
                settings: {},
                needsSubscription: [],
                defaultSettings: {},
                botTypes: [
                    {text: 'Поиск книг', value: 'books'},
                    {text: 'Стартапы и бизнес-идеи', value: 'business'},
                    {text: 'Купоны и скидки', value: 'coupons'},
                    {text: 'Знакомства', value: 'dating'},
                    {text: 'Энциклопедия болезней', value: 'disease'},
                    {text: 'Энциклопедия фамилий', value: 'familyname'},
                    {text: 'Фильмы и сериалы', value: 'film'},
                    {text: 'Финансовые советы (подписка)', value: 'finance'},
                    {text: 'Финансовые советы (каталог)', value: 'fincat'},
                    {text: 'Гороскопы', value: 'horoscope'},
                    {text: 'Генератор ссылок', value: 'linker'},
                    {text: 'Проверка текста', value: 'orfo'},
                    {text: 'ПДД', value: 'pdd'},
                    {text: 'Подкасты', value: 'podcasts'},
                    {text: 'Подарки', value: 'present'},
                    {text: 'Болезнь по симптомам', value: 'symptoms'},
                    {text: 'Напомнить о делах', value: 'todo'},
                    {text: 'Вакансии', value: 'vacancies'},
                    {text: 'Википедия', value: 'wikipedia'},
                    {text: 'Скачка видео', value: 'ytdlc'},
                ],
            }
        },
        async created() {
            if (this.botName) {
                await this.$store.dispatch('loadSettings', this.botName);
                this.initSettings();
            }
        },
        watch: {
            botName() {
                this.$store.dispatch('loadSettings', this.botName);
            },
            storeSettings() {
                this.initSettings();
            },
        },
        methods: {
            initSettings() {
                if (this.storeSettings) {
                    this.settings = this.storeSettings;
                    this.needsSubscription = this.settings.needsSubscription instanceof Array
                        ? this.settings.needsSubscription
                        : [ this.settings.needsSubscription ];
                }
                else {
                    this.settings = this.defaultSettings;
                }
            },
            async save() {
                this.settings.botName = this.botName;
                this.settings.needsSubscription = this.needsSubscription;
                await this.$store.dispatch('saveSettings', this.settings);
                this.gotoList();
            },
            gotoList() {
                this.$router.push({name: 'stats'});
            }
        },
        computed: {
            botName() {
                return (this.$route.params && this.$route.params.botName) || false;
            },
            storeSettings() {
                return this.$store.state.bots.settings;
            },
        }
    }
</script>

<style scoped>

</style>