import { relays } from "./nostrService.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createSubscriptionId = () => Math.random().toString(36).substr(2, 9);

const isValidHexKey = (str) => /^[0-9a-fA-F]{64}$/.test(str);

const createNostrRequest = (subscriptionId, authors, kinds, limit = 1) =>
  JSON.stringify(["REQ", subscriptionId, { authors, kinds, limit }]);

const createCloseRequest = (subscriptionId) =>
  JSON.stringify(["CLOSE", subscriptionId]);

const fetchEventsFromRelay = (relay, request, subscriptionId, eventKind) =>
  new Promise((resolve) => {
    const events = [];
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (
        message[0] === "EVENT" &&
        message[1] === subscriptionId &&
        message[2].kind === eventKind
      ) {
        events.push(message[2]);
      }
      if (message[0] === "EOSE" && message[1] === subscriptionId) {
        relay.send(createCloseRequest(subscriptionId));
        relay.removeEventListener("message", onMessage);
        resolve(events);
      }
    };
    relay.addEventListener("message", onMessage);
    relay.send(request);
  });

export async function fetchKind0Events(pubkeys) {
  const subscriptionId = createSubscriptionId();
  const request = createNostrRequest(subscriptionId, pubkeys, [0]);

  const allEvents = await Promise.all(
    Object.values(relays).map(async (relay) => {
      const events = await fetchEventsFromRelay(
        relay,
        request,
        subscriptionId,
        0
      );
      await delay(100);
      return events;
    })
  );

  return allEvents.flat();
}

export async function fetchKind3Events(pubkey) {
  const subscriptionId = createSubscriptionId();
  const request = createNostrRequest(subscriptionId, [pubkey], [3]);

  const allEvents = await Promise.all(
    Object.values(relays).map((relay) =>
      fetchEventsFromRelay(relay, request, subscriptionId, 3)
    )
  );

  const events = allEvents.flat();
  const latestEvent = events.reduce(
    (latest, event) =>
      !latest || event.created_at > latest.created_at ? event : latest,
    null
  );

  if (latestEvent) {
    const followedPubkeys = new Set(
      latestEvent.tags
        .filter((tag) => tag[0] === "p" && tag[1] && isValidHexKey(tag[1]))
        .map((tag) => tag[1])
    );

    return {
      followedPubkeys: Array.from(followedPubkeys),
      totalPubkeys: followedPubkeys.size,
      eventContent: latestEvent.content,
    };
  }

  return { followedPubkeys: [], totalPubkeys: 0, eventContent: null };
}
