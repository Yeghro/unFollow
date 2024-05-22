import { ndk, fetchEvents, relayUrls } from "./nostrService.js";
import { NDKEvent } from "@nostr-dev-kit/ndk";

export async function processKind3EventWithProgress(hexKey) {
  const filter = { kinds: [3], authors: [hexKey] };
  console.log("Filter for kind 3 events:", filter);

  const events = await fetchEvents(filter);
  console.log("Fetched kind 3 events:", events);

  if (events && events.size > 0) {
    console.log("Number of kind 3 events found:", events.size);

    const pubkeys = extractPubkeysFromKind3Event(events);
    console.log("Pubkeys extracted:", pubkeys);

    const progressBar = document.getElementById("progressBar");
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";

    const total = pubkeys.length;
    let completed = 0;

    const updateProgress = () => {
      completed++;
      const percent = Math.round((completed / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressBar.textContent = `${percent}%`; // Ensure this line is updating the progress text
    };

    const latestEvents = await fetchLatestKind1EventsWithRelays(
      pubkeys,
      updateProgress
    );
    console.log("Events per pubkey:", latestEvents);
    const nonActivePubkeys = getNonActivePubkeys(latestEvents, pubkeys);

    // Separate active and non-active pubkeys
    const activePubkeys = pubkeys.filter(
      (pubkey) => !nonActivePubkeys.includes(pubkey)
    );

    return {
      totalPubkeys: pubkeys.length,
      nonActivePubkeys: nonActivePubkeys,
      activePubkeys: activePubkeys,
    };
  } else {
    console.log("No kind 3 events found.");
    return {
      totalPubkeys: 0,
      nonActivePubkeys: [],
      activePubkeys: [],
    };
  }
}

function extractPubkeysFromKind3Event(events) {
  const pubkeys = new Set();

  // Assuming 'events' is a Set, we take the first event.
  const event = events.values().next().value;

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

  async function fetchEventForPubkeyFromRelay(pubkey, retries = 0) {
    const filter = { kinds: [1], authors: [pubkey], limit: 1 };

    console.log(
      `Fetching latest kind 1 event for pubkey ${pubkey} with filter:`,
      filter
    );

    try {
      const events = await ndk.fetchEvents(filter);

      if (events && events.size > 0) {
        const event = new NDKEvent(ndk, events.values().next().value);
        console.log(`Fetched event for pubkey ${pubkey}:`, event);
        return event;
      }
    } catch (error) {
      console.error(`Error fetching kind 1 event for pubkey ${pubkey}:`, error);
      if (retries < maxRetries) {
        console.log(`Retrying... (${retries + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return fetchEventForPubkeyFromRelay(pubkey, retries + 1);
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
      latestEvents.push({ pubkey, event });
    } else {
      latestEvents.push({ pubkey, event: null });
    }
    updateProgress(latestEvents.length);
  }

  return latestEvents;
}

function getNonActivePubkeys(latestEvents, pubkeys) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const eightMonthsAgo = currentTimestamp - 8 * 30 * 24 * 60 * 60;

  const nonActivePubkeys = [];

  latestEvents.forEach(({ pubkey, event }) => {
    if (event) {
      const createdAt = event.created_at;
      const isOlderThanEightMonths = createdAt < eightMonthsAgo;
      console.log(
        `Latest event for pubkey ${pubkey}:`,
        event.rawEvent(),
        `Older than 8 months: ${isOlderThanEightMonths}`
      );

      if (isOlderThanEightMonths) {
        nonActivePubkeys.push(pubkey);
      }
    } else {
      console.log(`No kind 1 event found for pubkey ${pubkey}`);
      nonActivePubkeys.push(pubkey);
    }
  });

  return nonActivePubkeys;
}
