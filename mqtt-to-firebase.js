import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import mqtt from 'mqtt';
import express from 'express';
import cors from 'cors';

// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAVP9OuLiwPu4U5oQcZzIeGByqr4pEcFbk",
    authDomain: "solar-panel-966fd.firebaseapp.com",
    projectId: "solar-panel-966fd",
    storageBucket: "solar-panel-966fd.firebasestorage.app",
    messagingSenderId: "346768019581",
    appId: "1:346768019581:web:e09a5a7fd853c58866a114",
    measurementId: "G-BGKPXSWE6X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. MQTT Configuration (Secure HiveMQ Cloud)
const MQTT_BROKER = 'mqtts://01a11b99095f4493874afc25227bd366.s1.eu.hivemq.cloud:8883';
const TOPIC_PRO = 'solar-panel-966fd/sensors';
const TOPIC_BASE = 'solar-panel-966fd/base/sensors';

console.log(`Connecting to Secure MQTT broker at ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER, {
    username: 'KURAM',
    password: 'kram@R5879'
});

client.on('connect', () => {
    console.log(`Connected! Subscribing to Pro: ${TOPIC_PRO} and Base: ${TOPIC_BASE}`);
    client.subscribe([TOPIC_PRO, TOPIC_BASE], (err) => {
        if (err) {
            console.error('Subscription error:', err);
        }
    });
});

client.on('message', async (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        console.log(`Received data on ${topic}:`, payload);

        // Ensure payload has actual data before pushing to Firestore. We use !== undefined because a value of 0 is falsy in Javascript.
        if (payload.env_temp !== undefined || payload.humidity !== undefined || payload.voltage !== undefined || payload.surface_temp !== undefined || payload.light_intensity !== undefined || payload.current_val !== undefined) {

            // Use ESP32-provided timestamp for offline data, or server timestamp for live data
            if (payload.ts && typeof payload.ts === 'string' && payload.ts.startsWith('20')) {
                // Offline data: ESP32 sent an ISO timestamp from NTP sync
                payload.timestamp = new Date(payload.ts);
                delete payload.ts;
            } else {
                // Live data: use Firestore server timestamp
                if (payload.ts) delete payload.ts;  // Remove relative timestamps like "T+123"
                payload.timestamp = serverTimestamp();
            }

            // Determine which collection to save to based on the topic
            const targetCollection = (topic === TOPIC_BASE) ? "sensor_data_base" : "sensor_data";

            // Save to Firestore
            const docRef = await addDoc(collection(db, targetCollection), payload);
            console.log(`Saved to [${targetCollection}] with ID: ${docRef.id}`);
        }
    } catch (e) {
        console.error("Failed to process message:", e);
    }
});

// 3. Express Web Server for HTTP Proxy Bypass and Render Keep-Alive
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

expressApp.post('/upload', (req, res) => {
    try {
        const payload = req.body;
        const panel = payload.panel; // Expecting "pro" or "base"

        if (!panel) {
            return res.status(400).send("Missing 'panel' identifier in payload.");
        }

        // Route to the correct HiveMQ topic based on the ESP32 that posted
        const topic = (panel === 'base') ? TOPIC_BASE : TOPIC_PRO;

        // Optional: Remove panel ID to perfectly mimic the old MQTT payload structure
        delete payload.panel;

        // Proxy the HTTP payload directly into the HiveMQ Cloud WebSocket pipeline
        client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
            if (err) {
                console.error("Failed to proxy HTTP payload to MQTT:", err);
                return res.status(500).send("MQTT Publish Failed");
            }
            res.status(200).send("Payload proxied to HiveMQ successfully.");
        });

    } catch (e) {
        console.error("Error processing /upload:", e);
        res.status(500).send("Internal Server Error");
    }
});

expressApp.get('/', (req, res) => {
    res.status(200).send('MQTT Bridge is running happily and Proxying HTTP to HiveMQ!');
});

const PORT = process.env.PORT || 10000;
expressApp.listen(PORT, () => {
    console.log(`Express web server listening on port ${PORT} to proxy HTTP to HiveMQ.`);
});
