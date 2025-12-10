// util.js — for additional SmartThings API interactions
//

/**
 * Get device status
 * @param {Object} contextOrApi - The context or API object
 * @param {string} deviceId - The device ID
 */
async function getDeviceStatus(contextOrApi, deviceId) {
    // context.api or just api
    const api = contextOrApi.api || contextOrApi;
    const resp = await api.devices.get(deviceId);
    return resp;
}

/**
 * Set device switch state
 * @param {Object} contextOrApi - The context or API object
 * @param {string} deviceId - The device ID
 * @param {string} state - 'on' or 'off'
 */
async function setDeviceSwitch(contextOrApi, deviceId, state) {
    const api = contextOrApi.api || contextOrApi;
    // Command: capability: switch, command: on/off
    await api.devices.execute(deviceId, 'main', 'switch', state, []);
}

module.exports = { getDeviceStatus, setDeviceSwitch };
