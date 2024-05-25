import { ndk, fetchEvents, connectToNDK } from "./nostrService.js";
import { NDKUser } from "@nostr-dev-kit/ndk";
import {
  extractPubkeysFromKind3Event,
  fetchLatestKind1EventsWithRelays,
  getNonActivePubkeys,
} from "./nostrUtils.js";

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
    const updateProgress = () => {
      completed++;
      const percent = Math.round((completed / total) * 100);
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = `${percent}%`;
      }
    };

    const latestEvents = await fetchLatestKind1EventsWithRelays(
      pubkeys,
      updateProgress
    );
    console.log("Events per pubkey:", latestEvents);

    const nonActivePubkeys = getNonActivePubkeys(latestEvents, inactiveMonths);

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
    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: 0`;
    }
    return { totalPubkeys: 0, nonActivePubkeys: [], activePubkeys: [] };
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

  const { totalPubkeys, nonActivePubkeys, activePubkeys } =
    await processKind3EventWithProgress(hexKey, inactiveMonths);

  return {
    totalPubkeys,
    nonActivePubkeys,
    activePubkeys,
  };
}
