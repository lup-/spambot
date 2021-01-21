<template>
    <v-container class="fill-height">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>{{isNew ? 'Новая рассылка' : 'Редактирование рассылка'}}</v-card-title>
                    <v-card-text>
                        <v-form autocomplete="off">
                            <v-dialog
                                    v-model="showNewTarget"
                                    persistent
                                    max-width="600px"
                            >
                                <template v-slot:activator="{ on, attrs }">
                                    <v-btn v-bind="attrs" v-on="on">
                                        Добавить таргет
                                    </v-btn>
                                </template>
                                <v-card>
                                    <v-card-title>Добавить таргет</v-card-title>
                                    <v-card-text>
                                        <v-container>
                                            <v-row>
                                                <v-col cols="12" md="5">
                                                    <v-select
                                                            :items="targetTypes"
                                                            v-model="targetType"
                                                            label="Поле"
                                                    ></v-select>
                                                </v-col>
                                                <v-col cols="12" md="2" v-if="targetHasCmp">
                                                    <v-select :items="['>', '<', '=', '!=']" v-model="targetCmp"></v-select>
                                                </v-col>
                                                <v-col cols="12" md="2" v-else></v-col>
                                                <v-col cols="12" md="5" v-if="targetType === 'bots'">
                                                    <v-autocomplete
                                                            :items="bots"
                                                            v-model="targetValue"
                                                            chips
                                                            deletable-chips
                                                            multiple
                                                            label="Боты"
                                                    ></v-autocomplete>
                                                </v-col>
                                                <v-col cols="12" md="5" v-else-if="targetIsDate">
                                                    <v-menu
                                                            v-model="menuTargetDate"
                                                            :close-on-content-click="false"
                                                            transition="scale-transition"
                                                            offset-y
                                                            max-width="290px"
                                                            min-width="290px"
                                                    >
                                                        <template v-slot:activator="{ on, attrs }">
                                                            <v-text-field
                                                                    v-model="targetDateFormatted"
                                                                    label="Начало рассылки"
                                                                    hint="В формате 31.12.2020"
                                                                    persistent-hint
                                                                    prepend-icon="mdi-calendar"
                                                                    v-bind="attrs"
                                                                    @blur="targetDate = parseDate(targetDateFormatted)"
                                                                    v-on="on"
                                                            ></v-text-field>
                                                        </template>
                                                        <v-date-picker
                                                                v-model="targetDate"
                                                                no-title
                                                                @input="menuTargetDate = false"
                                                        ></v-date-picker>
                                                    </v-menu>
                                                </v-col>
                                                <v-col cols="12" md="5" v-else>
                                                    <v-text-field
                                                            label="Значение"
                                                            v-model="targetValue"
                                                    ></v-text-field>
                                                </v-col>
                                            </v-row>
                                        </v-container>
                                    </v-card-text>
                                    <v-card-actions>
                                        <v-spacer></v-spacer>
                                        <v-btn text @click="showNewTarget = false">
                                            Закрыть
                                        </v-btn>
                                        <v-btn text @click="addTarget">
                                            Добавить
                                        </v-btn>
                                    </v-card-actions>
                                </v-card>
                            </v-dialog>
                            <v-row>
                                <v-col cols="12">
                                    <v-chip v-for="(item, index) in target" :key="item.type+index"
                                            class="mr-2 mb-2"
                                            close
                                            close-icon="mdi-delete"
                                            @click:close="deleteTarget(index)"
                                    >
                                        {{getTargetText(item)}}
                                    </v-chip>
                                </v-col>
                            </v-row>
                            <v-row v-if="predictedUsers !== false">
                                <v-col cols="12">
                                    Примерное количество получателей: {{predictedUsers}}
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col cols="12" md="6">
                                    <v-menu
                                            v-model="menuDate"
                                            :close-on-content-click="false"
                                            transition="scale-transition"
                                            offset-y
                                            max-width="290px"
                                            min-width="290px"
                                    >
                                        <template v-slot:activator="{ on, attrs }">
                                            <v-text-field
                                                    v-model="startDateFormatted"
                                                    label="Начало рассылки"
                                                    hint="В формате 31.12.2020"
                                                    persistent-hint
                                                    prepend-icon="mdi-calendar"
                                                    v-bind="attrs"
                                                    @blur="startDate = parseDate(startDateFormatted)"
                                                    v-on="on"
                                            ></v-text-field>
                                        </template>
                                        <v-date-picker
                                                v-model="startDate"
                                                no-title
                                                @input="menuDate = false"
                                        ></v-date-picker>
                                    </v-menu>
                                </v-col>
                                <v-col cols="12" md="6">
                                    <v-menu
                                            ref="menuTime"
                                            v-model="menuTime"
                                            :close-on-content-click="false"
                                            :nudge-right="40"
                                            :return-value.sync="startTime"
                                            transition="scale-transition"
                                            offset-y
                                            max-width="290px"
                                            min-width="290px"
                                    >
                                        <template v-slot:activator="{ on, attrs }">
                                            <v-text-field
                                                    v-model="startTime"
                                                    prepend-icon="mdi-clock-time-four-outline"
                                                    hint="В формате 14:21"
                                                    persistent-hint
                                                    v-bind="attrs"
                                                    v-on="on"
                                            ></v-text-field>
                                        </template>
                                        <v-time-picker
                                                v-if="menuTime"
                                                v-model="startTime"
                                                format="24hr"
                                                no-title
                                                full-width
                                                @click:minute="$refs.menuTime.save(startTime)"
                                        ></v-time-picker>
                                    </v-menu>
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col cols="12">
                                    <v-checkbox
                                        v-model="mailing.photoAsLink"
                                        label="Фото внизу"
                                    ></v-checkbox>
                                    <v-checkbox
                                            v-model="mailing.disablePreview"
                                            label="Отключить предпросмотр ссылок"
                                    ></v-checkbox>
                                    <v-checkbox
                                            v-model="mailing.disableNotification"
                                            label="Отключить оповещения"
                                    ></v-checkbox>
                                </v-col>
                            </v-row>
                            <v-row class="mt-4">
                                <v-col cols="12">
                                    <vue-trix
                                            v-model="mailing.text"
                                            @trix-file-accept="addFile"
                                    ></vue-trix>
                                </v-col>
                            </v-row>
                            <v-row class="my-4">
                                <v-col cols="12">
                                    <v-chip v-for="(photo, index) in photos" :key="photo.name"
                                            class="mr-2 mb-2"
                                            close
                                            close-icon="mdi-delete"
                                            @click:close="deletePhoto(index)"
                                    >
                                        <v-avatar left>
                                            <v-img :src="photo.src"></v-img>
                                        </v-avatar>
                                        {{photo.name}}
                                    </v-chip>
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col cols="12" md="4">
                                    <v-btn @click="addButton">Добавить кнопку к сообщению</v-btn>
                                </v-col>
                            </v-row>
                            <v-row v-for="(button, index) in buttons" :key="index">
                                <v-col cols="12" md="6">
                                    <v-text-field
                                            label="Текст на кнопке"
                                            v-model="button.text"
                                    ></v-text-field>
                                </v-col>
                                <v-col cols="12" md="6">
                                    <v-text-field
                                            label="Ссылка"
                                            v-model="button.link"
                                    ></v-text-field>
                                    <v-btn @click="removeButton(index)">Удалить</v-btn>
                                </v-col>
                            </v-row>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-row align="end">
                            <v-col cols="12" md="6">
                                <v-select class="mr-2"
                                        :items="testUsers"
                                        v-model="testUser"
                                        label="Тестировать на"
                                ></v-select>
                                <v-btn @click="sendPreview" :disabled="!testUser">Предпросмотр в боте</v-btn>
                            </v-col>
                            <v-col cols="12" md="6">
                                <v-btn @click="$router.push({name: 'mailingList'})" class="mr-2">К списку</v-btn>
                                <v-btn large color="primary" @click="save">Сохранить</v-btn>
                            </v-col>
                        </v-row>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
        <v-row justify="center">
        </v-row>
    </v-container>
