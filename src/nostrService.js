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

export let relays = {};

let nip07Signer = null;
let activeUser = null;

export async function connectToRelays() {
  try {
    nip07Signer = new NDKNip07Signer(5000);
    activeUser = await nip07Signer.blockUntilReady();
    // console.log("Signer is ready and user is:", activeUser);
  } catch (error) {
    // console.warn("NDKNip07Signer not available or user denied access:", error);
    nip07Signer = null;
    activeUser = null;
    return; // Exit the function if signing fails
  }

  relayUrls.forEach((url) => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`Connected to relay: ${url}`);
      relays[url] = ws;
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
    };
  });

  console.log("Established Relay Instance:", relays);
}

export { nip07Signer, activeUser };
