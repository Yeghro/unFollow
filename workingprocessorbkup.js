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

const queue = new Queue(4); // Adjust concurrency level here

export async function processKind3Event(hexKey) {
  const filter = { kinds: [3], authors: [hexKey] };
  console.log("Filter for kind 3 events:", filter);

  const events = await fetchEvents(filter);
  console.log("Fetched kind 3 events:", events);

  if (events && events.size > 0) {
    console.log("Number of kind 3 events found:", events.size);

    const pubkeys = extractPubkeysFromKind3Event(events);
    console.log("Pubkeys extracted:", pubkeys);

    const latestEvents = await fetchLatestKind1EventsWithQueue(pubkeys);
    console.log("Events per pubkey:", latestEvents);
    const nonActivePubkeys = getNonActivePubkeys(latestEvents, pubkeys);

    return {
      totalPubkeys: pubkeys.length,
      nonActivePubkeys: nonActivePubkeys,
    };
  } else {
    console.log("No kind 3 events found.");
    return {
      totalPubkeys: 0,
      nonActivePubkeys: [],
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

export async function fetchLatestKind1EventsWithQueue(pubkeys) {
  const latestEvents = [];
  for (const pubkey of pubkeys) {
    await queue.run(async () => {
      const filter = { kinds: [1], authors: [pubkey], limit: 1 };
      console.log(
        `Fetching latest kind 1 event for pubkey ${pubkey} with filter:`,
        filter
      );
      try {
        const events = await fetchEvents(filter);
        console.log(`Fetched events for pubkey ${pubkey}:`, events);
        if (events.size > 0) {
          const event = events.values().next().value;
          const ndkEvent = new NDKEvent(event);
          console.log(`Fetched event for pubkey ${pubkey}:`, ndkEvent);
          latestEvents.push(ndkEvent);
        } else {
          console.log(`No kind 1 event found for pubkey ${pubkey}`);
          latestEvents.push(null);
        }
      } catch (error) {
        console.error(
          `Error fetching kind 1 event for pubkey ${pubkey}:`,
          error
        );
        latestEvents.push(null);
      }
    });
    await delay(100); // Adjust delay as needed
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

// Manual testing function to verify specific pubkeys
export async function testFetchForPubkey(pubkey) {
  const filter = { kinds: [1], authors: [pubkey], limit: 1 };
  console.log(`Testing fetch for pubkey ${pubkey} with filter:`, filter);
  try {
    const events = await fetchEvents(filter);
    console.log(`Fetched events for pubkey ${pubkey}:`, events);
    if (events.size > 0) {
      const event = events.values().next().value;
      const ndkEvent = new NDKEvent(event);
      console.log(`Fetched event for pubkey ${pubkey}:`, ndkEvent);
      return ndkEvent;
    } else {
      console.log(`No kind 1 event found for pubkey ${pubkey}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching kind 1 event for pubkey ${pubkey}:`, error);
    return null;
  }
}
