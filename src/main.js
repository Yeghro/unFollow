import {
  loginWithNostr,
  getPublicKey,
  getHexKey,
  createKind3Event,
} from "./nostrService.js";
import {
  processKind3EventWithProgress,
  processManualPubkey,
} from "./pubkeyProcessor.js";

// Function to update and display user profile card
function updateUserProfileCard(profile) {
  const userProfileCard = document.getElementById("userProfileCard");
  const userName = document.getElementById("userName");
  const userBio = document.getElementById("userBio");
  const userPicture = document.getElementById("userPicture");

  userName.textContent = profile.name || "No name provided";
  userBio.textContent = profile.about || "No bio provided";
  userPicture.src = profile.image || "default-profile.png";
  userProfileCard.style.display = "block";
}

document.getElementById("loginButton").addEventListener("click", async () => {
  document.getElementById("loadingSpinner").style.display = "block";

  try {
    const profile = await loginWithNostr();
    document.getElementById("loadingSpinner").style.display = "none";
    updateUserProfileCard(profile);

    const publicKey = getPublicKey();
    const hexKey = getHexKey();
    document.getElementById(
      "publicKey"
    ).textContent = `Public Key: ${publicKey}`;
    document.getElementById("hexKey").textContent = `Hex Key: ${hexKey}`;

    // Retrieve the value of the inactiveMonths input field
    const inactiveMonthsInput = document.getElementById("inactiveMonths");
    const inactiveMonths = parseInt(inactiveMonthsInput.value);

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
    document.getElementById("loadingSpinner").style.display = "none";
    if (error.message.includes("cancel")) {
      alert("Login process was canceled.");
    } else {
      alert("Network issue occurred. Please try again later.");
    }
    // console.error("Error:", error);
  }
});

document
  .getElementById("checkManualPubkeyButton")
  .addEventListener("click", async () => {
    const manualPubkeyInput = document.getElementById("manualPubkey");
    const manualPubkey = manualPubkeyInput.value.trim();
    if (manualPubkey) {
      document.getElementById("loadingSpinner").style.display = "block";
      try {
        const inactiveMonthsInput = document.getElementById("inactiveMonths");
        const inactiveMonths = parseInt(inactiveMonthsInput.value);
        const {
          totalPubkeys,
          nonActivePubkeys,
          nonActiveNpubs,
          activePubkeys,
          kind0Events,
        } = await processManualPubkey(manualPubkey, inactiveMonths);
        displayPubkeyInformation(
          totalPubkeys,
          nonActivePubkeys,
          nonActiveNpubs,
          activePubkeys,
          kind0Events
        );
      } catch (error) {
        document.getElementById("loadingSpinner").style.display = "none";
        alert("An error occurred while processing the manual pubkey.");
        // console.error("Error:", error);
      }
    } else {
      alert("Please enter a valid pubkey/npub.");
    }
  });

function displayPubkeyInformation(
  totalPubkeys,
  nonActivePubkeys,
  nonActiveNpubs,
  activePubkeys,
  kind0Events
) {
  document.getElementById(
    "totalPubkeys"
  ).textContent = `Total Pubkeys Found: ${totalPubkeys}`;

  const nonActivePubkeysList = document.getElementById("nonActivePubkeys");
  const nonActiveNpubsList = document.getElementById("nonActiveNpubs");
  nonActivePubkeysList.innerHTML = ""; // Clear previous list
  nonActiveNpubsList.innerHTML = ""; // Clear previous list

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

    // Find the associated kind 0 event to display name and nip05
    const kind0Event = kind0Events.find((event) => event.pubkey === pubkey);
    if (kind0Event) {
      const name = kind0Event.content.name || "N/A";
      const nip05 = kind0Event.content.nip05 || "N/A";
      const info = document.createElement("p");
      info.textContent = `Name: ${name}, nip05: ${nip05}`;
      info.style.color = "rgb(193, 177, 148)";
      listItem.appendChild(info);
    }

    nonActivePubkeysList.appendChild(listItem);
  });

  nonActiveNpubs.forEach((npub) => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.href = `https://primal.net/p/${npub}`;
    link.target = "_blank";
    link.textContent = npub;
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

    // Find the associated kind 0 event to display name and nip05
    const kind0Event = kind0Events.find((event) => event.pubkey === npub);
    if (kind0Event) {
      const name = kind0Event.content.name || "N/A";
      const nip05 = kind0Event.content.nip05 || "N/A";
      const info = document.createElement("p");
      info.textContent = `Name: ${name}, nip05: ${nip05}`;
      info.style.color = "rgb(193, 177, 148)";
      listItem.appendChild(info);
    }

    nonActiveNpubsList.appendChild(listItem);
  });

  const totalNonActivePubkeys = document.createElement("p");
  totalNonActivePubkeys.textContent = `Total Non-Active Pubkeys: ${nonActivePubkeys.length}`;
  nonActivePubkeysList.appendChild(totalNonActivePubkeys);

  const totalNonActiveNpubs = document.createElement("p");
  totalNonActiveNpubs.textContent = `Total Non-Active Npubs: ${nonActiveNpubs.length}`;
  nonActiveNpubsList.appendChild(totalNonActiveNpubs);
}
