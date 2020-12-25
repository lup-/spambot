<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>Доступ крефкам</v-card-title>
                    <v-card-text>
                        <v-form autocomplete="off">
                            <v-row>
                                <v-col cols="12">
                                    <v-autocomplete
                                            :items="bots"
                                            v-model="refBots"
                                            chips
                                            deletable-chips
                                            multiple
                                            label="Боты"
                                    ></v-autocomplete>
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col cols="12">
                                    <v-autocomplete
                                            :items="allRefs"
                                            v-model="refs"
                                            chips
                                            deletable-chips
                                            multiple
                                            label="Рефки"
                                    ></v-autocomplete>
                                </v-col>
                            </v-row>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="$router.push({name: 'refUsersList'})">К списку</v-btn>
                        <v-btn large color="primary" @click="save">Сохранить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "RefUserEdit",
        data() {
            return {
                refBots: [],
                refs: [],
            }
        },
        async created() {
            if (this.userId) {
                let usersLoaded = this.refUsers && this.refUsers.length > 0;
                if (!usersLoaded) {
                    await this.$store.dispatch('loadRefUsers');
                }

                return this.$store.dispatch('setCurrentRefUser', this.userId);
            }
        },
        watch: {
            userId() {
                this.$store.dispatch('setCurrentRefUser', this.userId);
            },
            refUsers() {
                if (this.userId) {
                    this.$store.dispatch('setCurrentRefUser', this.userId);
                }
            },
            refUser() {
                if (this.refUser && this.refUser.refs) {
                    this.refBots = this.refUser.refs.map(ref => {
                        let [botName] = ref.split(':');
                        return botName;
                    }).filter((botName, index, allNames) => allNames.indexOf(botName) === index);

                    this.refs = this.refUser.refs || [];
                }
                else {
                    this.refBots = [];
                }
            },
            refBots() {
                this.$store.dispatch('loadBotRefs', {botIds: this.refBots});
            }
        },
        methods: {
            async save() {
                let refUser = this.refUser;
                refUser.refs = this.refs;
                await this.$store.dispatch('editRefUser', refUser);
                this.$router.push({name: 'refUsersList'});
            },
        },
        computed: {
            userId() {
                return (this.$route.params && this.$route.params.id) || false;
            },
            refUser() {
                return this.$store.state.stats.currentRefUser;
            },
            refUsers() {
                return this.$store.state.stats.refUsersList;
            },
            bots() {
                return this.$store.state.bots.list.map(bot => {
                    let userName = this.$store.getters.botTgField(bot.botName, 'username')
                    return {text: `${bot.botName} (@${userName})`, value: bot.botName};
                });
            },
            allRefs() {
                return this.$store.state.stats.botRefs.reduce((refs, botRefs) => {
                    let botId = botRefs.botId;
                    return refs.concat( botRefs.refs.map(ref => `${botId}:${ref}`) )
                }, []);
            }
        }
    }
</script>

<style scoped>

</style>