import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
admin.initializeApp();

export const getBostonWeather = functions.https.onRequest(
  async (request, response) => {
    try {
      const snapshot = await admin
        .firestore()
        .collection("cities-weather")
        .doc("boston-ma-us")
        .get();
      response.send(snapshot.data());
    } catch (error) {
      // log the error
      console.log(error);
      response.status(500).send(error);
    }
  }
);

export const getBostonAreaWeather = functions.https.onRequest(
  async (request, response) => {
    try {
      const areaSnapshot = await admin
        .firestore()
        .collection("areas")
        .doc("greater-boston")
        .get();
      const cities = areaSnapshot.data().cities;
      const promises = [];

      for (const city in cities) {
        const p = admin
          .firestore()
          .collection("cities-weather")
          .doc(city.toString())
          .get();
        promises.push(p);
      }

      const citySnapshots = await Promise.all(promises);
      const results = [];

      citySnapshots.forEach(citySnap => {
        const data = citySnap.data();
        data.city = citySnap.id;
        results.push(data);
      });

      response.send(results);
    } catch (error) {
      // log the error
      console.log(error);
      response.status(500).send(error);
    }
  }
);

export const onMessageCreate = functions.firestore
  .document("rooms/{roomId}/messages/{messageId}")
  .onCreate(async (snapshot, context) => {
    const roomId = context.params.roomId;
    const messageId = context.params.messageId;
    console.log(`New Messages ${messageId} in room ${roomId}`);

    const messageData = snapshot.data();
    const text = addPizzazz(messageData.text);
    await snapshot.ref.update({ text: text });

    const countRef = admin
      .firestore()
      .collection("rooms")
      .doc(roomId);
    return admin
      .firestore()
      .runTransaction(function(transaction) {
        return transaction.get(countRef).then(doc => {
          const count = doc.data().messageCount + 1;
          transaction.update(countRef, { messageCount: count });
        });
      })
      .then(() => {
        console.log("transaction complete");
      })
      .catch(() => {
        console.log("transaction failed");
      });
  });

export const onMessageUpdate = functions.firestore
  .document("rooms/{roomId}/messages/{messageId}")
  .onUpdate((change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.text === after.text) {
      console.log("No changes");
      return null;
    }

    const text = addPizzazz(after.text);
    const timeEdited = Date.now();
    return change.after.ref.update({ text, timeEdited });
  });

export const onMessageDelete = functions.firestore
  .document("rooms/{roomId}/messages/{messageId}")
  .onDelete(async (snapshot, context) => {
    const roomId = context.params.roomId;
    const countRef = admin
      .firestore()
      .collection("rooms")
      .doc(roomId);
    return admin
      .firestore()
      .runTransaction(function(transaction) {
        return transaction.get(countRef).then(doc => {
          const count = doc.data().messageCount - 1;
          transaction.update(countRef, { messageCount: count });
        });
      })
      .then(() => {
        console.log("transaction complete");
      })
      .catch(() => {
        console.log("transaction failed");
      });
  });

  function addPizzazz(text: string): string {
    return text.replace(/\bpizza\b/g, "🍕");
  }
