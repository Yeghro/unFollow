import { nip19 } from "nostr-tools";

export function decodePubKey(requestedPubkey) {
  if (requestedPubkey.startsWith("npub")) {
    const { type, data } = nip19.decode(requestedPubkey);
    if (type !== "npub") {
      throw new Error("Invalid npub");
    }
    return data;
  } else if (requestedPubkey.startsWith("nostr:npub")) {
    const { type, data } = nip19.decode(requestedPubkey.slice(6));
    if (type !== "npub") {
      throw new Error("Invalid nostr:npub");
    }
    return data;
  }
  return requestedPubkey;
}
