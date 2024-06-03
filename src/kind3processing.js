import { ndk, ndkUser, connectToNDK } from "./nostrService.js";
import { NDKUser } from "@nostr-dev-kit/ndk";
import {
  extractPubkeysFromKind3Event,
  fetchLatestKind1EventsWithRelays,
  getNonActivePubkeys,
  batchSize,
} from "./kind1processing.js";
import { displayTotalPubkeys, updateProgressBar } from "./output.js";

// Process kind 3 events and determine non-active pubkeys
export async function processKind3EventWithProgress(inactiveMonths) {
  const filter = { kinds: [3], authors: [ndkUser.pubkey] };
  console.log("Filter for kind 3 events:", filter);

  const events = await ndk.fetchEvents(filter, { closeOnEose: true });
  console.log("Fetched kind 3 events:", events);

  if (events && (events.size > 0 || events.length > 0)) {
    console.log("Number of kind 3 events found:", events.size || events.length);
    const pubkeys = extractPubkeysFromKind3Event(events);
    console.log("Pubkeys extracted:", pubkeys);

    // Display the total number of pubkeys found immediately
    displayTotalPubkeys(pubkeys.length);

    const total = pubkeys.length;
    let completed = 0;

    const updateProgress = (progress) => {
      completed = Math.min(progress, 100); // Ensure progress doesn't exceed 100%
      updateProgressBar(completed); // Update the progress bar in the UI
      console.log(`Progress: ${completed}%`);
    };

    // Fetch latest kind 1 events for all pubkeys in batches
    let latestEvents = await fetchLatestKind1EventsWithRelays(
      pubkeys,
      updateProgress
    );
    console.log("Events per pubkey:", latestEvents);

    // Determine non-active pubkeys after fetching all events
    const nonActivePubkeys = getNonActivePubkeys(latestEvents, inactiveMonths);
    console.log("Non-active pubkeys:", nonActivePubkeys);

    // Separate active and non-active pubkeys
    const activePubkeys = pubkeys.filter(
      (pubkey) => !nonActivePubkeys.includes(pubkey)
    );

    // Convert non-active pubkeys to npubs
    const nonActiveNpubs = nonActivePubkeys.map((pubkey) => {
      const convertToNpubs = new NDKUser({ pubkey });
      return convertToNpubs.npub;
    });

    // Extract kind 0 events for display
    const kind0Events = latestEvents
      .filter((event) => event && event.kind === 0)
      .map((event) => ({
        pubkey: event.pubkey,
        content: JSON.parse(event.content),
      }));

    return {
      totalPubkeys: pubkeys.length,
      nonActivePubkeys: nonActivePubkeys,
      nonActiveNpubs: nonActiveNpubs,
      activePubkeys: activePubkeys,
      kind0Events: kind0Events,
    };
  } else {
    console.log("No kind 3 events found.");
    displayTotalPubkeys(0);
    return {
      totalPubkeys: 0,
      nonActivePubkeys: [],
      nonActiveNpubs: [],
      activePubkeys: [],
      kind0Events: [],
    };
  }
}

export let hexKey;
export async function processManualPubkey(manualPubkey, inactiveMonths) {
  let hexKey;
  if (manualPubkey.startsWith("npub")) {
    const ndkUser = new NDKUser({ npub: manualPubkey });
    hexKey = ndkUser.pubkey;
  } else {
    hexKey = manualPubkey;
  }

  await connectToNDK(); // Call connectToNDK to initialize and connect the ndk object

  const {
    totalPubkeys,
    nonActivePubkeys,
    nonActiveNpubs,
    activePubkeys,
    kind0Events,
  } = await processKind3EventWithProgress(hexKey, inactiveMonths);

  return {
    totalPubkeys,
    nonActivePubkeys,
    nonActiveNpubs,
    activePubkeys,
    kind0Events, // Include kind 0 events in the return
  };
}
