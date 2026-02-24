const admin = require("firebase-admin");
const express = require("express");

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://shapeos-smarthome-default-rtdb.firebaseio.com"
});

const db = admin.database();
const firestore = admin.firestore();
const app = express();

let lastState = {};

// 🔥 Emergency Title Formatter
function formatTitle(key) {
  return `🚨 ${key.toUpperCase()} ALERT`;
}

// 🔥 Send Notification To All Users
async function sendEmergencyNotification(alertKey) {
  try {
    const usersSnapshot = await firestore.collection("users").get();

    if (usersSnapshot.empty) {
      console.log("No users found.");
      return;
    }

    const sendPromises = [];

    usersSnapshot.forEach((doc) => {
      const token = doc.data().fcmToken;

      if (token) {
        const message = {
          token: token,
          notification: {
            title: formatTitle(alertKey),
            body: `Security issue detected: ${alertKey}`
          },
          android: {
            priority: "high",
            notification: {
              channelId: "default_channel_id",
              sound: "default",
              clickAction: "FLUTTER_NOTIFICATION_CLICK",
              priority: "high",
              visibility: "public"
            }
          },
          data: {
            type: alertKey,
            full_screen: "true"
          }
        };

        sendPromises.push(admin.messaging().send(message));
      }
    });

    await Promise.all(sendPromises);

    console.log("✅ Notification sent for:", alertKey);

  } catch (error) {
    console.error("❌ FCM Send Error:", error);
  }
}

// 🔁 Poll Realtime Database Every 3 Seconds
setInterval(async () => {
  try {
    const snapshot = await db.ref("alerts").get();
    const data = snapshot.val();

    if (!data) return;

    for (const key in data) {

      const currentState = data[key];
      const previousState = lastState[key];

      // 🚨 Trigger Only On FALSE → TRUE transition
      if (currentState === true && previousState !== true) {

        console.log("🚨 ALERT TRIGGERED:", key);

        await sendEmergencyNotification(key);
      }
    }

    lastState = { ...data };

  } catch (error) {
    console.error("❌ Polling Error:", error);
  }

}, 3000);

// 🌐 Health Check Endpoint (Render keep-alive)
app.get("/", (req, res) => {
  res.send("ShapeOS Notification Server Running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
