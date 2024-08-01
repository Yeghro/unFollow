import { activeUser, nip07Signer, relays } from "./nostrService.js";
import { getEventHash } from "nostr-tools";

export async function createKind3Event(
  activePubkeys,
  eventContent = relays,
  followedTopics
) {
  // Ensure activePubkeys is not empty before creating the event
  if (!activePubkeys || activePubkeys.length === 0) {
    // console.error("No active pubkeys provided. Aborting event creation.");
    return;
  }
  //   console.log("Active pubkeys to be published:", activePubkeys);

  // If eventContent is not provided or is empty, default to relays
  if (!eventContent || eventContent.length === 0) {
    eventContent = JSON.stringify(relays); // Assuming relays is an object that can be stringified
  }

  const kind3Event = {
    kind: 3,
    tags: [],
    content: eventContent,
    created_at: Math.floor(Date.now() / 1000),
    pubkey: activeUser.pubkey, // Ensure the hexKey is used as the author's pubkey
  };

  // Add 'p' tags for pubkeys
  activePubkeys.forEach(function (pubkey) {
    kind3Event.tags.push(["p", pubkey]);
  });

  // Add 't' tags for topics, if provided
  if (followedTopics && Array.isArray(followedTopics)) {
    followedTopics.forEach(function (topic) {
      kind3Event.tags.push(["t", topic]);
    });
  }
  console.log("event to be published:", kind3Event);
  try {
    // Calculate the event ID and sign the event
    kind3Event.id = getEventHash(kind3Event);
    kind3Event.sig = await nip07Signer.sign(kind3Event); // Use nip07Signer for signing
    // console.log("Event successfully signed:", kind3Event);

    // Publish the signed event to all connected relays
    await publishEventToRelays(kind3Event);

    // console.log("Event successfully published:", kind3Event);
  } catch (error) {
    // console.error("Error signing or publishing event:", error);
    throw error;
  }
}

async function publishEventToRelays(signedEvent) {
  return new Promise(function (resolve, reject) {
    const relayListeners = new Map();
    let acceptedCount = 0;
    let relayCount = Object.keys(relays).length;
    let completedRelays = 0;

    for (const [relayUrl, relay] of Object.entries(relays)) {
      function onMessageHandler(event) {
        const message = JSON.parse(event.data);
        if (message[0] === "OK" && message[1] === signedEvent.id) {
          if (message[2] === true) {
            // console.log(`Event accepted by relay: ${relayUrl}`);
            acceptedCount++;
          } else {
            // console.warn(
            //   `Event rejected by relay: ${relayUrl} - ${message[3]}`
            // );
          }
          cleanup();
          checkCompletion();
        } else if (message[0] === "NOTICE") {
          //   console.warn(`Notice from relay ${relayUrl}: ${message[1]}`);
        }
      }

      function onErrorHandler(error) {
        // console.error(`Error from relay: ${relayUrl}`, error);
        cleanup();
        checkCompletion();
      }

      function cleanup() {
        relay.removeEventListener("message", onMessageHandler);
        relay.removeEventListener("error", onErrorHandler);
      }

      function checkCompletion() {
        completedRelays++;
        if (completedRelays === relayCount) {
          if (acceptedCount > 0) {
            resolve();
          } else {
            reject(new Error("Event was not accepted by any relay"));
          }
        }
      }

      relay.addEventListener("message", onMessageHandler);
      relay.addEventListener("error", onErrorHandler);
      relay.send(JSON.stringify(["EVENT", signedEvent]));
    }
  });
}
