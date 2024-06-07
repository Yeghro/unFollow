import { NDKNip07Signer } from "@nostr-dev-kit/ndk";

// Attempt to instantiate the NDKNip07Signer
let nip07Signer = null;
let activeUser = null;

(async () => {
  try {
    nip07Signer = new NDKNip07Signer(5000);
    activeUser = await nip07Signer.blockUntilReady();
    // console.log("Signer is ready and user is:", activeUser);
  } catch (error) {
    console.warn("NDKNip07Signer not available or user denied access:", error);
    nip07Signer = null;
    activeUser = null;
  }
})();

export { nip07Signer, activeUser };

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

export function connectToRelays() {
  relayUrls.forEach((url) => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      // console.log(`Connected to relay: ${url}`);
      relays[url] = ws;
    };

    ws.onmessage = (event) => {
      // console.log(`Message from ${url}:`, event.data);
      // Handle incoming messages
    };

    ws.onclose = () => {
      // console.log(`Disconnected from relay: ${url}`);
      delete relays[url];
    };

    ws.onerror = (error) => {
      console.error(`Error from relay ${url}:`, error);
    };
  });
  // console.log("Established Relay Instance:", relays);
}
