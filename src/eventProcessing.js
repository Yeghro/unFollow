import { relays } from "./nostrService.js";

export async function categorizePubkeys(
  followedPubkeys,
  inactiveMonths = 8,
  maxRetries = 10
) {
  const currentTime = Math.floor(Date.now() / 1000);
  const inactiveThreshold = currentTime - inactiveMonths * 30 * 24 * 60 * 60;

  const activePubkeys = new Set();
  const inactivePubkeys = new Set(followedPubkeys);
  const followedKind0 = new Map();

  for (let i = 0; i < maxRetries; i++) {
    await processPubkeys(
      Array.from(inactivePubkeys),
      activePubkeys,
      inactivePubkeys,
      inactiveThreshold,
      followedKind0
    );

    updateProgress(i + 1, maxRetries);

    if (inactivePubkeys.size === 0) {
      updateProgress(maxRetries, maxRetries);
      break;
    }
  }

  return {
    activePubkeys: Array.from(activePubkeys),
    inactivePubkeys: Array.from(inactivePubkeys),
    followedKind0,
  };
}

async function processPubkeys(
  pubkeys,
  activePubkeys,
  inactivePubkeys,
  inactiveThreshold,
  followedKind0
) {
  const subscriptionId = `sub-${Math.random().toString(36).substr(2, 9)}`;
  let stopFetching = false;

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: pubkeys,
      kinds: [0, 1],
    },
  ]);

  const relayPromises = Object.values(relays).map(async (relay) => {
    return new Promise((resolve) => {
      const onMessageHandler = createMessageHandler(
        relay,
        subscriptionId,
        activePubkeys,
        inactivePubkeys,
        inactiveThreshold,
        followedKind0,
        () => {
          stopFetching = true;
          resolve();
        }
      );

      relay.addEventListener("message", onMessageHandler);
      relay.send(request);

      setTimeout(() => {
        relay.removeEventListener("message", onMessageHandler);
        relay.send(JSON.stringify(["CLOSE", subscriptionId]));
        resolve();
      }, 20000);
    });
  });

  await Promise.all(relayPromises);
}

function createMessageHandler(
  relay,
  subscriptionId,
  activePubkeys,
  inactivePubkeys,
  inactiveThreshold,
  followedKind0,
  onComplete
) {
  return async (event) => {
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
        onComplete();
      }

      if (message[0] === "NOTICE" && message[1].includes("error: too fast")) {
        await delay(2000);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  };
}

function updateProgress(completed, total) {
  const progress = Math.round((completed / total) * 100);
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
