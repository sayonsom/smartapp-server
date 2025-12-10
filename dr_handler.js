const { getDeviceStatus, setDeviceSwitch } = require('./utils');

/**
 * Handles the incoming DR signal.
 * Flow:
 * 1. Log Event
 * 2. Send Notification
 * 3. Update Status to Pending
 * 4. Wait 30s
 * 5. Check Opt-Out (Mocked)
 * 6. Execute Device Commands (OFF)
 * 7. Update Status to Active
 * 
 * @param {Object} signal - { eventId, level, duration ... }
 * @param {Object} stContext - { api, token, locationId, managedDevices, drStatusDeviceId }
 */
async function handleDRSignal(signal, stContext) {
    console.log("Received DR Signal:", signal);

    // 1. Send Push Notification
    // Note: The SmartApp API for notifications might require specific scopes or setup.
    // simpler to just log if we can't easily find the user ID.
    // However, we can try to broadcast to the location if supported or just log.
    console.log(">>> SIMULATING PUSH NOTIFICATION: 'DR Event Imminent! Opt-out in 30s.'");

    // 2. Update Virtual Device to "Pending"
    if (stContext.drStatusDeviceId && !stContext.drStatusDeviceId.startsWith('virtual-')) {
        // Only try to update if it's a real device ID. 
        // Our mock returns 'virtual-...' so we will skip API call to avoid 404s.
        // In a real app, we would:
        // await stContext.api.devices.execute(stContext.drStatusDeviceId, 'main', 'msg', 'set', ['Pending']);
    } else {
        console.log(`[Mock] Virtual Device ${stContext.drStatusDeviceId} set to PENDING`);
    }

    // 3. Wait 30 Seconds (The "Opt-out Window")
    console.log("Waiting 30 seconds for opt-out...");
    // For Lambda, we MUST block the execution loop here for the timer to count down.
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 4. Check Opt-out
    // We'll read from a 'opt-out' flag in the store if we implemented that endpoint.
    // For this PoC, we assume NO opt-out.
    const userOptedOut = false;

    if (userOptedOut) {
        console.log("User opted out. Aborting DR capability.");
        return "Aborted by User";
    }

    // 5. Execute Control (Turn OFF managed devices)
    console.log("Executing DR Control on devices:", stContext.managedDevices.map(d => d.deviceId));

    const results = [];
    for (const deviceConfig of stContext.managedDevices) {
        const deviceId = deviceConfig.deviceId;
        try {
            console.log(`Turning OFF device ${deviceId}...`);
            await setDeviceSwitch(stContext.api, deviceId, 'off');
            results.push({ deviceId, status: 'Success (OFF)' });

            // DEMO ENHANCEMENT: Restore state (Turn ON) after a short delay
            // This lets the user see the "Turn On" event in the app too.
            const demoDuration = (signal.duration || 10) * 1000; // default 10s
            console.log(`Waiting ${demoDuration / 1000}s to restore device state...`);

            setTimeout(async () => {
                console.log(`Restoring (Turning ON) device ${deviceId}...`);
                try {
                    await setDeviceSwitch(stContext.api, deviceId, 'on');
                    console.log(`Device ${deviceId} restored to ON.`);
                } catch (e) { console.error("Restore failed", e.message); }
            }, demoDuration);


        } catch (error) {
            console.error(`Failed to control device ${deviceId}:`, error.message);
            results.push({ deviceId, status: 'Failed', error: error.message });
        }
    }

    // 6. Update Virtual Device to "Active"
    console.log(`[Mock] Virtual Device ${stContext.drStatusDeviceId} set to ACTIVE`);

    return {
        message: "DR Event Processed",
        results
    };
}

module.exports = { handleDRSignal };
