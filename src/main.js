import {
  initializeNip07Signer,
  activeUser,
  connectUsersRelays,
} from "./nostrService.js";
import {
  updateUserProfileCard,
  displayPubkeyInformation,
  openTab,
} from "./display.js";
import { fetchKind3Events } from "./fetching.js";
import { nip19 } from "nostr-tools";
import { getInactiveMonths, handleManualPubkeyCheck } from "./input.js";
import { categorizePubkeys } from "./eventProcessing.js";
import { createKind3Event } from "./createkind3.js";
import { SecureLightningPay } from "./lightningTips.js";
import { showModal, showConfirm } from "./modal.js";

document.getElementById("loginButton").addEventListener("click", async () => {
  const loginButton = document.getElementById("loginButton");
  const loadingSpinner = document.getElementById("loadingSpinner");

  // Show the spinner and hide the login button
  loginButton.style.display = "none";
  loadingSpinner.style.display = "block";

  try {
    // Validate the months input up front, before any relay work
    const inactiveMonths = getInactiveMonths();

    // Read the pubkey from the NIP-07 extension (throws if none is installed)
    await initializeNip07Signer();

    // Connect default + user relays, then get the newest profile from all of them
    const kind0Events = await connectUsersRelays(activeUser.pubkey);

    if (kind0Events.length > 0) {
      const profile = kind0Events[0];
      updateUserProfileCard(profile);

      const pubkeyContainer = document.getElementById("pubkey-container");
      pubkeyContainer.style.display = "block";

      document.getElementById(
        "publicKey"
      ).textContent = `Npub: ${nip19.npubEncode(profile.pubkey)}`;
      document.getElementById(
        "hexKey"
      ).textContent = `Hex Key: ${profile.pubkey}`;
    }

    const {
      event: kind3Event,
      followedPubkeys,
      totalPubkeys,
    } = await fetchKind3Events(activeUser.pubkey);
    // console.log("kind3 returned to main:", followedPubkeys);

    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: ${totalPubkeys}`;
    }

    const { activePubkeys, inactivePubkeys, followedKind0, lastNotes } =
      await categorizePubkeys(followedPubkeys, inactiveMonths);

    displayPubkeyInformation(
      totalPubkeys,
      inactivePubkeys,
      inactivePubkeys.map(nip19.npubEncode), // Assuming you want to display npubs
      activePubkeys,
      followedKind0,
      lastNotes
    );

    // Open the default tab (nonActivePubkeys)
    openTab(null, "Pubkeys");

    const createButton = document.getElementById("createKind3EventButton");
    createButton.style.display = "block";
    // Assign (not add) the handler so repeated runs never stack listeners
    createButton.onclick = async () => {
      const confirmed = await showConfirm({
        title: "Unfollow inactive users?",
        message:
          "This publishes a new follow list without the inactive follows below. Everything else in your list stays the same.",
        stats: [
          { label: "Will remove", value: inactivePubkeys.length },
          { label: "Will keep", value: activePubkeys.length },
        ],
        confirmText: "Unfollow",
        cancelText: "Cancel",
      });
      if (!confirmed) return;
      try {
        const { removed, kept, accepted } = await createKind3Event(
          inactivePubkeys,
          kind3Event
        );
        showModal({
          type: "success",
          title: "Follow list updated",
          message:
            "Your new follow list was published. Only the inactive follows were removed; everything else in your list is unchanged.",
          stats: [
            { label: "Removed", value: removed },
            { label: "Kept", value: kept },
            { label: "Relays accepted", value: accepted },
          ],
        });
      } catch (error) {
        console.error(error);
        showModal({
          type: "error",
          title: "Couldn't update your follow list",
          message: error.message,
        });
      }
    };

    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    showModal({
      type: "success",
      title: "Search complete",
      message:
        inactivePubkeys.length > 0
          ? `Found ${plural(inactivePubkeys.length, "follow")} with no notes in the last ${plural(inactiveMonths, "month")}. Review them below. Nothing has been changed yet.`
          : `Every follow has posted within the last ${plural(inactiveMonths, "month")}. Nothing to unfollow.`,
      stats: [
        { label: "Following", value: totalPubkeys },
        { label: "Active", value: activePubkeys.length },
        { label: "Inactive", value: inactivePubkeys.length },
      ],
    });
  } catch (error) {
    console.error(error);
    showModal({
      type: "error",
      title: "Login failed",
      message: error.message,
    });
    loginButton.style.display = ""; // allow another attempt without reloading
  } finally {
    loadingSpinner.style.display = "none"; // Hide the spinner after login is complete
  }
});

document
  .getElementById("checkManualPubkeyButton")
  .addEventListener("click", async () => {
    try {
      const result = await handleManualPubkeyCheck();
      if (result) {
        const {
          totalPubkeys,
          nonActivePubkeys,
          nonActiveNpubs,
          activePubkeys,
          kind0Events,
        } = result;
        displayPubkeyInformation(
          totalPubkeys,
          nonActivePubkeys,
          nonActiveNpubs,
          activePubkeys,
          kind0Events
        );
      }
    } catch (error) {
      showModal({
        type: "error",
        title: "Pubkey check failed",
        message: "Failed to check manual pubkey.",
      });
    }
  });

document.querySelectorAll(".tablink").forEach((tablink) => {
  tablink.addEventListener("click", (event) =>
    openTab(event, tablink.getAttribute("data-tab"))
  );
});

/*  Tip Configuration */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const tipAmounts = import.meta.env.VITE_TIP_AMOUNTS ?
  import.meta.env.VITE_TIP_AMOUNTS.split(',').map(Number).filter(Number.isFinite) :
  [1000, 5000, 10000, 20000];

const QR_ID = import.meta.env.VITE_QR_CONTAINER_ID || 'qr-code-container';
const SHOW_TIP_BTN_ID = import.meta.env.VITE_SHOW_TIP_BUTTON_ID || 'show-tip-options';
const TIP_CONTAINER_ID = import.meta.env.VITE_TIP_CONTAINER_ID || 'tip-amount-container';
const WALLET_BTN_ID = import.meta.env.VITE_WALLET_BUTTON_ID || 'open-wallet';

const lnPay = new SecureLightningPay({
  apiBaseUrl,
  tipAmounts,
  targetElement: document.getElementById(QR_ID),
  showTipOptionsButton: document.getElementById(SHOW_TIP_BTN_ID),
  tipAmountContainer: document.getElementById(TIP_CONTAINER_ID),
  openWalletButton: document.getElementById(WALLET_BTN_ID),
});
