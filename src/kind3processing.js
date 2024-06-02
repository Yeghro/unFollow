import { fetchEvents, connectToNDK } from "./nostrService.js";
import { NDKUser } from "@nostr-dev-kit/ndk";
import {
  extractPubkeysFromKind3Event,
  fetchLatestKind1EventsWithRelays,
  getNonActivePubkeys,
} from "./kind1processing.js";

export async function processKind3EventWithProgress(hexKey, inactiveMonths) {
  const filter = { kinds: [3], authors: [hexKey] };
  console.log("Filter for kind 3 events:", filter);

  const events = await fetchEvents(filter);
  console.log("Fetched kind 3 events:", events);

  if (events && (events.size > 0 || events.length > 0)) {
    console.log("Number of kind 3 events found:", events.size || events.length);
    const pubkeys = extractPubkeysFromKind3Event(events);
    console.log("Pubkeys extracted:", pubkeys);

    // Display the total number of pubkeys found immediately
    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: ${pubkeys.length}`;
    }

    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
      progressBar.style.width = "0%";
      progressBar.textContent = "0%";
    }

    const total = pubkeys.length;
    let completed = 0;

    const updateProgress = (progress) => {
      console.log(`Updating progress bar to ${progress}%`);
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${progress}%`;
      }
    };

    const latestEvents = await fetchLatestKind1EventsWithRelays(
      pubkeys,
      updateProgress
    );
    console.log("Events per pubkey:", latestEvents);

    const nonActivePubkeys = getNonActivePubkeys(latestEvents, inactiveMonths);
    console.log("Non-active pubkeys:", nonActivePubkeys);

    // Separate active and non-active pubkeys
    const activePubkeys = pubkeys.filter(
      (pubkey) => !nonActivePubkeys.includes(pubkey)
    );

    // Convert non-active pubkeys to npubs
    const nonActiveNpubs = nonActivePubkeys.map((pubkey) => {
      const ndkUser = new NDKUser({ pubkey });
      return ndkUser.npub;
    });

    // Extract kind 0 events for display
    const kind0Events = latestEvents
      .filter((event) => event && event.event && event.event.kind === 0)
      .map((event) => ({
        pubkey: event.pubkey,
        content: JSON.parse(event.event.content),
      }));

    return {
      totalPubkeys: pubkeys.length,
      nonActivePubkeys: nonActivePubkeys,
      nonActiveNpubs: nonActiveNpubs,
      activePubkeys: activePubkeys,
      kind0Events: kind0Events, // Added kind 0 events for further use
    };
  } else {
    console.log("No kind 3 events found.");
    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: 0`;
    }
    return {
      totalPubkeys: 0,
      nonActivePubkeys: [],
      nonActiveNpubs: [],
      activePubkeys: [],
      kind0Events: [], // Added empty kind 0 events array for consistency
    };
  }
}

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
