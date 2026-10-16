import { relays } from "./nostrService.js";

const QUERY_TIMEOUT = 8000;

function createSubscriptionId() {
  return Math.random().toString(36).substr(2, 9);
}

function isValidHexKey(str) {
  return /^[0-9a-fA-F]{64}$/.test(str);
}

// Runs one subscription against one relay. Always settles: resolves on EOSE,
// CLOSED, socket close, or timeout, so a dead relay can never hang the caller.
// `ok` is true only when the relay finished the query (EOSE).
export function queryRelay(relay, filters, { timeout = QUERY_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    const events = [];
    if (relay.readyState !== WebSocket.OPEN) {
      resolve({ events, ok: false });
      return;
    }

    const subscriptionId = createSubscriptionId();
    let settled = false;
    let timer;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      relay.removeEventListener("message", onMessage);
      relay.removeEventListener("close", onClose);
      if (relay.readyState === WebSocket.OPEN) {
        relay.send(JSON.stringify(["CLOSE", subscriptionId]));
      }
      resolve({ events, ok });
    };

    const onClose = () => finish(false);

    const onMessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message[1] !== subscriptionId) return;
      if (message[0] === "EVENT" && message[2]) {
        events.push(message[2]);
      } else if (message[0] === "EOSE") {
        finish(true);
      } else if (message[0] === "CLOSED") {
        finish(false);
      }
    };

    relay.addEventListener("message", onMessage);
    relay.addEventListener("close", onClose);
    timer = setTimeout(() => finish(false), timeout);
    relay.send(JSON.stringify(["REQ", subscriptionId, ...filters]));
  });
}

// Queries every connected relay and returns { events, anyOk }.
async function queryAllRelays(filters) {
  const results = await Promise.all(
    Object.values(relays).map((relay) => queryRelay(relay, filters))
  );
  return {
    events: results.flatMap((result) => result.events),
    anyOk: results.some((result) => result.ok),
  };
}

// Returns only the newest kind 0 per pubkey, newest profile first.
export async function fetchKind0Events(pubkeys) {
  const { events } = await queryAllRelays([{ authors: pubkeys, kinds: [0] }]);
  const newest = new Map();
  for (const event of events) {
    if (event.kind !== 0) continue;
    const current = newest.get(event.pubkey);
    if (!current || event.created_at > current.created_at) {
      newest.set(event.pubkey, event);
    }
  }
  return Array.from(newest.values()).sort((a, b) => b.created_at - a.created_at);
}

// Returns the newest kind 3 plus the follow list parsed from it. `event` is the
// raw event (or null when none exists) so callers can republish it untouched.
export async function fetchKind3Events(pubkey) {
  const { events, anyOk } = await queryAllRelays([
    { authors: [pubkey], kinds: [3], limit: 1 },
  ]);
  if (!anyOk) {
    throw new Error("No relay responded when fetching the follow list.");
  }

  const latestEvent = events
    .filter((event) => event.kind === 3 && event.pubkey === pubkey)
    .reduce(
      (latest, event) =>
        !latest || event.created_at > latest.created_at ? event : latest,
      null
    );

  if (!latestEvent) {
    return { event: null, followedPubkeys: [], totalPubkeys: 0 };
  }

  const followedPubkeys = new Set();
  latestEvent.tags.forEach((tag) => {
    if (tag[0] === "p" && tag[1] && isValidHexKey(tag[1])) {
      followedPubkeys.add(tag[1]);
    }
  });
  return {
    event: latestEvent,
    followedPubkeys: Array.from(followedPubkeys),
    totalPubkeys: followedPubkeys.size,
  };
}
