import { nip19 } from "nostr-tools";
import { fetchKind0Events, queryRelay } from "./fetching.js";

// Normalize to a canonical wss:// URL so "wss://x.io/" and "wss://x.io" match.
export const normalizeRelayUrl = (raw) => {
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== "wss:") return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const normalizeRelayUrls = (list) => [
  ...new Set(list.map(normalizeRelayUrl).filter(Boolean)),
];

// Default relays come from VITE_RELAY_URLS (comma-separated) at build time.
const RELAY_URLS = normalizeRelayUrls(
  (import.meta.env.VITE_RELAY_URLS || "").split(",")
);

const CONNECTION_TIMEOUT = 5000;
const RESPONSE_TIMEOUT = 5000;

let relays = {};
let activeUser = null;
// Relays taken from the target user's relay list (kind 10002); queried first.
const userRelayUrls = new Set();

const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
};

// Reads the pubkey from the NIP-07 extension. Throws if none is available.
export const initializeNip07Signer = async () => {
  if (typeof window === "undefined" || !window.nostr) {
    throw new Error(
      "No Nostr extension (NIP-07) detected. Install one such as Alby or nos2x and try again."
    );
  }
  const pubkey = await window.nostr.getPublicKey();
  activeUser = { pubkey, npub: nip19.npubEncode(pubkey) };
  logger.info(`Signer is ready and user is: ${activeUser.npub}`);
  return activeUser;
};

export const signEvent = (event) => window.nostr.signEvent(event);

const createWebSocket = (url) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeoutId = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection to ${url} timed out`));
    }, CONNECTION_TIMEOUT);

    ws.onopen = () => {
      clearTimeout(timeoutId);
      resolve(ws);
    };

    ws.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error(`Connection to ${url} failed`));
    };
  });
};

// Opens a short-lived socket that is NOT added to the shared relays map.
// Resolves null if the relay can't be reached in time.
export const openTemporaryRelay = async (url) => {
  try {
    return await createWebSocket(url);
  } catch {
    return null;
  }
};

const isOpen = (url) => relays[url]?.readyState === WebSocket.OPEN;

const connectToRelay = async (url) => {
  try {
    const ws = await createWebSocket(url);
    ws.onerror = null;
    // Drop dead sockets so they are reconnected on the next connectToRelays()
    ws.onclose = () => {
      if (relays[url] === ws) delete relays[url];
    };
    relays[url] = ws;
    logger.info(`Successfully connected to relay: ${url}`);
    return true;
  } catch (error) {
    logger.warn(`Failed to connect to relay ${url}: ${error.message}`);
    return false;
  }
};

export const connectToRelays = async (urls = RELAY_URLS) => {
  if (urls.length === 0 && Object.keys(relays).length === 0) {
    throw new Error("No relays configured. Set VITE_RELAY_URLS in .env and rebuild.");
  }

  const newUrls = urls.filter((url) => !isOpen(url));
  logger.info(`Attempting to connect to relays: ${newUrls.join(", ")}`);

  const results = await Promise.all(newUrls.map(connectToRelay));
  logger.info(
    `Connected to ${results.filter(Boolean).length} of ${newUrls.length} relays.`
  );

  if (Object.keys(relays).length === 0) {
    throw new Error("Could not connect to any relay.");
  }
};

// Returns every relay in the user's newest relay list (kind 10002), read and write.
const getUserRelays = async (pubkey) => {
  logger.info(`Fetching relay list for pubkey: ${pubkey}`);
  const results = await Promise.all(
    Object.values(relays).map((ws) =>
      queryRelay(ws, [{ authors: [pubkey], kinds: [10002], limit: 1 }], {
        timeout: RESPONSE_TIMEOUT,
      })
    )
  );

  const newest = results
    .flatMap((result) => result.events)
    .filter((event) => event.kind === 10002)
    .reduce(
      (latest, event) =>
        !latest || event.created_at > latest.created_at ? event : latest,
      null
    );
  if (!newest) return [];

  return normalizeRelayUrls(
    newest.tags.filter((tag) => tag[0] === "r").map((tag) => tag[1])
  );
};

// Connects the default relays plus all of the target user's relays, then
// returns the newest profile(s) available across all of them.
export const connectUsersRelays = async (targetPubkey) => {
  logger.info(`Starting connectUsersRelays for pubkey: ${targetPubkey}`);

  await connectToRelays();

  const userRelays = await getUserRelays(targetPubkey);
  await connectToRelays(userRelays);

  userRelayUrls.clear();
  userRelays.filter(isOpen).forEach((url) => userRelayUrls.add(url));
  logger.info(`User relays connected: ${Array.from(userRelayUrls).join(", ")}`);

  return await fetchKind0Events([targetPubkey]);
};

export { activeUser, relays, userRelayUrls };
