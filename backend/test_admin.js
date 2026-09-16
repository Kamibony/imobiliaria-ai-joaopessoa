const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
db.collection("projects").get().then(snapshot => {
  console.log("Projects count:", snapshot.size);
}).catch(console.error);
