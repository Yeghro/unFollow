import { connectToRelays, connectUsersRelays } from "./nostrService";
import { categorizePubkeys } from "./eventProcessing";
import { fetchKind0Events, fetchKind3Events } from "./fetching";
import { nip19 } from "nostr-tools";
import {
  displayPubkeyInformation,
  updateUserProfileCard,
  openTab,
} from "./display";

export function getInactiveMonths() {
  const inactiveMonthsInput = document.getElementById("inactiveMonths");
  return parseInt(inactiveMonthsInput.value);
}

export async function handleManualPubkeyCheck() {
  const manualPubkeyInput = document.getElementById("manualPubkey");
  let manualPubkey = manualPubkeyInput.value.trim();

  if (manualPubkey) {
    document.getElementById("loadingSpinner").style.display = "block";
    try {
      // console.log("manual pubkey entered by user:", manualPubkey);
      // Check if the input is an npub and convert to hex pubkey if necessary
      if (manualPubkey.startsWith("npub")) {
        const decoded = nip19.decode(manualPubkey);
        manualPubkey = decoded.data;
      } else if (!/^[0-9a-fA-F]{64}$/.test(manualPubkey)) {
        throw new Error("Invalid pubkey or npub format");
      }
      // console.log("manual pubkey decoded:", manualPubkey);

      // Connect to relays
      await connectToRelays();

      await connectUsersRelays(manualPubkey);

      // Ensure relays are connected before proceeding
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fetch kind 0 events to get metadata about the user
      const kind0Events = await fetchKind0Events([manualPubkey]);
      if (kind0Events.length === 0) {
        throw new Error("No metadata found for the provided pubkey");
      }
      const profile = kind0Events[0];
      updateUserProfileCard(profile);
      // console.log("Returned profile (kind0)", profile);

      document.getElementById(
        "publicKey"
      ).textContent = `Npub: ${nip19.npubEncode(profile.pubkey)}`;
      document.getElementById(
        "hexKey"
      ).textContent = `Hex Key: ${profile.pubkey}`;

      const inactiveMonths = getInactiveMonths();

      // Fetch kind 3 events to get the follow list
      const { followedPubkeys, totalPubkeys } = await fetchKind3Events(
        manualPubkey
      );
      const totalPubkeysElement = document.getElementById("totalPubkeys");
      if (totalPubkeysElement) {
        totalPubkeysElement.textContent = `Total Pubkeys Found: ${totalPubkeys}`;
      }

      // console.log("kind3 returned to input:", followedPubkeys);

      // Categorize the pubkeys
      const { activePubkeys, inactivePubkeys, followedKind0 } =
        await categorizePubkeys(followedPubkeys, inactiveMonths);
      console.log("Active pubkeys:", activePubkeys);
      console.log("Inactive pubkeys:", inactivePubkeys);

      displayPubkeyInformation(
        followedPubkeys.length,
        inactivePubkeys,
        inactivePubkeys.map(nip19.npubEncode), // Assuming you want to display npubs
        activePubkeys,
        followedKind0
      );

      // Automatically open the tab with the non-active pubkeys
      openTab(null, "Pubkeys");

      document.getElementById("loadingSpinner").style.display = "none";
    } catch (error) {
      document.getElementById("loadingSpinner").style.display = "none";
      alert("An error occurred while processing the manual pubkey.");
      throw error;
    }
  } else {
    alert("Please enter a valid pubkey/npub.");
  }
}
