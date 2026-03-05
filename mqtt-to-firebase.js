import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import mqtt from 'mqtt';
import http from 'http'; // <-- Added to satisfy Render

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

// 2. MQTT Configuration
const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const TOPIC_PRO = 'solar-panel-966fd/sensors';
const TOPIC_BASE = 'solar-panel-966fd/base/sensors';

console.log(`Connecting to MQTT broker at ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER);

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

        // Ensure payload has actual data before pushing to Firestore
        if (payload.env_temp || payload.humidity || payload.voltage) {

            // Add Firestore server timestamp
            payload.timestamp = serverTimestamp();

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

// 3. Dummy Web Server to keep Render instances alive
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MQTT Bridge is running happily!\n');
});

server.listen(PORT, () => {
    console.log(`Dummy web server listening on port ${PORT} to bypass Render health checks.`);
});
