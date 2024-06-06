import { relays } from "./nostrService.js";
import { nip19 } from "nostr-tools"; // Assuming nip19 is imported from nostr-tools

export async function categorizePubkeys(followedPubkeys, inactiveMonths = 8) {
  const subscriptionId = Math.random().toString(36).substr(2, 9); // Generate a random subscription ID
  const currentTime = Date.now() / 1000; // Current time in seconds
  const inactiveThreshold = inactiveMonths * 30 * 24 * 60 * 60; // Convert months to seconds

  const activePubkeys = new Set();
  const inactivePubkeys = new Set(followedPubkeys);
  const followedKind0 = {};

  const progressBar = document.getElementById("progressBar");

  return new Promise((resolve, reject) => {
    let completedPubkeys = 0;

    followedPubkeys.forEach((pubkey, index) => {
      const request = JSON.stringify([
        "REQ",
        `${subscriptionId}_${index}`,
        {
          authors: [pubkey],
          kinds: [0, 1], // Kind 0 and Kind 1 events
          limit: 1, // Only fetch the latest event
        },
      ]);

      Object.values(relays).forEach((relay) => {
        relay.send(request);
        console.log(
          `Fetch latest kind 0 and kind 1 events for pubkey: ${pubkey} sent to relay: ${relay.url}`
        );

        relay.onmessage = (event) => {
          const message = JSON.parse(event.data);

          if (message[0] === "EVENT" && message[1].startsWith(subscriptionId)) {
            const eventPubkey = message[2].pubkey;
            console.log(
              `Received event for pubkey: ${eventPubkey} from relay: ${relay.url}`,
              message[2]
            );

            if (message[2].kind === 0) {
              followedKind0[eventPubkey] = message[2];
            } else if (message[2].kind === 1) {
              const eventTime = message[2].created_at;
              console.log(
                `Current Time: ${currentTime}, Event Time: ${eventTime}, Threshold: ${inactiveThreshold}`
              );

              if (currentTime - eventTime <= inactiveThreshold) {
                console.log(`Pubkey ${eventPubkey} is active`);
                activePubkeys.add(eventPubkey);
                inactivePubkeys.delete(eventPubkey);
              }
            }
          }

          if (message[0] === "EOSE" && message[1].startsWith(subscriptionId)) {
            completedPubkeys++;

            // Update the progress bar
            const progress = Math.round(
              (completedPubkeys / followedPubkeys.length) * 100
            );
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${progress}%`;

            if (completedPubkeys >= followedPubkeys.length) {
              console.log(
                `Number of unique pubkeys with events: ${activePubkeys.size}`
              );
              resolve({
                activePubkeys: Array.from(activePubkeys),
                inactivePubkeys: Array.from(inactivePubkeys),
                followedKind0,
              });
            }
          }
        };

        relay.onerror = (error) => {
          console.error(
            `Error from relay ${relay.url} for pubkey ${pubkey}: ${error}`
          );
          reject(error);
        };
      });
    });
  });
}
