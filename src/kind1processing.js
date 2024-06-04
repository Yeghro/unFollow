import { ndk } from "./nostrService.js";

export function extractPubkeysFromKind3Event(events) {
  const pubkeys = [];

  events.forEach((event) => {
    if (event && event.tags) {
      event.tags.forEach((tag) => {
        if (tag[0] === "p" && tag[1]) {
          pubkeys.push(tag[1]);
        }
      });
    }
  });

  return pubkeys;
}
export let batchSize;
// Fetch latest kind 1 events
export async function fetchLatestKind1EventsWithRelays(
  pubkeys,
  updateProgress,
  batchSize = 64
) {
  const eventsMap = new Map();
  const total = pubkeys.length;
  let completed = 0;
  let totalEventsReceived = 0;
  let uniquePubkeysWithEvents = new Set();

  // Helper function to fetch the latest event for a single pubkey
  const fetchSinglePubkey = async (pubkey) => {
    const filter = {
      authors: [pubkey],
      kinds: [1, 0],
    };
    console.log("pubkey being fetched:", pubkey);
    try {
      const events = await ndk.fetchEvents(filter, { closeOnEose: true });
      totalEventsReceived += events.size;

      if (events.size === 0) {
        console.log(`No events found for pubkey: ${pubkey}`);
      }

      events.forEach((event) => {
        uniquePubkeysWithEvents.add(event.pubkey);
        // Add the event to the map, keyed by its pubkey, ensuring no duplicates
        if (
          !eventsMap.has(event.pubkey) ||
          event.created_at > eventsMap.get(event.pubkey).created_at
        ) {
          eventsMap.set(event.pubkey, event);
          console.log(
            `Kind 1 event received for pubkey: ${event.pubkey}, created at: ${event.created_at}`
          );
        }
      });

      completed += 1;
      const progress = (completed / total) * 100;
      updateProgress(progress);
      console.log(`Progress: ${progress}%`);
      console.log(`Total events received: ${totalEventsReceived}`);
    } catch (error) {
      console.error(`Error fetching events for pubkey: ${pubkey}`, error);
    }
  };

  // Split pubkeys into batches and fetch events in parallel for each batch
  const fetchBatch = async (batch) => {
    const fetchPromises = batch.map((pubkey) => fetchSinglePubkey(pubkey));
    await Promise.all(fetchPromises);
  };

  // Split pubkeys into batches and execute fetchBatch in sequence
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    await fetchBatch(batch);
  }

  // Verification step: Ensure all unique pubkeys' events are correctly processed
  uniquePubkeysWithEvents.forEach((pubkey) => {
    if (!eventsMap.has(pubkey)) {
      console.log(`No event found for pubkey: ${pubkey}`);
    } else {
      console.log(`Event found for pubkey: ${pubkey}`);
    }
  });

  // Log the summary of all received events to ensure all are processed
  const summary = {
    totalEventsReceived,
    totalUniquePubkeys: uniquePubkeysWithEvents.size,
    totalEventsProcessed: eventsMap.size,
    uniquePubkeysWithoutEvents: pubkeys.filter(
      (pubkey) => !uniquePubkeysWithEvents.has(pubkey)
    ),
    pubkeysWithMissingEvents: Array.from(uniquePubkeysWithEvents).filter(
      (pubkey) => !eventsMap.has(pubkey)
    ),
  };

  console.log("All received events:", Array.from(eventsMap.values()));
  console.log("Summary:", summary);

  console.log(
    `Total unique pubkeys with events: ${uniquePubkeysWithEvents.size}`
  );
  console.log("Batch fetching completed.");
  console.log(`Total events processed: ${eventsMap.size}`);
  updateProgress(100); // Ensure progress bar reaches 100%
  return Array.from(eventsMap.values());
}

// Get non-active pubkeys
export function getNonActivePubkeys(latestEvents, inactiveMonths) {
  const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
  const inactiveTimestamp =
    currentTimestamp - inactiveMonths * 30 * 24 * 60 * 60; // Threshold timestamp for inactivity
  const nonActivePubkeys = [];

  console.log(`Current timestamp: ${currentTimestamp}`);
  console.log(`Inactive timestamp threshold: ${inactiveTimestamp}`);

  latestEvents.forEach((event) => {
    const pubkey = event.pubkey;
    if (event) {
      const createdAt = event.created_at;
      const isInactive = createdAt < inactiveTimestamp;
      console.log(
        `Pubkey: ${pubkey}, Created At: ${createdAt}, Is Inactive: ${isInactive}`
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
