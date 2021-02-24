<script>
    export default {
        data() {
            return {
                item: {},

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
            }
        },
        watch: {
            itemId() {
                this.$store.dispatch(this.ACTION_SET_EDIT_ITEM, this.itemId);
            },
            allItems: {
                deep: true,
                handler() {
                    if (this.itemId) {
                        this.$store.dispatch(this.ACTION_SET_EDIT_ITEM, this.itemId);
                    }
                }
            },
            storeItem() {
                if (this.storeItem) {
                    this.item = this.storeItem;
                }
            },
        },
        methods: {
            isNew() {
                return !(this.$route.params && this.$route.params.id);
            },
            async save() {
                if (this.isNew()) {
                    await this.$store.dispatch(this.ACTION_NEW, this.item);
                }
                else {
                    await this.$store.dispatch(this.ACTION_SAVE, this.item);
                }

                return this.gotoList();
            },
            gotoList() {
                return this.$router.push({name: this.ROUTE_LIST});
            }
        },
        computed: {
            itemId() {
                return this.$route.params && this.$route.params.id
                    ? this.$route.params.id || false
                    : false;
            },
            storeItem() {
                return this.$store.state[this.STORE_MODULE].edit;
            },
            allItems() {
                return this.$store.state[this.STORE_MODULE].list;
            },
        }
    }
</script>