</template>

<script>
    import moment from "moment";
    import axios from "axios";

    export default {
        name: "MailingEdit",
        data() {
            return {
                mailing: {},
                predictedUsers: false,
                defaultMailing: {disablePreview: true},
                photos: [],
                buttons: [],
                target: [],
                targetTypes: [
                    {text: 'Боты', value: 'bots'},
                    {text: 'Последняя активность', value: 'activity'},
                    {text: 'Дата регистрации', value: 'register'},
                    {text: 'Дате рассылки', value: 'mailing'},
                ],
                targetType: false,
                targetCmp: false,
                menuTargetDate: false,
                targetDate: moment().format('YYYY-MM-DD'),
                targetDateFormatted: moment().format('DD.MM.YYYY'),
                targetValue: [],
                menuDate: false,
                menuTime: false,
                showNewTarget: false,
                startTime: moment().startOf('h').add(1, 'h').format('HH:mm'),
                startDate: moment().format('YYYY-MM-DD'),
                startDateFormatted: moment().format('DD.MM.YYYY'),
                testUsers: [],
                testUser: false,
            }
        },
        async created() {
            if (this.mailingId) {
                if (this.allMailings.length === 0) {
                    await this.$store.dispatch('loadMailings');
                }

                this.$store.dispatch('setCurrentMailing', this.mailingId);
            }
            this.updateMailingDate();
            await this.loadTestUsers();
        },
        watch: {
            target: {
                deep: true,
                async handler() {
                    await this.loadPredictedUsers();
                }
            },
            mailingId() {
                this.$store.dispatch('setCurrentMailing', this.mailingId);
            },
            allMailings: {
                deep: true,
                handler() {
                    if (this.mailingId) {
                        this.$store.dispatch('setCurrentMailing', this.mailingId);
                    }
                }
            },
            storeMailing() {
                if (this.storeMailing) {
                    this.mailing = this.storeMailing;

                    if (this.mailing.startAt) {
                        let mailingDate = moment.unix(this.mailing.startAt);

                        this.startTime = mailingDate.format('HH:mm');
                        this.startDate = mailingDate.format('YYYY-MM-DD');
                        this.startDateFormatted = mailingDate.format('DD.MM.YYYY');
                    }

                    this.target = this.mailing.target;
                    this.photos = this.mailing.photos;
                    this.buttons = this.mailing.buttons;
                }
                else {
                    this.mailing = this.defaultMailing;
                }
            },
            startTime() {
                this.updateMailingDate();
            },
            startDate () {
                this.startDateFormatted = this.formatDate(this.startDate);
                this.updateMailingDate();
            },
            targetDate () {
                this.targetDateFormatted = this.formatDate(this.targetDate);
            }
        },
        methods: {
            getMailingToSend() {
                let mailing = this.mailing;
                mailing.target = this.target;
                mailing.photos = this.photos;
                mailing.buttons = this.buttons;

                return mailing;
            },
            async save() {
                let mailing = this.getMailingToSend();

                if (this.isNew) {
                    await this.$store.dispatch('newMailing', mailing);
                }
                else {
                    await this.$store.dispatch('editMailing', mailing);
                }

                await this.$router.push({name: 'mailingList'});
            },
            async loadToBrowser(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsArrayBuffer(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
            },
            arrayBufferToBase64( buffer ) {
                let binary = '';
                let bytes = new Uint8Array( buffer );
                let len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode( bytes[ i ] );
                }
                return btoa( binary );
            },
            async addFile(event) {
                event.preventDefault();

                let file = event.file;
                let buffer = await this.loadToBrowser(file);
                let base64Src = this.arrayBufferToBase64(buffer);
                let dataUrl = `data:${file.type};base64,${base64Src}`;

                if (this.mailing.photoAsLink) {
                    this.photos = [];
                }

                this.photos.push({
                    buffer,
                    file,
                    src: dataUrl,
                    type: file.type,
                    name: file.name,
                });
            },
            parseDate (date) {
                if (!date) return null

                const [day, month, year] = date.split('.')
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            },
            formatDate (date) {
                if (!date) return null

                const [year, month, day] = date.split('-')
                return `${day}.${month}.${year}`
            },
            updateMailingDate() {
                let date = this.startDate
                    ? moment( this.startDate ).startOf('d')
                    : moment().startOf('d');

                if (this.startTime) {
                    let [hh, mm] = this.startTime.split(':');
                    date.set({'hour': parseInt(hh), 'minute': parseInt(mm), 'second': 0});
                }

                this.mailing.startAt = date.unix();
            },
            addButton() {
                this.buttons.push({text: '', link: ''});
            },
            removeButton(index = 0) {
                this.buttons.splice(index, 1);
            },
            deletePhoto(index) {
                this.photos.splice(index, 1);
            },
            resetTargetValues() {
                this.targetType = false;
                this.targetCmp = false;
                this.menuTargetDate = false;
                this.targetDate = moment().format('YYYY-MM-DD');
                this.targetDateFormatted = moment().format('DD.MM.YYYY');
                this.targetValue = [];
                this.showNewTarget = false;
            },
            addTarget() {
                let target = {
                    type: this.targetType,
                    cmp: this.targetHasCmp ? this.targetCmp : false,
                    value: this.targetIsDate ? this.targetDate : this.targetValue,
                }

                this.target.push(target);
                this.resetTargetValues();
            },
            deleteTarget(index) {
                this.target.splice(index, 1);
            },
            getTargetText(item) {
                if (item.type === 'bots') {
                    return `Боты: ${item.value.length} шт.`;
                }

                return `${item.type} ${item.cmp || ''} ${this.formatDate(item.value)}`;
            },
            async loadPredictedUsers() {
                let mailing = this.getMailingToSend();
                let response = await axios.post(`/api/mailing/predictUsers`, {mailing});
                this.predictedUsers = response && response.data ? response.data.count : false;
            },
            async loadTestUsers() {
                let response = await axios.post(`/api/mailing/testUsers`);
                this.testUsers = response && response.data
                    ? response.data.users.map(user => ({
                        text: [user.user.first_name, user.user.last_name].join(' ')+' (@'+user.user.username+')',
                        value: user.chat.id
                    }))
                    : [];
            },
            async sendPreview() {
                let mailing = this.getMailingToSend();
                let chatId = this.testUser;
                let response = await axios.post(`/api/mailing/preview`, {mailing, chatId});
                if (response && response.data && response.data.error) {
                    this.$store.commit('setErrorMessage', response.data.error.description);
                }
            }
        },
        computed: {
            isNew() {
                return !(this.$route.params && this.$route.params.id);
            },
            mailingId() {
                return (this.$route.params && this.$route.params.id) || false;
            },
            storeMailing() {
                return this.$store.state.mailing.current;
            },
            allMailings() {
                return this.$store.state.mailing.list;
            },
            bots() {
                return this.$store.state.bots.list.map(bot => {
                    return {text: bot.botName, value: bot.botName};
                });
            },
            targetIsDate() {
                return this.targetType !== 'bots';
            },
            targetHasCmp() {
                return this.targetType !== 'bots';
            }
        }
    }
</script>

<style scoped>

</style>