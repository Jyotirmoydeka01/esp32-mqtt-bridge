import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import mqtt from 'mqtt';

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
const MQTT_BROKER = 'mqtt://broker.hivemq.com'; // Use TCP strictly for regular Node.js scripts
const MQTT_TOPIC = 'solar-panel-966fd/sensors';

console.log(`Connecting to MQTT broker at ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
    console.log(`Connected successfully! Subscribing to: ${MQTT_TOPIC}`);
    client.subscribe(MQTT_TOPIC, (err) => {
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

            // Save to Firestore
            const docRef = await addDoc(collection(db, "sensor_data"), payload);
            console.log("Document written to Firebase with ID: ", docRef.id);
        }
    } catch (e) {
        console.error("Failed to process message:", e);
    }
});
