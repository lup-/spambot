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