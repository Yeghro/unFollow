import NDK, { NDKNip07Signer, NDKUser, NDKEvent } from "@nostr-dev-kit/ndk";

export let ndk;
let ndkUser;
export let nip07signer; // Export the nip07signer variable

export async function loginWithNostr() {
  const relayUrls = [
    "wss://relay.primal.net",
    "wss://nostrpub.yeghro.site",
    "wss://relay.damus.io",
  ];
  nip07signer = new NDKNip07Signer(); // Assign the nip07signer instance to the exported variable
  ndk = new NDK({
    signer: nip07signer,
    explicitRelayUrls: relayUrls,
    autoConnectUserRelays: false,
  });
  await ndk.connect();
  console.log("NDK connected");

  const user = await nip07signer.user();
  console.log("User public key obtained:", user);

  ndkUser = new NDKUser({ npub: user.npub });
  ndkUser.ndk = ndk;
  console.log("NDK user initialized:", ndkUser);
}

export function getPublicKey() {
  return ndkUser.npub;
}

export function getHexKey() {
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
  const kind3Event = new NDKEvent(ndk, {
    kind: 3,
    tags: activePubkeys.map((pubkey) => ["p", pubkey]),
    content: "",
    created_at: Math.floor(Date.now() / 1000),
    pubkey: hexKey, // Ensure the hexKey is used as the author's pubkey
  });
  await kind3Event.sign(nip07signer); // Use nip07signer instead of ndk.signer
  await kind3Event.publish();
  console.log("Kind 3 event created and published:", kind3Event);
}
