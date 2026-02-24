const admin = require("firebase-admin");
const express = require("express");

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://shapeos-smarthome-default-rtdb.firebaseio.com"
});

const db = admin.database();
const app = express();

let lastState = {};

setInterval(async () => {
  try {
    const snapshot = await db.ref("alerts").get();
    const data = snapshot.val();

    if (!data) return;

    for (const key in data) {
      if (data[key] === true && lastState[key] !== true) {

        console.log("🚨 ALERT:", key);

        const users = await admin.firestore()
          .collection("users")
          .get();

        users.forEach(async (doc) => {
          const token = doc.data().fcmToken;

          if (token) {
            await admin.messaging().send({
              token: token,
              notification: {
                title: `${key.toUpperCase()} ALERT`,
                body: `Security issue detected: ${key}`
              },
              android: {
                priority: "high"
              }
            });
          }
        });
      }
    }

    lastState = data;
  } catch (err) {
    console.error("Error:", err);
  }

}, 3000);

// Simple web server (Render ko zinda rakhne ke liye)
app.get("/", (req, res) => {
  res.send("ShapeOS Notification Server Running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
