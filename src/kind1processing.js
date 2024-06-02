import { ndk, fetchEvents } from "./nostrService.js";

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
export async function fetchLatestKind1EventsWithRelays(
  pubkeys,
  updateProgress,
  timeout = 60000
) {
  const eventsMap = new Map();
  const total = pubkeys.length;
  let completed = 0;

  // Helper function to fetch events for a batch of pubkeys
  const fetchBatch = async (batch) => {
    const filter = {
      authors: batch,
      kinds: [1, 0],
    };
    console.log(`Fetching events for pubkeys: ${batch.join(", ")}`);

    try {
      const events = await fetchEvents(filter);
      console.log(`Fetched events for batch: ${batch.join(", ")}`, events);

      if (events && events.size > 0) {
        events.forEach((event) => {
          console.log(`Processing event: ${event.pubkey}`, event);
          if (!eventsMap.has(event.pubkey)) {
            eventsMap.set(event.pubkey, { pubkey: event.pubkey, event });
          }
        });
      } else {
        console.log(`No events found for batch: ${batch.join(", ")}`);
      }
    } catch (error) {
      console.error(
        `Error fetching events for batch: ${batch.join(", ")}`,
        error
      );
    }

    completed += batch.length;
    const progress = Math.round((completed / total) * 100);
    updateProgress(progress);
    console.log(`Progress: ${progress}%`);
  };

  // Split pubkeys into batches of 50 and fetch events for each batch
  const batchSize = 50;
  const fetchPromises = [];
  for (let i = 0; i < total; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    fetchPromises.push(fetchBatch(batch));
  }

  // Wait for all fetch operations to complete
  await Promise.all(fetchPromises);

  console.log("All events fetched.");
  console.log(`Total events processed: ${eventsMap.size}`);
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

  latestEvents.forEach(({ pubkey, event }) => {
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
