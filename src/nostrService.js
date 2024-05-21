import NDK, { NDKNip07Signer, NDKUser } from "@nostr-dev-kit/ndk";

export let ndk;
let ndkUser;

export async function loginWithNostr() {
  const relayUrls = [
    "wss://relay.primal.net",
    "wss://nostrpub.yeghro.site",
    "wss://relay.damus.io",
  ];

  const nip07signer = new NDKNip07Signer();
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

export async function fetchEvents(filter, timeoutMs = 10000) {
  console.log("Fetching events with filter:", filter);
  const events = await ndk.fetchEvents(filter, {
    relays: ndk.explicitRelayUrls,
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
