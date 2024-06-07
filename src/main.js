import { connectToRelays, activeUser } from "./nostrService.js";
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

document.getElementById("loginButton").addEventListener("click", async () => {
  try {
    // Connect to relays only when login button is clicked
    connectToRelays();

    // Ensure relays are connected before proceeding
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const kind0Events = await fetchKind0Events([activeUser.pubkey]);

    if (kind0Events.length > 0) {
      const profile = kind0Events[0];
      updateUserProfileCard(profile);
      console.log("Returned profile (kind0)", profile);

      document.getElementById(
        "publicKey"
      ).textContent = `Npub: ${nip19.npubEncode(profile.pubkey)}`;
      document.getElementById(
        "hexKey"
      ).textContent = `Hex Key: ${profile.pubkey}`;
    }

    const inactiveMonths = getInactiveMonths();

    const { followedPubkeys, totalPubkeys } = await fetchKind3Events(
      activeUser.pubkey
    );
    console.log("fetched follow list:", followedPubkeys, totalPubkeys);
    const totalPubkeysElement = document.getElementById("totalPubkeys");
    if (totalPubkeysElement) {
      totalPubkeysElement.textContent = `Total Pubkeys Found: ${totalPubkeys}`;
    }

    const { activePubkeys, inactivePubkeys, followedKind0 } =
      await categorizePubkeys(followedPubkeys, inactiveMonths);
    console.log("Active pubkeys:", activePubkeys);
    console.log("Inactive pubkeys:", inactivePubkeys);

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
          await createKind3Event(activePubkeys);
          alert("New kind 3 event created successfully.");
        } catch (error) {
          console.error("Error creating kind 3 event:", error);
          alert("Failed to create kind 3 event.");
        }
      }
    });

    alert(
      "Fetched kind 3 events and processed pubkeys successfully. Check the page for details."
    );
  } catch (error) {
    console.error(error);
    alert("Failed to login with Nostr.");
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
      console.error(error);
      alert("Failed to check manual pubkey.");
    }
  });

document.querySelectorAll(".tablink").forEach((tablink) => {
  tablink.addEventListener("click", (event) =>
    openTab(event, tablink.getAttribute("data-tab"))
  );
});
