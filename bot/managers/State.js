function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

let state = {};

module.exports = function () {
    return {
        get(key) {
            return state && typeof (state[key]) !== 'undefined'
                ? clone(state[key])
                : null;
        },

        set(key, value) {
            state[key] = value;
        },

        add(key, value) {
            if (!(state[key] instanceof Array)) {
                state[key] = [];
            }

            state[key].push(value);
            return this.get(key);
        },

        delete(key, value) {
            if (!(state[key] instanceof Array)) {
                return;
            }

            let index = state[key].indexOf(value);
            if (index !== -1) {
                state[key].splice(index, 1);
            }

            return this.get(key);
        },

        has(key, value) {
            if (!(state[key] instanceof Array)) {
                return false;
            }

            return state[key] && state[key].indexOf(value) !== -1;
        },

        init(initialState) {
            state = clone(initialState);
        }
    }
}