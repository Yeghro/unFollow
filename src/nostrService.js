import { NDKNip07Signer } from "@nostr-dev-kit/ndk";

// Instantiate the NDKNip07Signer
const nip07Signer = new NDKNip07Signer(5000);

export const activeUser = await nip07Signer.blockUntilReady();
console.log("Signer is ready and user is:", activeUser);

export let relayUrls = [
  "wss://purplepag.es",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nostr.wine",
  "wss://relay.snort.social",
  "wss://eden.nostr.land",
  "wss://nostr.bitcoiner.social",
];

export let relays = {};

export function connectToRelays() {
  relayUrls.forEach((url) => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`Connected to relay: ${url}`);
      relays[url] = ws;
    };

    ws.onmessage = (event) => {
      console.log(`Message from ${url}:`, event.data);
      // Handle incoming messages
    };

    ws.onclose = () => {
      console.log(`Disconnected from relay: ${url}`);
      delete relays[url];
    };

    ws.onerror = (error) => {
      console.error(`Error from relay ${url}:`, error);
    };
  });
  console.log("Established Relay Instance:", relays);
}
