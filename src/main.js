import {
  loginWithNostr,
  getPublicKey,
  getHexKey,
  createKind3Event,
} from "./nostrService.js";
import { processKind3EventWithProgress } from "./pubkeyProcessor.js";
import {
  extractPubkeysFromKind3Event,
  fetchLatestKind1EventsWithRelays,
  getNonActivePubkeys,
} from "./nostrUtils.js";

document.getElementById("loginButton").addEventListener("click", async () => {
  document.getElementById("loadingSpinner").style.display = "block";

  try {
    await loginWithNostr();
    document.getElementById("loadingSpinner").style.display = "none";

    const publicKey = getPublicKey();
    const hexKey = getHexKey();
    document.getElementById(
      "publicKey"
    ).textContent = `Public Key: ${publicKey}`;
    document.getElementById("hexKey").textContent = `Hex Key: ${hexKey}`;

    // Retrieve the value of the inactiveMonths input field
    const inactiveMonthsInput = document.getElementById("inactiveMonths");
    const inactiveMonths = parseInt(inactiveMonthsInput.value);

    const { totalPubkeys, nonActivePubkeys, activePubkeys } =
      await processKind3EventWithProgress(hexKey, inactiveMonths);

    // Display the total number of pubkeys immediately after fetching the kind 3 event
    document.getElementById(
      "totalPubkeys"
    ).textContent = `Total Pubkeys Found: ${totalPubkeys}`;

    const nonActivePubkeysList = document.getElementById("nonActivePubkeys");
    nonActivePubkeysList.innerHTML = ""; // Clear previous list
    nonActivePubkeys.forEach((pubkey) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = `https://primal.net/p/${pubkey}`;
      link.target = "_blank";
      link.textContent = pubkey;
      link.style.color = "rgb(193, 177, 148)";
      link.style.textDecoration = "none";
      listItem.appendChild(link);
      listItem.style.padding = "10px";
      listItem.style.backgroundColor = "rgb(46, 0, 46)";
      listItem.style.marginBottom = "5px";
      listItem.style.borderRadius = "4px";
      listItem.style.fontFamily = "Arial, sans-serif";
      listItem.style.fontSize = "14px";
      listItem.addEventListener("mouseover", function () {
        this.style.backgroundColor = "rgb(128, 83, 0)";
      });
      listItem.addEventListener("mouseout", function () {
        this.style.backgroundColor = "rgb(46, 0, 46)";
      });
      nonActivePubkeysList.appendChild(listItem);
    });

    const totalNonActivePubkeys = document.createElement("p");
    totalNonActivePubkeys.textContent = `Total Non-Active Pubkeys: ${nonActivePubkeys.length}`;
    nonActivePubkeysList.appendChild(totalNonActivePubkeys);

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
    document.getElementById("loadingSpinner").style.display = "none";
    if (error.message.includes("cancel")) {
      alert("Login process was canceled.");
    } else {
      alert("Network issue occurred. Please try again later.");
    }
    console.error("Error:", error);
  }
});
