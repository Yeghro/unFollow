import { subscribeToRelays } from "./nostrService.js";

// Extract pubkeys from kind 3 events
export function extractPubkeysFromKind3Event(events) {
  const pubkeys = new Set();

  if (!(events instanceof Set) && !(events instanceof Array)) {
    throw new Error("Expected 'events' to be a Set or an Array");
  }

  events.forEach((event) => {
    if (event && event.tags) {
      event.tags.forEach((tag) => {
        if (tag[0] === "p") {
          pubkeys.add(tag[1]);
        }
      });
    }
  });

  return Array.from(pubkeys);
}

// Fetch latest kind 1 events with relays using a single subscription
export async function fetchLatestKind1EventsWithRelays(
  pubkeys,
  updateProgress,
  timeout = 60000
) {
  const filter = {
    authors: pubkeys,
    kinds: [1, 0],
  };

  let eventsMap = new Map();

  console.log("Starting subscription with filter:", filter);

  const events = await subscribeToRelays(
    filter,
    (event) => {
      if (event.kind === 1) {
        eventsMap.set(event.pubkey, event);
        console.log(`Kind 1 event received for pubkey: ${event.pubkey}`);
        const progress = (eventsMap.size / pubkeys.length) * 100;
        updateProgress(progress); // Update progress correctly
        console.log(`Progress: ${progress}%`);
      } else {
        console.log(`Non-kind 1 event received for pubkey: ${event.pubkey}`);
      }
    },
    timeout
  );

  console.log("Subscription completed.");
  console.log(`Total events processed: ${eventsMap.size}`);
  updateProgress(100); // Ensure progress bar reaches 100%
  return Array.from(eventsMap.values());
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
      const isInactive = createdAt < inactiveTimestamp;
      console.log(
        `Latest event for pubkey ${pubkey}:`,
        event.rawEvent(),
        `Older than ${inactiveMonths} months: ${isInactive}`
      );
      if (isInactive) {
        nonActivePubkeys.push(pubkey);
      }
    } else {
      console.log(`No kind 1 event found for pubkey ${pubkey}`);
      nonActivePubkeys.push(pubkey);
    }
  });

  return nonActivePubkeys;
}
