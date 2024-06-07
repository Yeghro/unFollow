import { relays } from "./nostrService.js";

export async function categorizePubkeys(followedPubkeys, inactiveMonths = 8) {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const inactiveThreshold = currentTime - inactiveMonths * 30 * 24 * 60 * 60; // Inactivity threshold in seconds

  const activePubkeys = new Set();
  let inactivePubkeys = [...followedPubkeys];
  const followedKind0 = new Map(); // Change to Map to store event objects

  const progressBar = document.getElementById("progressBar");
  console.log("followed pubkeys sent to processing:", followedPubkeys);

  const totalRetries = 10; // Total number of retries
  const totalPubkeys = followedPubkeys.length;

  for (let i = 0; i < totalRetries; i++) {
    const initiallyInactive = inactivePubkeys.length;
    await processPubkeys(
      inactivePubkeys,
      activePubkeys,
      inactivePubkeys,
      inactiveThreshold,
      followedKind0
    );

    updateProgress(i + 1, totalRetries);

    if (inactivePubkeys.length === 0) {
      break; // Exit if no inactive pubkeys remain
    }

    console.log(`Retrying inactive pubkeys. Attempt ${i + 2}`);
  }

  return {
    activePubkeys: Array.from(activePubkeys),
    inactivePubkeys,
    followedKind0,
  };

  async function processPubkeys(
    pubkeys,
    activePubkeys,
    inactivePubkeys,
    inactiveThreshold,
    followedKind0
  ) {
    const relayListeners = new Map();
    const subscriptionId = `sub-${Math.random().toString(36).substr(2, 9)}`;
    let stopFetching = false;

    // Set a global watchdog timer to stop all fetching after 20 seconds
    const watchdogTimer = setTimeout(() => {
      stopFetching = true;
      console.warn(
        "Max wait time reached, stopping all fetching and closing connections."
      );
      for (const relay of Object.values(relays)) {
        relayListeners.get(relay).forEach((listener) => {
          relay.removeEventListener("message", listener);
        });
        relay.send(JSON.stringify(["CLOSE", subscriptionId])); // Close all subscriptions
      }
    }, 20000); // 20 seconds

    const request = JSON.stringify([
      "REQ",
      subscriptionId,
      {
        authors: pubkeys,
        kinds: [0, 1], // Requesting kinds 0 and 1
      },
    ]);

    for (const relay of Object.values(relays)) {
      relay.send(request);

      const onMessageHandler = async (event) => {
        if (stopFetching) return;

        const message = JSON.parse(event.data);
        console.log("Received event:", message);

        if (message[0] === "EVENT") {
          const eventPubkey = message[2].pubkey;
          const eventCreatedAt = message[2].created_at;

          if (message[2].kind === 0) {
            followedKind0.set(eventPubkey, message[2]); // Store the event object
          }

          if (message[2].kind === 1 && eventCreatedAt > inactiveThreshold) {
            activePubkeys.add(eventPubkey);
            const index = inactivePubkeys.indexOf(eventPubkey);
            if (index !== -1) {
              inactivePubkeys.splice(index, 1);
            }
          }
        }

        if (message[0] === "EOSE" && message[1] === subscriptionId) {
          relay.send(JSON.stringify(["CLOSE", subscriptionId]));
          relay.removeEventListener("message", onMessageHandler); // Remove the event listener
        }

        if (message[0] === "NOTICE" && message[1].includes("error: too fast")) {
          console.warn("Too many requests, slowing down...");
          await delay(2000); // Additional delay on "too fast" error
        }
      };

      relay.addEventListener("message", onMessageHandler);

      relay.onerror = (error) => {
        console.error(`Error from relay: ${error}`);
        relay.removeEventListener("message", onMessageHandler); // Remove the event listener in case of error
      };

      if (!relayListeners.has(relay)) {
        relayListeners.set(relay, []);
      }
      relayListeners.get(relay).push(onMessageHandler);
    }

    await delay(500); // Delay between individual relay requests to avoid rate limiting

    // Clear the watchdog timer if all events are fetched before the timeout
    clearTimeout(watchdogTimer);

    // Clean up event listeners after completion or timeout
    relayListeners.forEach((listeners, relay) => {
      listeners.forEach((listener) =>
        relay.removeEventListener("message", listener)
      );
    });
  }

  function updateProgress(completed, total) {
    const progress = Math.round((completed / total) * 100);
    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${progress}%`;
    } else {
      console.error("Progress bar element not found");
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
