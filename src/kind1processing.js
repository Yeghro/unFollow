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
export let batchSize = 100;
// Fetch latest kind 1 events
export async function fetchLatestKind1EventsWithRelays(
  pubkeys,
  updateProgress,
  batchSize
) {
  let eventsMap = new Map();
  let totalFetched = 0;
  let totalPubkeys = pubkeys.length;

  // Helper function to fetch events for a batch of pubkeys
  const fetchBatch = async (batch) => {
    const filter = {
      authors: batch,
      kinds: [1],
    };
    console.log(`Fetching events for pubkeys: ${batch.join(", ")}`);

    try {
      const events = await ndk.fetchEvents(filter, { closeOnEose: true });

      events.forEach((event) => {
        if (event.kind === 1) {
          // Ensure we capture the latest event per pubkey
          if (
            !eventsMap.has(event.pubkey) ||
            event.created_at > eventsMap.get(event.pubkey).created_at
          ) {
            eventsMap.set(event.pubkey, event);
            console.log(
              `Kind 1 event received for pubkey: ${event.pubkey}, created at: ${event.created_at}`
            );
          }
        } else {
          console.log(`Non-kind 1 event received for pubkey: ${event.pubkey}`);
        }
      });
      console.log("eventsMap:", eventsMap);
      totalFetched += batch.length;
      const progress = (totalFetched / totalPubkeys) * 100;
      updateProgress(progress); // Update progress correctly
      console.log(`Progress: ${progress}%`);
    } catch (error) {
      console.error(
        `Error fetching events for batch: ${batch.join(", ")}`,
        error
      );
    }
  };

  // Split pubkeys into batches and fetch each batch sequentially
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    await fetchBatch(batch);
  }

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
