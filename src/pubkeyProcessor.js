import { ndk, fetchEvents } from "./nostrService.js";

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
  const processedPubkeys = new Set(); // To track processed pubkeys
  const relayUrls = [
    "wss://relay.primal.net",
    "wss://nostrpub.yeghro.site",
    "wss://relay.damus.io",
  ];
  const connectionsPerRelay = 6;
  const totalConnections = connectionsPerRelay * relayUrls.length;
  const maxRetries = 3;

  class ConnectionQueue {
    constructor(concurrency) {
      this.concurrency = concurrency;
      this.queue = [];
      this.activeConnections = 0;
    }

    async run(task) {
      return new Promise((resolve, reject) => {
        this.queue.push({ task, resolve, reject });
        this.next();
      });
    }

    next() {
      if (this.activeConnections < this.concurrency && this.queue.length) {
        const { task, resolve, reject } = this.queue.shift();
        this.activeConnections++;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.activeConnections--;
            this.next();
          });
      }
    }
  }

  async function fetchEventForPubkeyFromRelay(pubkey, relayUrl, retries = 0) {
    const filter = { kinds: [1], authors: [pubkey], limit: 1 };

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

      if (events && events.size > 0) {
        const event = events.values().next().value;
        if (event) {
          console.log(
            `Fetched event for pubkey ${pubkey} from relay ${relayUrl}:`,
            event
          );
          return event;
        }
      }
    } catch (error) {
      console.error(
        `Error fetching kind 1 event for pubkey ${pubkey} from relay ${relayUrl}:`,
        error
      );
      if (retries < maxRetries) {
        console.log(`Retrying... (${retries + 1}/${maxRetries})`);
        return fetchEventForPubkeyFromRelay(pubkey, relayUrl, retries + 1);
      }
    }

    return null;
  }

  async function fetchEventForPubkey(pubkey) {
    for (const relayUrl of relayUrls) {
      const event = await fetchEventForPubkeyFromRelay(pubkey, relayUrl);
      if (event) {
        return event;
      }
    }
    return null;
  }

  const connectionQueue = new ConnectionQueue(totalConnections);

  async function processPubkeys() {
    const chunkSize = Math.ceil(pubkeys.length / totalConnections);
    for (let i = 0; i < pubkeys.length; i += chunkSize) {
      const pubkeysChunk = pubkeys.slice(i, i + chunkSize);
      for (const pubkey of pubkeysChunk) {
        if (!processedPubkeys.has(pubkey)) {
          processedPubkeys.add(pubkey);
          await connectionQueue.run(() =>
            fetchEventForPubkey(pubkey).then((event) => {
              if (event) {
                latestEvents.push(event);
              }
              updateProgress(latestEvents.length);
            })
          );
        }
      }
    }
  }

  await processPubkeys();

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
