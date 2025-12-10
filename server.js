require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { SmartApp } = require('@smartthings/smartapp');
const { createVirtualDevice } = require('./virtual_device');
const { handleDRSignal } = require('./dr_handler');
const { loadStore, saveStore } = require('./store');

const smartapp = new SmartApp()
    .enableEventLogging(2)
    .page('mainPage', (context, page, configData) => {
        page.section('Select your devices for DR demo', section => {
            section
                .deviceSetting('managedSwitches')
                .capabilities(['switch'])
                .permissions('rx')
                .required(true);
        });
    })
    .updated(async (context, updateData) => {
        console.log('SmartApp installed/updated.');
        console.dir(context.config, { depth: 3 });

        // On first install — create a virtual DR-status device
        const store = await loadStore();
        const locationId = context.config.locationId;  // may need to fetch
        try {
            const drDeviceId = await createVirtualDevice(context.authToken, locationId);
            console.log('Created DR-status device with ID', drDeviceId);
            store.drStatusDeviceId = drDeviceId;
            // store managed devices
            store.managedDevices = context.config.managedSwitches.map(d => d.deviceConfig);
            store.locationId = locationId;
            store.token = context.authToken;
            await saveStore('default', store);
        } catch (e) {
            console.error("Failed to create virtual device:", e.toString());
        }
    });

const app = express();
const cors = require('cors');
app.use(cors());
app.use(bodyParser.json());

app.post('/', (req, res) => {
    smartapp.handleHttpCallback(req, res);
});

// Endpoint for your utility-simulator to trigger DR event
app.post('/dr-event', async (req, res) => {
    const signal = req.body;  // e.g. { eventId, level, duration }
    const store = await loadStore();
    if (!store.managedDevices || !store.drStatusDeviceId) {
        return res.status(400).json({ error: 'No setup / devices configured' });
    }
    // Create a simple API shim that uses axios and the stored token
    const axios = require('axios');
    const simpleApi = {
        devices: {
            execute: async (deviceId, component, capability, command, args) => {
                const url = `https://api.smartthings.com/v1/devices/${deviceId}/commands`;
                const body = {
                    commands: [
                        {
                            component: component || 'main',
                            capability: capability,
                            command: command,
                            arguments: args || []
                        }
                    ]
                };
                return axios.post(url, body, {
                    headers: { 'Authorization': `Bearer ${store.token}` }
                });
            },
            get: async (deviceId) => {
                return axios.get(`https://api.smartthings.com/v1/devices/${deviceId}`, {
                    headers: { 'Authorization': `Bearer ${store.token}` }
                });
            }
        }
    };

    const stContext = {
        api: simpleApi,
        token: store.token,
        locationId: store.locationId,
        managedDevices: store.managedDevices,
        drStatusDeviceId: store.drStatusDeviceId
    };
    try {
        const result = await handleDRSignal(signal, stContext);
        return res.json({ result });
    } catch (e) {
        console.error("Error handling DR signal:", e.toString());
        return res.status(500).json({ error: e.toString() });
    }
});

// Endpoint to list managed devices with their status
app.get('/devices', async (req, res) => {
    const store = await loadStore();
    if (!store.managedDevices || !store.token) {
        return res.status(400).json({ error: 'No devices configured or token missing. Open App on phone to sync.' });
    }

    try {
        // We need to fetch details for each device using the stored token
        // Use axios or the SmartApp context mechanism if possible.
        // Here we'll do a direct Axios call for simplicity as we have the token
        const axios = require('axios');
        const deviceDetails = [];

        for (const d of store.managedDevices) {
            try {
                const response = await axios.get(`https://api.smartthings.com/v1/devices/${d.deviceId}/status`, {
                    headers: { 'Authorization': `Bearer ${store.token}` }
                });
                // We also want the name/label, usually requires a separate call or was in config
                // Let's get the main info
                const infoResponse = await axios.get(`https://api.smartthings.com/v1/devices/${d.deviceId}`, {
                    headers: { 'Authorization': `Bearer ${store.token}` }
                });

                deviceDetails.push({
                    deviceId: d.deviceId,
                    label: infoResponse.data.label || infoResponse.data.name,
                    switch: response.data.components.main.switch.switch.value
                });
            } catch (err) {
                deviceDetails.push({ deviceId: d.deviceId, error: err.message });
            }
        }
        res.json({ count: deviceDetails.length, devices: deviceDetails });
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

const PORT = process.env.PORT || 8080;

// Only start the server if running directly (local node server.js)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`DR-SmartApp server running on port ${PORT}`);
    });
}

// Export for Lambda
module.exports = app;
