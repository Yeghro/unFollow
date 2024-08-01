import { relays } from "./nostrService.js";

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function createSubscriptionId() {
  return Math.random().toString(36).substr(2, 9);
}

function isValidHexKey(str) {
  return /^[0-9a-fA-F]{64}$/.test(str);
}

function createNostrRequest(subscriptionId, authors, kinds, limit = 1) {
  return JSON.stringify(["REQ", subscriptionId, { authors, kinds, limit }]);
}

function createCloseRequest(subscriptionId) {
  return JSON.stringify(["CLOSE", subscriptionId]);
}

function fetchEventsFromRelay(relay, request, subscriptionId, eventKind) {
  return new Promise(function (resolve) {
    const events = [];
    function onMessage(event) {
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
    }
    relay.addEventListener("message", onMessage);
    relay.send(request);
  });
}
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
    Object.values(relays).map(function (relay) {
      return fetchEventsFromRelay(relay, request, subscriptionId, 3);
    })
  );
  const events = allEvents.flat();
  const latestEvent = events.reduce(function (latest, event) {
    if (!latest || event.created_at > latest.created_at) {
      return event;
    }
    return latest;
  }, null);
  if (latestEvent) {
    const followedPubkeys = new Set();
    const followedTopics = new Set();
    latestEvent.tags.forEach(function (tag) {
      if (tag[0] === "p" && tag[1] && isValidHexKey(tag[1])) {
        followedPubkeys.add(tag[1]);
      } else if (tag[0] === "t" && tag[1]) {
        followedTopics.add(tag[1]);
      }
    });
    console.log("Followed Topics for pubkey:", followedTopics);
    return {
      followedPubkeys: Array.from(followedPubkeys),
      followedTopics: Array.from(followedTopics),
      totalPubkeys: followedPubkeys.size,
      totalTopics: followedTopics.size,
      eventContent: latestEvent.content,
    };
  }
  return {
    followedPubkeys: [],
    followedTopics: [],
    totalPubkeys: 0,
    totalTopics: 0,
    eventContent: null,
  };
}
