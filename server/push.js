
import webpush from 'web-push';
import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const mailto = process.env.MAILTO || 'mailto:admin@fhb.sk';

if (!publicVapidKey || !privateVapidKey) {
    console.warn("⚠️ VAPID KEYS NOT FOUND! Push notifications will not work.");
    console.warn("Run: npx web-push generate-vapid-keys");
    console.warn("And add them to .env");
} else {
    webpush.setVapidDetails(mailto, publicVapidKey, privateVapidKey);
}

export const getPublicVapidKey = () => publicVapidKey;

export const sendPushToUser = async (userId, payload) => {
    if (!publicVapidKey || !privateVapidKey) return;

    try {
        const [subs] = await pool.query('SELECT subscription FROM push_subscriptions WHERE user_id = ?', [userId]);
        
        if (subs.length === 0) return;

        const payloadString = JSON.stringify(payload);

        // Send to all user's devices
        const promises = subs.map(async (row) => {
            let subscription;
            try {
                subscription = JSON.parse(row.subscription);
            } catch (e) {
                console.error("Invalid subscription JSON in DB for user", userId);
                return;
            }

            try {
                await webpush.sendNotification(subscription, payloadString);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired/gone, remove from DB
                    console.log("Removing expired subscription for user", userId);
                    await pool.query('DELETE FROM push_subscriptions WHERE subscription = ?', [row.subscription]);
                } else {
                    console.error("Error sending push:", err);
                }
            }
        });

        await Promise.all(promises);
        
    } catch (e) {
        console.error("Failed to send push notification logic:", e);
    }
};
