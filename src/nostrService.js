import NDK, { NDKNip07Signer, NDKUser, NDKEvent } from "@nostr-dev-kit/ndk";

export let ndk;
let ndkUser;
export let nip07signer;

export let relayUrls = [
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nostr.wine",
  "wss://relay.snort.social",
  "wss://nos.lol",
  "wss://eden.nostr.land",
  "wss://nostr.bitcoiner.social",
];

export async function connectToNDK() {
  if (!ndk || !ndk.isConnected()) {
    try {
      nip07signer = new NDKNip07Signer();
      ndk = new NDK({
        signer: nip07signer,
        explicitRelayUrls: relayUrls,
        autoConnectUserRelays: false,
      });
      await ndk.connect();
      console.log("NDK connected");
    } catch (error) {
      console.error("Failed to connect to NDK:", error);
      // Add logic to handle reconnection or notify the user
    }
  } else {
    console.log("NDK already connected");
  }
}

export async function loginWithNostr() {
  try {
    await connectToNDK();
    const user = await nip07signer.user();
    console.log("User public key obtained:", user);
    ndkUser = new NDKUser({ npub: user.npub });
    ndkUser.ndk = ndk;
    console.log("NDK user initialized:", ndkUser);
  } catch (error) {
    console.error("Error during login:", error);
    // Handle the error appropriately, such as displaying a user-friendly message
    alert(
      "Failed to login with Nostr. Please ensure that the NIP-07 signer is available and properly initialized."
    );
  }
}

export function getPublicKey() {
  if (!ndkUser) {
    throw new Error("NDK user not initialized. Please login first.");
  }
  return ndkUser.npub;
}

export function getHexKey() {
  if (!ndkUser) {
    throw new Error("NDK user not initialized. Please login first.");
  }
  return ndkUser.pubkey;
}

export async function fetchEvents(filter, timeoutMs = 10000, relayUrl) {
  console.log("Fetching events with filter:", filter);
  const events = await ndk.fetchEvents(filter, {
    relays: relayUrl ? [relayUrl] : ndk.explicitRelayUrls,
    closeOnEose: true,
    timeoutMs,
  });
  console.log("Fetched events:", events);
  return events;
}

export async function fetchEvent(filter, timeoutMs = 10000) {
  console.log("Fetching single event with filter:", filter);
  const event = await ndk.fetchEvent(filter, {
    relays: ndk.explicitRelayUrls,
    closeOnEose: true,
    timeoutMs,
  });
  console.log("Fetched event:", event);
  return event;
}

export async function createKind3Event(hexKey, activePubkeys) {
  // Ensure activePubkeys is not empty before creating the event
  if (!activePubkeys || activePubkeys.length === 0) {
    console.error("No active pubkeys provided. Aborting event creation.");
    return;
  }

  // Validate hexKey
  if (!hexKey) {
    console.error("Invalid hexKey. Aborting event creation.");
    return;
  }

  const kind3Event = new NDKEvent(ndk, {
    kind: 3,
    tags: activePubkeys.map((pubkey) => ["p", pubkey]),
    content: "",
    created_at: Math.floor(Date.now() / 1000),
    pubkey: hexKey, // Ensure the hexKey is used as the author's pubkey
  });

  try {
    await kind3Event.sign(nip07signer); // Use nip07signer instead of ndk.signer
    await kind3Event.publish();
    console.log("Kind 3 event created and published:", kind3Event);
  } catch (error) {
    console.error("Failed to create or publish Kind 3 event:", error);
  }
}
