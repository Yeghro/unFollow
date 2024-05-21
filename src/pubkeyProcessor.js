import { fetchEvents } from "./nostrService.js";
import { NDKEvent } from "@nostr-dev-kit/ndk";

// Helper function to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Queue to control the number of concurrent requests
class Queue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(() => task().then(resolve, reject));
      this.next();
    });
  }

  next() {
    if (this.running < this.concurrency && this.queue.length) {
      const task = this.queue.shift();
      this.running++;
      task().finally(() => {
        this.running--;
        this.next();
      });
    }
  }
}

// Set concurrency level
const queue = new Queue(600); // Adjust concurrency level here

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
      progressBar.textContent = `${percent}%`;
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
  const relayUrls = [
    "wss://relay.primal.net",
    "wss://nostrpub.yeghro.site",
    "wss://relay.damus.io",
  ];

  for (const pubkey of pubkeys) {
    await queue.run(async () => {
      const filter = { kinds: [1], authors: [pubkey], limit: 1 };
      const relayUrl = relayUrls[latestEvents.length % relayUrls.length];
      console.log(
        `Fetching latest kind 1 event for pubkey ${pubkey} from relay ${relayUrl} with filter:`,
        filter
      );
      try {
        const events = await fetchEvents(filter, 10000, relayUrl);
        console.log(
          `Fetched events for pubkey ${pubkey} from relay ${relayUrl}:`,
          events
        );
        if (events.size > 0) {
          const event = events.values().next().value;
          const ndkEvent = new NDKEvent(event);
          console.log(
            `Fetched event for pubkey ${pubkey} from relay ${relayUrl}:`,
            ndkEvent
          );
          latestEvents.push(ndkEvent);
        } else {
          console.log(
            `No kind 1 event found for pubkey ${pubkey} from relay ${relayUrl}`
          );
          latestEvents.push(null);
        }
      } catch (error) {
        console.error(
          `Error fetching kind 1 event for pubkey ${pubkey} from relay ${relayUrl}:`,
          error
        );
        latestEvents.push(null);
      }
      updateProgress();
    });
    await delay(20); // Adjust delay as needed
  }
  return latestEvents;
}

function getNonActivePubkeys(latestEvents, pubkeys) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const eightMonthsAgo = currentTimestamp - 8 * 30 * 24 * 60 * 60;

  const nonActivePubkeys = [];

  latestEvents.forEach((event, index) => {
    if (event) {
      const createdAt = event.created_at;
      const isOlderThanEightMonths = createdAt < eightMonthsAgo;
      console.log(
        `Latest event for pubkey ${pubkeys[index]}:`,
        event.rawEvent(),
        `Older than 8 months: ${isOlderThanEightMonths}`
      );

      if (isOlderThanEightMonths) {
        nonActivePubkeys.push(pubkeys[index]);
      }
    } else {
      console.log(`No kind 1 event found for pubkey ${pubkeys[index]}`);
      nonActivePubkeys.push(pubkeys[index]);
    }
  });

  return nonActivePubkeys;
}
