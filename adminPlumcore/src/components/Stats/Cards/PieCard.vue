<template>
    <v-card :max-height="this.maxHeight+'px'">
        <v-card-title v-if="title">{{title}}</v-card-title>
        <v-card-text>
            <chartist
                    ratio="ct-octave"
                    type="Pie"
                    :data="items"
                    :options="options"
                    :style="'max-height: '+(this.maxHeight-80)+'px'"
            >
            </chartist>
        </v-card-text>
    </v-card>
</template>

<script>
    import LegendPlugin from "chartist-plugin-legend";

    export default {
        props: {
            maxHeight: {type: Number, default: 250},
            data: {type: Array},
            title: {type: String}
        },
        data() {
            return {
            }
        },
        computed: {
            items() {
                return {
                    series: this.data,
                }
            },
            options() {
                let sum = (a, b) => { return a + b.value };
                return {
                    height: (this.maxHeight-80)+'px',
                    plugins: [LegendPlugin({
                        legendNames: this.data.map(item => {
                            return `${item.name}, ${Math.round(item.value / this.data.reduce(sum, 0) * 100)}%`
                        }),
                    })]
                }
            }
        }
    }
</script>

<style scoped>

</style>