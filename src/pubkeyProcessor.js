import { ndk, fetchEvents, relayUrls } from "./nostrService.js";
import { NDKEvent } from "@nostr-dev-kit/ndk";
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

  if (events && events.size > 0) {
    console.log("Number of kind 3 events found:", events.size);

    const pubkeys = extractPubkeysFromKind3Event(events);
    console.log("Pubkeys extracted:", pubkeys);

    // Display the total number of pubkeys found immediately
    const totalPubkeys = pubkeys.length;
    document.getElementById(
      "totalPubkeys"
    ).textContent = `Total Pubkeys Found: ${totalPubkeys}`;

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
    const nonActivePubkeys = getNonActivePubkeys(
      latestEvents,
      pubkeys,
      inactiveMonths
    );

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
    document.getElementById(
      "totalPubkeys"
    ).textContent = `Total Pubkeys Found: 0`;
    return {
      totalPubkeys: 0,
      nonActivePubkeys: [],
      activePubkeys: [],
    };
  }
}
