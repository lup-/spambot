const {getDb} = require('../modules/Database');
const PERF_ENABLED = process.env.PERF_MONITOR === "1";

function hasPerformance(ctx, code = false) {
    return code
        ? ctx._performance && ctx._performance[code] && ctx._performance[code].start
        : Boolean(ctx._performance);
}

module.exports = function () {
    return {

        start(code) {
            let ctx = this;

            if (!ctx._performance) {
                ctx._performance = {};
            }

            ctx._performance[code] = {code, start: new Date};
        },

        stop(code) {
            let ctx = this;

            if (code && hasPerformance(ctx, code)) {
                let perf = ctx._performance[code];
                perf.stop = new Date;
                perf.timeMs = perf.stop - perf.start;
                ctx._performance[code] = perf;
            }
        },

        async commit() {
            let ctx = this;
            if (hasPerformance(ctx)) {
                let perf = {time: ctx._performance};
                perf.commited = new Date;
                perf.userId = ctx.from ? ctx.from.id : false;

                let db = await getDb();
                return db.collection('performance').insertOne(perf);
            }
        },

        getMiddleware() {
            return (ctx, next) => {
                if (PERF_ENABLED) {
                    ctx.perfStart = this.start.bind(ctx);
                    ctx.perfStop = this.stop.bind(ctx);
                    ctx.perfCommit = this.commit.bind(ctx);
                }
                else {
                    ctx.perfStart = () => {};
                    ctx.perfStop = () => {};
                    ctx.perfCommit = () => {};
                }

                return next();
            }
        }
    }
}