import { connectUsersRelays } from "./nostrService";
import { categorizePubkeys } from "./eventProcessing";
import { fetchKind0Events, fetchKind3Events } from "./fetching";
import { nip19 } from "nostr-tools";
import { showModal } from "./modal";
import {
  displayPubkeyInformation,
  updateUserProfileCard,
  openTab,
} from "./display";

export function getInactiveMonths() {
  const inactiveMonthsInput = document.getElementById("inactiveMonths");
  const months = parseInt(inactiveMonthsInput.value, 10);
  if (!Number.isFinite(months) || months < 1) {
    throw new Error("Enter the number of inactive months (1 or more).");
  }
  return months;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Manual lookups are read-only: drop any unfollow action left over from an
// extension login so it can't act on a different list than the one shown.
function disableUnfollowAction() {
  const createButton = document.getElementById("createKind3EventButton");
  if (createButton) {
    createButton.onclick = null;
    createButton.style.display = "none";
  }
}

export async function handleManualPubkeyCheck() {
  const manualPubkeyInput = document.getElementById("manualPubkey");
  let manualPubkey = manualPubkeyInput.value.trim();

  if (!manualPubkey) {
    showModal({
      type: "error",
      title: "Pubkey needed",
      message: "Please enter a valid pubkey/npub.",
    });
    return;
  }

  const spinner = document.getElementById("loadingSpinner");
  spinner.style.display = "block";
  try {
    // Validate inputs up front, before any relay work
    const inactiveMonths = getInactiveMonths();

    if (manualPubkey.startsWith("npub")) {
      const decoded = nip19.decode(manualPubkey);
      if (decoded.type !== "npub") throw new Error("Invalid npub format");
      manualPubkey = decoded.data;
    } else if (/^[0-9a-fA-F]{64}$/.test(manualPubkey)) {
      manualPubkey = manualPubkey.toLowerCase();
    } else {
      throw new Error(
        "Invalid pubkey or npub format. Enter an npub or a 64-character hex pubkey."
      );
    }

    disableUnfollowAction();

    // Connect to user relays and fetch kind 0 events simultaneously
    const kind0Events = await connectUsersRelays(manualPubkey);

    // A missing profile isn't fatal: the follow list is what matters
    const profile = kind0Events[0] || { pubkey: manualPubkey, content: "{}" };
    updateUserProfileCard(profile);

    document.getElementById("pubkey-container").style.display = "block";
    document.getElementById(
      "publicKey"
    ).textContent = `Npub: ${nip19.npubEncode(manualPubkey)}`;
    document.getElementById("hexKey").textContent = `Hex Key: ${manualPubkey}`;

    // Fetch kind 3 events to get the follow list
    const { followedPubkeys, totalPubkeys } = await fetchKind3Events(
      manualPubkey
    );
    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: ${totalPubkeys}`;
    }

    // Categorize the pubkeys
    const { activePubkeys, inactivePubkeys, followedKind0, lastNotes } =
      await categorizePubkeys(followedPubkeys, inactiveMonths);

    displayPubkeyInformation(
      followedPubkeys.length,
      inactivePubkeys,
      inactivePubkeys.map(nip19.npubEncode),
      activePubkeys,
      followedKind0,
      lastNotes
    );

    // Automatically open the tab with the non-active pubkeys
    openTab(null, "Pubkeys");

    showModal({
      type: "success",
      title: "Search complete",
      message:
        inactivePubkeys.length > 0
          ? `Found ${plural(inactivePubkeys.length, "follow")} with no notes in the last ${plural(inactiveMonths, "month")}. This is a read-only lookup; log in with a Nostr extension to unfollow.`
          : `Every follow has posted within the last ${plural(inactiveMonths, "month")}. Nothing to unfollow.`,
      stats: [
        { label: "Following", value: totalPubkeys },
        { label: "Active", value: activePubkeys.length },
        { label: "Inactive", value: inactivePubkeys.length },
      ],
    });
  } catch (error) {
    showModal({
      type: "error",
      title: "Pubkey check failed",
      message:
        error.message ||
        "An error occurred while processing the manual pubkey.",
    });
    console.error(error);
  } finally {
    spinner.style.display = "none";
  }
}
