import { relays } from "./nostrService.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchKind0Events(pubkeys) {
  const kind0Events = [];
  const subscriptionId = Math.random().toString(36).substr(2, 9); // Generate a random subscription ID

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: pubkeys,
      kinds: [0],
      limit: 1,
    },
  ]);

  const closeRequest = JSON.stringify(["CLOSE", subscriptionId]);

  return new Promise(async (resolve, reject) => {
    const responses = [];
    const relaysArray = Object.values(relays);

    for (const relay of relaysArray) {
      await new Promise((relayResolve, relayReject) => {
        relay.send(request);
        console.log("Fetch structure:", request);

        const onMessageHandler = (event) => {
          const message = JSON.parse(event.data);
          console.log("Received kind 0 event:", message);

          if (
            message[0] === "EVENT" &&
            message[1] === subscriptionId &&
            message[2].kind === 0
          ) {
            responses.push(message[2]);
          }

          if (message[0] === "EOSE" && message[1] === subscriptionId) {
            relay.send(closeRequest);
            relay.removeEventListener("message", onMessageHandler); // Remove the event listener
            relayResolve();
          }
        };

        relay.addEventListener("message", onMessageHandler);

        relay.onerror = (error) => {
          console.error(`Error from relay: ${error}`);
          relay.removeEventListener("message", onMessageHandler); // Remove the event listener in case of error
          relayReject(error);
        };
      });

      await delay(100); // Short delay between relay requests to avoid concurrent REQs
    }

    kind0Events.push(...responses);
    resolve(kind0Events);
  });
}
export async function fetchKind3Events(pubkey) {
  const subscriptionId = Math.random().toString(36).substr(2, 9); // Generate a random subscription ID

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: [pubkey],
      kinds: [3],
      limit: 1,
    },
  ]);

  return new Promise((resolve, reject) => {
    const events = [];
    const relayCount = Object.keys(relays).length;
    let completedRelays = 0;

    Object.values(relays).forEach((relay) => {
      relay.send(request);
      console.log("Fetch structure:", request);

      relay.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (
          message[0] === "EVENT" &&
          message[1] === subscriptionId &&
          message[2].kind === 3
        ) {
          console.log("Received kind 3 event:", message[2]);
          events.push(message[2]);
        }

        if (message[0] === "EOSE" && message[1] === subscriptionId) {
          completedRelays++;
          if (completedRelays === relayCount) {
            // Find the latest event
            const latestEvent = events.reduce((latest, event) => {
              return !latest || event.created_at > latest.created_at
                ? event
                : latest;
            }, null);

            if (latestEvent) {
              const followedPubkeys = new Set();
              const tags = latestEvent.tags;
              console.log("Tags in the latest event:", tags);
              if (Array.isArray(tags)) {
                tags.forEach((tag) => {
                  if (tag[0] === "p" && tag[1]) {
                    followedPubkeys.add(tag[1]);
                  }
                });
              }
              // Now resolve the promise with the list of pubkeys and the total number of pubkeys
              resolve({
                followedPubkeys: Array.from(followedPubkeys),
                totalPubkeys: followedPubkeys.size,
              });
            } else {
              resolve({
                followedPubkeys: [],
                totalPubkeys: 0,
              });
            }
          }
        }
      };

      relay.onerror = (error) => {
        console.error(`Error from relay: ${error}`);
        reject(error);
      };
    });
  });
}
