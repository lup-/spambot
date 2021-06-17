import axios from "axios";

export default {
    state: {
        serviceStatues: [],
        systemOk: null,
        lastError: null,
        restartInProgress: false,
    },
    actions: {
        async loadSystemStatus({commit}) {
            let response = await axios.get(`/api/system/status`);
            return commit('setStatus', response.data);
        },

        async restartSystem({commit, dispatch}) {
            let response = await axios.get(`/api/system/restart`);
            let isWaiting = response.data.waiting;
            commit('setRestartProgress', isWaiting);

            let waitTimeoutSec = 600;
            let waitTimeSec = 0;
            let pollIntervalMs = 10000;
            let intervalId = null;

            return new Promise((resolve, reject) => {
                intervalId = setInterval(async () => {
                    let statusResponse = await axios.get(`/api/system/restartStatus`);
                    if (statusResponse.data.waiting === false) {
                        let hasError = statusResponse.data.error !== null;
                        clearInterval(intervalId);
                        commit('setRestartProgress', false);

                        if (hasError) {
                            await commit('setErrorMessage', `Ошибка перезагрузки: ${statusResponse.data.error}`, {root: true});
                            await commit('setLastError', statusResponse.data.error);
                            return reject(statusResponse.data.error);
                        }
                        else {
                            await commit('setSuccessMessage', 'Система успешно перезагружена!', {root: true});
                            await commit('setLastError', null);
                            await dispatch('loadSystemStatus');
                            return resolve();
                        }
                    }

                    waitTimeSec += pollIntervalMs/1000;
                    if (waitTimeSec >= waitTimeoutSec) {
                        let errorText = 'Превышено время ожидания перезагрузки системы!';
                        clearInterval(intervalId);
                        await commit('setRestartProgress', false);
                        await commit('setErrorMessage', errorText, {root: true});
                        await commit('setLastError', errorText);
                        return reject(errorText);
                    }
                }, pollIntervalMs);
            });

        }
    },
    mutations: {
        setStatus(state, status) {
            state.systemOk = status.everythingOk;
            state.serviceStatues = status.serviceStatuses;
            state.lastError = status.error;
        },
        setRestartProgress(state, isInProgress) {
            state.restartInProgress = isInProgress;
        },
        setLastError(state, error) {
            state.lastError = error;
        }
    }
}