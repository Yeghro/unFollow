import NDK, { NDKNip07Signer, NDKEvent } from "@nostr-dev-kit/ndk";

let ndkUser;
export let ndk;
export let nip07signer;
export let relayUrls = [
  "wss://purplepag.es",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nostr.wine",
  "wss://relay.snort.social",
  "wss://eden.nostr.land",
  "wss://nostr.bitcoiner.social",
  "wss://nostrpub.yeghro.site",
];

export async function connectToNDK() {
  if (!ndk || !ndk.isConnected()) {
    try {
      nip07signer = new NDKNip07Signer();
      ndk = new NDK({
        signer: nip07signer,
        explicitRelayUrls: relayUrls,
        autoConnectUserRelays: false, // This can be set to false if you don't want to auto-connect user relays
      });
      await ndk.connect();
      console.log("NDK connected");
    } catch (error) {
      console.error("Failed to connect to NDK:", error);
      // Add logic to handle reconnection or notify the user
    }
  } else {
    console.log("Connected to Relays");
  }
}

export async function loginWithNostr() {
  try {
    await connectToNDK();
    const userPublicKey = await nip07signer.user();
    console.log("User public key obtained:", userPublicKey);

    // Use ndk.getUser to fetch user data with the userPublicKey
    ndkUser = await ndk.getUser({ npub: userPublicKey.npub });
    console.log("Fetched NDK user data:", ndkUser);

    ndk.activeUser = ndkUser;
    console.log("Active user set in NDK:", ndk.activeUser);

    // Fetch profile information to get the user's relays and other profile data
    await ndkUser.fetchProfile();
    console.log("User profile data after fetching:", ndkUser);

    return ndkUser.profile;
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

export async function fetchEvents(filter) {
  console.log("Fetching events with filter:", filter);

  const opts = {
    closeOnEose: true, // Close connection after End of Stream event
    // cacheUsage: NDKSubscriptionCacheUsage.PARALLEL, // Use both cache and relay
  };

  try {
    const events = await ndk.fetchEvents(filter, opts);
    console.log("Fetched events:", events);
    return events;
  } catch (error) {
    console.error("Error fetching events:", error);
    return new Set(); // Return an empty set on error
  }
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
