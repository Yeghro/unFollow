import { relays } from "./nostrService.js";

export async function categorizePubkeys(
  followedPubkeys,
  inactiveMonths = 8,
  maxRetries = 12,
  batchSize = 250
) {
  const currentTime = Math.floor(Date.now() / 1000);
  const inactiveThreshold = currentTime - inactiveMonths * 30 * 24 * 60 * 60;

  const activePubkeys = new Set();
  const inactivePubkeys = new Set(followedPubkeys);
  const followedKind0 = new Map();
  console.log("Followed pubkeys sent to categorize:", followedPubkeys);

  let remainingPubkeys = Array.from(inactivePubkeys);
  let retryCount = 0;

  while (remainingPubkeys.length > 0 && retryCount < maxRetries) {
    const batches = createBatches(remainingPubkeys, batchSize);
    remainingPubkeys = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchSet = new Set(batch);

      await processPubkeys(
        Array.from(batchSet),
        activePubkeys,
        inactivePubkeys,
        inactiveThreshold,
        followedKind0
      );

      // Remove processed pubkeys from the batch set
      for (const pubkey of batchSet) {
        if (!activePubkeys.has(pubkey)) {
          remainingPubkeys.push(pubkey);
        }
      }
    }

    retryCount++;
    updateProgress(retryCount, maxRetries);
  }

  // After max retries, consider remaining pubkeys as inactive
  for (const pubkey of remainingPubkeys) {
    inactivePubkeys.add(pubkey);
  }

  return {
    activePubkeys: Array.from(activePubkeys),
    inactivePubkeys: Array.from(inactivePubkeys),
    followedKind0,
  };
}

function createBatches(array, size) {
  const batches = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}
async function processPubkeys(
  followedPubkeys,
  activePubkeys,
  inactivePubkeys,
  inactiveThreshold,
  followedKind0
) {
  const relayListeners = new Map();
  const subscriptionId = `sub-${Math.random().toString(36).substr(2, 9)}`;
  let stopFetching = false;

  const watchdogTimer = setTimeout(() => {
    stopFetching = true;
    cleanupRelays();
  }, 20000);

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: followedPubkeys,
      kinds: [0, 1],
    },
  ]);

  for (const relay of Object.values(relays)) {
    try {
      relay.send(request);

      const onMessageHandler = async (event) => {
        if (stopFetching) return;

        try {
          const message = JSON.parse(event.data);

          if (message[0] === "EVENT") {
            const eventPubkey = message[2].pubkey;
            const eventCreatedAt = message[2].created_at;

            if (message[2].kind === 0) {
              followedKind0.set(eventPubkey, message[2]);
            }

            if (message[2].kind === 1 && eventCreatedAt > inactiveThreshold) {
              activePubkeys.add(eventPubkey);
              inactivePubkeys.delete(eventPubkey);
            }
          }

          if (message[0] === "EOSE" && message[1] === subscriptionId) {
            relay.send(JSON.stringify(["CLOSE", subscriptionId]));
            relay.removeEventListener("message", onMessageHandler);
          }

          if (
            message[0] === "NOTICE" &&
            message[1].includes("error: too fast")
          ) {
            await delay(2000);
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      };

      relay.addEventListener("message", onMessageHandler);

      relay.onerror = (error) => {
        console.error("Relay error:", error);
        relay.removeEventListener("message", onMessageHandler);
      };

      if (!relayListeners.has(relay)) {
        relayListeners.set(relay, []);
      }
      relayListeners.get(relay).push(onMessageHandler);
    } catch (error) {
      console.error("Error setting up relay:", error);
    }
  }

  await delay(2000);

  clearTimeout(watchdogTimer);
  cleanupRelays();

  function cleanupRelays() {
    relayListeners.forEach((listeners, relay) => {
      listeners.forEach((listener) =>
        relay.removeEventListener("message", listener)
      );
      relay.send(JSON.stringify(["CLOSE", subscriptionId]));
    });
    relayListeners.clear();
  }
}

function updateProgress(completedRetries, maxRetries) {
  const progress = Math.round((completedRetries / maxRetries) * 100);
  if (typeof window !== "undefined" && window.document) {
    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${progress}%`;
    }
  }
  console.log(`Progress: ${progress}%`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
