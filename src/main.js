import {
  connectToRelays,
  activeUser,
  connectUsersRelays,
} from "./nostrService.js";
import {
  updateUserProfileCard,
  displayPubkeyInformation,
  openTab,
} from "./display.js";
import { fetchKind0Events, fetchKind3Events } from "./fetching.js";
import { nip19 } from "nostr-tools";
import { getInactiveMonths, handleManualPubkeyCheck } from "./input.js";
import { categorizePubkeys } from "./eventProcessing.js";
import { createKind3Event } from "./createkind3.js";
import { SecureLightningPay } from "./lightningTips.js";

document.getElementById("loginButton").addEventListener("click", async () => {
  const loginButton = document.getElementById("loginButton");
  const loadingSpinner = document.getElementById("loadingSpinner");

  // Show the spinner and hide the login button
  loginButton.style.display = "none";
  loadingSpinner.style.display = "block";

  try {
    // Connect to relays only when login button is clicked
    await connectToRelays();

    await connectUsersRelays(activeUser.pubkey);

    // Ensure relays are connected before proceeding
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const kind0Events = await fetchKind0Events([activeUser.pubkey]);

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

    const inactiveMonths = getInactiveMonths();

    const {
      followedPubkeys,
      followedTopics,
      totalPubkeys,
      totalTopics,
      eventContent,
    } = await fetchKind3Events(activeUser.pubkey);
    // console.log("kind3 returned to main:", followedPubkeys);

    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: ${totalPubkeys}`;
    }

    const { activePubkeys, inactivePubkeys, followedKind0 } =
      await categorizePubkeys(followedPubkeys, inactiveMonths);

    displayPubkeyInformation(
      totalPubkeys,
      inactivePubkeys,
      inactivePubkeys.map(nip19.npubEncode), // Assuming you want to display npubs
      activePubkeys,
      followedKind0
    );

    // Open the default tab (nonActivePubkeys)
    openTab(null, "Pubkeys");

    const createButton = document.getElementById("createKind3EventButton");
    createButton.style.display = "block";
    createButton.addEventListener("click", async () => {
      if (confirm("Are you sure you want to create a new kind 3 event?")) {
        try {
          await createKind3Event(activePubkeys, eventContent, followedTopics);
          alert("New kind 3 event created successfully.");
        } catch (error) {
          alert("Failed to create kind 3 event.");
        }
      }
    });

    alert(
      "Fetched kind 3 events and processed pubkeys successfully. Check the page for details."
    );
  } catch (error) {
    alert("Failed to login with Nostr.");
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
      alert("Failed to check manual pubkey.");
    }
  });

document.querySelectorAll(".tablink").forEach((tablink) => {
  tablink.addEventListener("click", (event) =>
    openTab(event, tablink.getAttribute("data-tab"))
  );
});

/*  Tip Configuration */
const paymentSystem = (import.meta.env.VITE_PAYMENT_SYSTEM || "getalby").toLowerCase();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''; // optional, defaults to same-origin

// UI element IDs can be overridden via env; defaults keep current behavior
const QR_ID = import.meta.env.VITE_QR_CONTAINER_ID || "qr-code-container";
const SHOW_TIP_BTN_ID = import.meta.env.VITE_SHOW_TIP_BUTTON_ID || "show-tip-options";
const TIP_CONTAINER_ID = import.meta.env.VITE_TIP_CONTAINER_ID || "tip-amount-container";
const WALLET_BTN_ID = import.meta.env.VITE_WALLET_BUTTON_ID || "open-wallet";

// Tip amounts: comma-separated list in VITE_TIP_AMOUNTS, fallback to defaults
const tipAmounts = import.meta.env.VITE_TIP_AMOUNTS
  ? import.meta.env.VITE_TIP_AMOUNTS.split(',').map(a => parseInt(a, 10))
  : [1000, 5000, 10000, 20000];

// Alby account is ONLY needed when using GetAlby
const albyAccountId = import.meta.env.VITE_ALBY_ACCOUNT_ID || undefined;

const lnPay = new SecureLightningPay({
  paymentSystem,
  apiBaseUrl,
  // Only meaningful for GetAlby; ignored for Coinos/LNbits
  albyAccountId,
  tipAmounts,
  targetElement: document.getElementById(QR_ID),
  showTipOptionsButton: document.getElementById(SHOW_TIP_BTN_ID),
  tipAmountContainer: document.getElementById(TIP_CONTAINER_ID),
  openWalletButton: document.getElementById(WALLET_BTN_ID),
});
