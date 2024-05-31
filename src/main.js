import {
  handleLogin,
  handleManualPubkeyCheck,
  getInactiveMonths,
} from "./input.js";
import {
  updateUserProfileCard,
  displayPubkeyInformation,
  openTab,
} from "./output.js";
import { createKind3Event, getPublicKey, getHexKey } from "./nostrService.js";
import { processKind3EventWithProgress } from "./kind3processing.js";

document.getElementById("loginButton").addEventListener("click", async () => {
  try {
    const profile = await handleLogin();
    updateUserProfileCard(profile);

    const publicKey = getPublicKey();
    const hexKey = getHexKey();
    document.getElementById(
      "publicKey"
    ).textContent = `Public Key: ${publicKey}`;
    document.getElementById("hexKey").textContent = `Hex Key: ${hexKey}`;

    const inactiveMonths = getInactiveMonths();

    const {
      totalPubkeys,
      nonActivePubkeys,
      nonActiveNpubs,
      activePubkeys,
      kind0Events,
    } = await processKind3EventWithProgress(hexKey, inactiveMonths);

    displayPubkeyInformation(
      totalPubkeys,
      nonActivePubkeys,
      nonActiveNpubs,
      activePubkeys,
      kind0Events
    );

    const createButton = document.getElementById("createKind3EventButton");
    createButton.style.display = "block";
    createButton.addEventListener("click", async () => {
      if (confirm("Are you sure you want to create a new kind 3 event?")) {
        await createKind3Event(hexKey, activePubkeys);
        alert("New kind 3 event created successfully.");
      }
    });

    alert(
      "Fetched kind 3 events and processed pubkeys successfully. Check the page for details."
    );
  } catch (error) {
    // Handle errors here if needed
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
      // Handle errors here if needed
    }
  });

// Add event listeners for the tabs
document.querySelectorAll(".tablink").forEach((tablink) => {
  tablink.addEventListener("click", (event) =>
    openTab(event, tablink.getAttribute("data-tab"))
  );
});
