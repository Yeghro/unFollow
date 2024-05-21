import {
  loginWithNostr,
  getPublicKey,
  getHexKey,
  createKind3Event,
} from "./nostrService.js";
import { processKind3EventWithProgress } from "./pubkeyProcessor.js";

document.getElementById("loginButton").addEventListener("click", async () => {
  try {
    await loginWithNostr();
    const publicKey = getPublicKey();
    const hexKey = getHexKey();

    document.getElementById(
      "publicKey"
    ).textContent = `Public Key: ${publicKey}`;
    document.getElementById("hexKey").textContent = `Hex Key: ${hexKey}`;

    const { totalPubkeys, nonActivePubkeys, activePubkeys } =
      await processKind3EventWithProgress(hexKey);

    document.getElementById(
      "totalPubkeys"
    ).textContent = `Total Pubkeys Found: ${totalPubkeys}`;

    const nonActivePubkeysList = document.getElementById("nonActivePubkeys");
    nonActivePubkeysList.innerHTML = ""; // Clear previous list
    nonActivePubkeys.forEach((pubkey) => {
      const listItem = document.createElement("li");
      listItem.textContent = pubkey;
      nonActivePubkeysList.appendChild(listItem);
    });

    // Add the total count of non-active pubkeys at the end of the list
    const totalNonActivePubkeys = document.createElement("p");
    totalNonActivePubkeys.textContent = `Total Non-Active Pubkeys: ${nonActivePubkeys.length}`;
    nonActivePubkeysList.appendChild(totalNonActivePubkeys);

    // Add a button to create the new kind 3 event
    const createButton = document.createElement("button");
    createButton.textContent = "Create New Kind 3 Event";
    createButton.addEventListener("click", async () => {
      await createKind3Event(hexKey, activePubkeys);
      alert("New kind 3 event created successfully.");
    });
    document.body.appendChild(createButton);

    alert(
      "Fetched kind 3 events and processed pubkeys successfully. Check the page for details."
    );
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred. Check the console for details.");
  }
});
