import { relays, activeUser } from "./nostrService.js";
import { getInactiveMonths } from "./input.js";

// Function to fetch kind 0 events (profile metadata)
export async function fetchKind0Events(pubkey) {
  const kind0Events = [];
  const subscriptionId = Math.random().toString(36).substr(2, 9); // Generate a random subscription ID

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: [activeUser.pubkey],
      kinds: [0],
    },
  ]);

  return new Promise((resolve, reject) => {
    const responses = [];
    let relayCount = Object.keys(relays).length;
    let completedRelays = 0;

    Object.values(relays).forEach((relay) => {
      relay.send(request);
      console.log("Fetch structure:", request);

      relay.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (
          message[0] === "EVENT" &&
          message[1] === subscriptionId &&
          message[2].kind === 0
        ) {
          responses.push(message[2]);
        }

        if (message[0] === "EOSE" && message[1] === subscriptionId) {
          completedRelays++;
          if (completedRelays === relayCount) {
            kind0Events.push(...responses);
            resolve(kind0Events);
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

export async function fetchKind3Events() {
  const subscriptionId = Math.random().toString(36).substr(2, 9); // Generate a random subscription ID

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: [activeUser.pubkey],
      kinds: [3],
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
