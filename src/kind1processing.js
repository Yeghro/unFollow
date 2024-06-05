import { ndk } from "./nostrService.js";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import InMemoryCacheAdapter from "./InMemoryCacheAdapter";

// Initialize the cache adapter
const cacheAdapter = new InMemoryCacheAdapter();

// Extract pubkeys from kind 3 events
export function extractPubkeysFromKind3Event(events) {
  const pubkeys = new Set();

  // Validate that 'events' is either a Set or an Array
  if (!(events instanceof Set) && !(events instanceof Array)) {
    throw new Error("Expected 'events' to be a Set or an Array");
  }

  // Convert to an array if events is a Set
  const eventsArray = events instanceof Set ? Array.from(events) : events;

  // Assuming 'eventsArray' is an Array, we take the first event.
  const event = eventsArray[0];

  if (event) {
    const tags = event.tags;
    tags.forEach((tag) => {
      if (tag[0] === "p") {
        pubkeys.add(tag[1]);
      }
    });
  }

  return Array.from(pubkeys);
}

// Fetch event for a given pubkey and handle parallel fetching
export async function fetchEventsForPubkeys(pubkeys, kinds = [1], limit = 1) {
  const filter = {
    kinds,
    authors: pubkeys,
    limit,
  };

  console.log(`Fetching events for pubkeys with filter:`, filter);

  try {
    // Fetch events using the ndk instance directly with the combined filter
    const events = await ndk.fetchEvents(filter);

    console.log(`Fetched events for pubkeys:`, Array.from(events));

    const eventsByPubkey = {};
    events.forEach((event) => {
      if (!eventsByPubkey[event.pubkey]) {
        eventsByPubkey[event.pubkey] = [];
      }
      eventsByPubkey[event.pubkey].push(event);
    });

    return eventsByPubkey;
  } catch (error) {
    console.error(`Error fetching events for pubkeys:`, error);
    return {};
  }
}

export async function fetchLatestKind1EventsWithRelays(
  pubkeys,
  updateProgress
) {
  const eventsByPubkey = await fetchEventsForPubkeys(pubkeys, [1], 1);

  // Update progress for each pubkey
  pubkeys.forEach((pubkey, index) => {
    updateProgress((index + 1) / pubkeys.length);
  });

  // Include pubkeys with null events to indicate inactivity
  const nonActivePubkeys = pubkeys.map((pubkey) => {
    const events = eventsByPubkey[pubkey];
    if (!events || events.length === 0) {
      console.log(`No event found for pubkey ${pubkey}, considering inactive`);
      return { pubkey, event: null };
    } else {
      const event = events[0];
      console.log(`Event found for pubkey ${pubkey}:`, event);
      return { pubkey, event };
    }
  });

  return nonActivePubkeys;
}

// Get non-active pubkeys
export function getNonActivePubkeys(latestEvents, inactiveMonths) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const inactiveTimestamp =
    currentTimestamp - inactiveMonths * 30 * 24 * 60 * 60;
  const nonActivePubkeys = [];

  latestEvents.forEach(({ pubkey, event }) => {
    if (event) {
      const createdAt = event.created_at;
      const isKind1 = event.kind === 1;
      const isInactive = isKind1 && createdAt < inactiveTimestamp;

      // Simplified logging without serialization
      console.log(`Pubkey: ${pubkey}`);
      console.log(`Event:`, event);
      console.log(`Event kind: ${event.kind}`);
      console.log(`Event created_at: ${createdAt}`);
      console.log(`Is Kind 1: ${isKind1}`);
      console.log(`Is inactive: ${isInactive}`);
      console.log(`Inactive threshold: ${inactiveTimestamp}`);

      if (isInactive) {
        nonActivePubkeys.push(pubkey);
      }
    } else {
      console.log(`No event found for pubkey ${pubkey}, considering inactive`);
      nonActivePubkeys.push(pubkey);
    }
  });

  return nonActivePubkeys;
}
