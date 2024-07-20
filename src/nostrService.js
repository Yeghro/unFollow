import { NDKNip07Signer } from "@nostr-dev-kit/ndk";

// Initialize relay URLs
export let relayUrls = [
  "wss://purplepag.es",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://nostr.bitcoiner.social",
  "wss://nostrpub.yeghro.site",
];

let relays = {};

let nip07Signer = null;
let activeUser = null;

export async function connectToRelays(urls = relayUrls) {
  try {
    // Check if the window.nostr object exists (indicating NIP-07 extension presence)
    if (typeof window !== "undefined" && window.nostr) {
      nip07Signer = new NDKNip07Signer(5000);
      activeUser = await nip07Signer.blockUntilReady();
      console.log("Signer is ready and user is:", activeUser);
    } else {
      console.log("NIP-07 extension not detected.");
      nip07Signer = null;
      activeUser = null;
    }
  } catch (error) {
    console.warn("Error while initializing NDKNip07Signer:", error);
    nip07Signer = null;
    activeUser = null;
  }

  // Proceed with connecting to relays regardless of signer availability
  const connectionPromises = urls.map(async (url) => {
    if (relays[url]) {
      console.log(`Already connected to relay: ${url}`);
      return;
    }

    const ws = new WebSocket(url);

    return new Promise((resolve) => {
      ws.onopen = () => {
        console.log(`Connected to relay: ${url}`);
        relays[url] = ws;
        resolve();
      };

      ws.onmessage = (event) => {
        // console.log(`Message from ${url}:`, event.data);
      };

      ws.onclose = () => {
        console.log(`Disconnected from relay: ${url}`);
        delete relays[url];
      };

      ws.onerror = (error) => {
        console.error(`Error from relay ${url}:`, error);
        resolve();
      };
    });
  });

  await Promise.all(connectionPromises);
  console.log("Established Relay Instance:", relays);
}

async function connectUsersRelays(targetPubkey) {
  // Ensure we're connected to the default relays
  if (Object.keys(relays).length === 0) {
    await connectToRelays();
  }

  // Get user-specific relays
  const userRelays = await getUserRelays(targetPubkey);
  const allRelayUrls = [...new Set([...relayUrls, ...userRelays])];

  // Connect to any additional relays not already connected
  await connectToAdditionalRelays(allRelayUrls);
}

async function connectToAdditionalRelays(allRelayUrls) {
  const newUrls = allRelayUrls.filter((url) => !relays[url]);
  console.log("new relays to be connected to:", newUrls);

  // Use the existing connectToRelays function for new URLs
  if (newUrls.length > 0) {
    relayUrls = [...new Set([...relayUrls, ...newUrls])];
    console.log("updated relayUrls:", relayUrls);
    await connectToRelays(newUrls);
  }
}

async function getUserRelays(pubkey) {
  const userRelays = new Set();
  const subscriptionId = `user-relays-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: [pubkey],
      kinds: [10002], // NIP-65 event kind
      limit: 1,
    },
  ]);

  const relayPromises = Object.values(relays).map(
    (ws) =>
      new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`Query for user relays timed out.`);
          resolve();
        }, 10000);

        const onMessage = (event) => {
          const message = JSON.parse(event.data);
          if (message[0] === "EVENT" && message[2].kind === 10002) {
            console.log("kind 10002 received:", message);
            message[2].tags.forEach((tag) => {
              if (tag[0] === "r") {
                userRelays.add(tag[1]);
              }
            });
          }
          if (message[0] === "EOSE") {
            clearTimeout(timeout);
            ws.removeEventListener("message", onMessage);
            resolve();
          }
        };

        ws.addEventListener("message", onMessage);
        ws.send(request);
      })
  );

  await Promise.all(relayPromises);

  return Array.from(userRelays);
}

export { nip07Signer, activeUser, relays, connectUsersRelays };
