<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>{{isNew ? 'Новый курс' : 'Редактирование курса'}}</v-card-title>
                    <v-card-text>
                        <v-form autocomplete="off">

                            <v-row class="mt-4">
                                <v-col cols="12">
                                    <v-text-field
                                            v-model="item.title"
                                            hint="Название курса"
                                            persistent-hint
                                    ></v-text-field>
                                </v-col>
                            </v-row>

                            <v-autocomplete
                                    :items="categories"
                                    v-model="item.categories"
                                    chips
                                    deletable-chips
                                    multiple
                                    item-text="title"
                                    item-value="id"
                                    label="Категории"
                            ></v-autocomplete>

                            <v-row class="mt-4">
                                <v-col cols="12">
                                    <v-text-field
                                            v-model="item.price"
                                            hint="Стоимость"
                                            persistent-hint
                                            type="number"
                                    ></v-text-field>
                                </v-col>
                            </v-row>

                            <v-row class="mt-4">
                                <v-col cols="12">
                                    <v-file-input
                                            ref="fileInput"
                                            v-model="file"
                                            @change="addFile"
                                            hint="Прикрепить файл"
                                            persistent-hint
                                    ></v-file-input>
                                </v-col>
                            </v-row>

                            <v-row class="my-4" v-if="files && files.length > 0">
                                <v-col cols="12">Файлы:</v-col>
                                <v-col cols="12">
                                    <v-chip v-for="(file, index) in files" :key="file.name"
                                            class="mr-2 mb-2"
                                            close
                                            close-icon="mdi-delete"
                                            @click:close="deleteFile(index)"
                                    >
                                        {{file.name}}
                                    </v-chip>
                                </v-col>
                            </v-row>

                            <v-row class="mt-4">
                                <v-col cols="12">
                                    <vue-trix
                                            v-model="item.description"
                                            @trix-file-accept="addPhoto"
                                    ></vue-trix>
                                </v-col>
                            </v-row>

                            <v-row class="my-4">
                                <v-col cols="12">
                                    <v-chip v-for="(photo, index) in item.photos" :key="photo.name"
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
    import axios from "axios";
    import CrudEdit from '@/components/CrudEdit';

    export default {
        extends: CrudEdit,
        data() {
            return {
                item: {},
                file: null,
                files: [],

                ACTION_LOAD: 'course/loadItems',
                ACTION_NEW: 'course/newItem',
                ACTION_SAVE: 'course/saveItem',
                ACTION_SET_EDIT_ITEM: 'course/setEditItem',
                ROUTE_LIST: 'coursesList',
                STORE_MODULE: 'course'
            }
        },
        async created() {
            if (this.itemId) {
                if (this.allItems.length === 0) {
                    await this.$store.dispatch(this.ACTION_LOAD);
                }

                this.$store.dispatch(this.ACTION_SET_EDIT_ITEM, this.itemId);
                this.$store.dispatch('category/loadItems');
            }
        },
        watch: {
            storeItem() {
                if (this.storeItem) {
                    this.item = this.storeItem;
                    this.files = this.storeItem.files || [];
                }
            },
        },
        methods: {
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
            async addPhoto(event) {
                event.preventDefault();

                let file = event.file;
                let buffer = await this.loadToBrowser(file);
                let base64Src = this.arrayBufferToBase64(buffer);
                let dataUrl = `data:${file.type};base64,${base64Src}`;

                if (!this.item.photos) {
                    this.$set(this.item, 'photos', []);
                }

                this.item.photos.push({
                    buffer,
                    file,
                    src: dataUrl,
                    type: file.type,
                    name: file.name,
                });
            },
            deletePhoto(index) {
                this.item.photos.splice(index, 1);
            },
            async prepareFiles() {
                let fileUploads = this.files.map(this.loadToBrowser);
                let files = await Promise.all(fileUploads);
                let filesToSave = files.map((buffer, index) => {
                    let file = fileUploads[index];
                    let base64Src = this.arrayBufferToBase64(buffer);
                    let dataUrl = `data:${file.type};base64,${base64Src}`;
                    return {
                        buffer,
                        file,
                        src: dataUrl,
                        type: file.type,
                        name: file.name,
                    }
                });

                return filesToSave;
            },
            async save() {
                this.item.files = this.files;
                this.item.price = parseFloat(this.item.price) || 0;

                if (this.isNew()) {
                    await this.$store.dispatch(this.ACTION_NEW, this.item);
                }
                else {
                    await this.$store.dispatch(this.ACTION_SAVE, this.item);
                }

                return this.gotoList();
            },

            async uploadToServer(file) {
                let requestData = new FormData();
                requestData.append('file', file);

                let {data} = await axios.post( '/api/file/link',
                    requestData,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );

                return data;
            },

            async addFile(file) {
                if (!file) {
                    return;
                }
                let uploadData = await this.uploadToServer(file);

                if (!this.files) {
                    this.files = [];
                }

                this.files.push({
                    file,
                    serverFile: uploadData.file,
                    src: uploadData.link,
                    type: file.type,
                    name: file.name,
                });

                this.file = null;
            },

            async deleteFile(index) {
                let file = this.files[index];
                let isValidFile = file && file.serverFile;

                if (isValidFile) {
                    let {data} = await axios.post('/api/file/delete', {file: file.serverFile});
                    if (data.success) {
                        this.files.splice(index, 1);
                    }
                    else {
                        this.$store.commit('setErrorMessage', 'Ошибка удаления файла: ' + data.error);
                    }
                }

                this.files.splice(index, 1);
            }
        },
        computed: {
            categories() {
                return this.$store.state.category.list;
            }
        }
    }
</script>

<style scoped>

</style>