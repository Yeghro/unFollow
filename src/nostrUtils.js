import { ndk, relayUrls } from "./nostrService.js";
import { NDKEvent } from "@nostr-dev-kit/ndk";

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

export async function fetchLatestKind1EventsWithRelays(
  pubkeys,
  updateProgress
) {
  const latestEvents = [];
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second delay between retries

  async function fetchEventForPubkeyFromRelay(pubkey, relayUrl, retries = 0) {
    const filter = { kinds: [1], authors: [pubkey], limit: 1 };

    console.log(
      `Fetching latest kind 1 event for pubkey ${pubkey} from relay ${relayUrl} with filter:`,
      filter
    );

    try {
      const events = await ndk.fetchEvents(filter, relayUrl); // Assuming ndk.fetchEvents can take relayUrl as a parameter

      if (events && events.size > 0) {
        const event = new NDKEvent(ndk, events.values().next().value); // Wrapped in NDKEvent
        console.log(`Fetched event for pubkey ${pubkey}:`, event);
        return event;
      }
    } catch (error) {
      console.error(
        `Error fetching kind 1 event for pubkey ${pubkey} from relay ${relayUrl}:`,
        error
      );
      if (retries < maxRetries) {
        console.log(`Retrying... (${retries + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return fetchEventForPubkeyFromRelay(pubkey, relayUrl, retries + 1);
      }
    }

    return null;
  }

  async function fetchEventForPubkey(pubkey) {
    const fetchPromises = relayUrls.map((relayUrl) =>
      fetchEventForPubkeyFromRelay(pubkey, relayUrl)
    );
    const results = await Promise.all(fetchPromises);

    // Return the first event that is not null
    return results.find((event) => event !== null);
  }

  for (const pubkey of pubkeys) {
    const event = await fetchEventForPubkey(pubkey);
    if (event) {
      latestEvents.push({ pubkey, event }); // Ensured event is NDKEvent
    } else {
      latestEvents.push({ pubkey, event: null });
    }
    updateProgress();
  }

  return latestEvents;
}

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
