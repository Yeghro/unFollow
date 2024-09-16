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
import { getInactiveFollows } from './api.js';


// Centralized error handling
function handleError(error, message) {
  console.error(error);
  alert(`${message}: ${error.message}`);
}

// Centralized event listeners
function setupEventListeners() {
  document.getElementById("loginButton").addEventListener("click", handleLogin);
  document.getElementById("checkManualPubkeyButton").addEventListener("click", handleManualPubkeyCheck);
  document.querySelectorAll(".tablink").forEach((tablink) => {
    tablink.addEventListener("click", (event) =>
      openTab(event, tablink.getAttribute("data-tab"))
    );
  });
  document.getElementById("createKind3EventButton").addEventListener("click", handleCreateKind3Event);
}

async function handleLogin() {
  const loginButton = document.getElementById("loginButton");
  const loadingSpinner = document.getElementById("loadingSpinner");

  loginButton.style.display = "none";
  loadingSpinner.style.display = "block";

  try {
    await connectToRelays();
    await connectUsersRelays(activeUser.pubkey);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const kind0Events = await fetchKind0Events([activeUser.pubkey]);

    if (kind0Events.length > 0) {
      const profile = kind0Events[0];
      updateUserProfileCard(profile);

      document.getElementById("publicKey").textContent = `Npub: ${nip19.npubEncode(profile.pubkey)}`;
      document.getElementById("hexKey").textContent = `Hex Key: ${profile.pubkey}`;
    }

    const inactiveMonths = getInactiveMonths();

    const { followedPubkeys, followedTopics, totalPubkeys, totalTopics, eventContent } = await fetchKind3Events(activeUser.pubkey);

    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: ${totalPubkeys}`;
    }

    const { activePubkeys, inactivePubkeys, followedKind0 } = await categorizePubkeys(followedPubkeys, inactiveMonths);

    displayPubkeyInformation(
      totalPubkeys,
      inactivePubkeys,
      inactivePubkeys.map(nip19.npubEncode),
      activePubkeys,
      followedKind0
    );

    openTab(null, "Pubkeys");

    const createButton = document.getElementById("createKind3EventButton");
    createButton.style.display = "block";

    alert("Fetched kind 3 events and processed pubkeys successfully. Check the page for details.");
  } catch (error) {
    handleError(error, "Failed to login with Nostr");
  } finally {
    loadingSpinner.style.display = "none";
  }
}

async function handleCreateKind3Event() {
  if (confirm("Are you sure you want to create a new kind 3 event?")) {
    try {
      await createKind3Event(activePubkeys, eventContent, followedTopics);
      alert("New kind 3 event created successfully.");
    } catch (error) {
      handleError(error, "Failed to create kind 3 event");
    }
  }
}

// Initialize the application
function init() {
  setupEventListeners();

  const lnPay = new SecureLightningPay({
    paymentSystem: "lnbits",
    apiBaseUrl: '',
    tipAmounts: [1000, 5000, 10000, 20000],
    targetElement: document.getElementById("qr-code-container"),
    showTipOptionsButton: document.getElementById("show-tip-options"),
    tipAmountContainer: document.getElementById("tip-amount-container"),
    openWalletButton: document.getElementById("open-wallet"),
  });
}

// Run the initialization
init();