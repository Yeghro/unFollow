export function updateUserProfileCard(profile) {
  const profileData = JSON.parse(profile.content);
  // console.log("Parsed profile:", profileData);
  const userProfileCard = document.getElementById("userProfileCard");
  const userName = document.getElementById("userName");
  const userBio = document.getElementById("userBio");
  const userPicture = document.getElementById("userPicture");
  const readMoreButton = document.getElementById("readMoreButton");
  const nip5 = document.getElementById("nip05");
  const webSiteUrl = document.getElementById("webSiteUrl");
  const fullBio = profileData.about || "No bio provided";

  userName.textContent = profileData.name || "No name provided";
  userPicture.src =
    profileData.picture ||
    "https://yeghro.site/wp-content/uploads/2024/03/nostr-300x300.webp";
  webSiteUrl.innerHTML = profileData.website
    ? `Website: <a href="${profileData.website}" target="_blank">${profileData.website}</a>`
    : "Website: No URL provided";
  userBio.textContent =
    fullBio.length > 100 ? fullBio.substring(0, 100) + "..." : fullBio;
  nip5.textContent = profileData.nip05 || "No NIP-05 identifier";

  if (fullBio.length > 100) {
    // Show "Read more" if bio is long
    readMoreButton.style.display = "inline";
    readMoreButton.onclick = function () {
      userBio.textContent = fullBio;
      userBio.classList.add("expanded");
      readMoreButton.style.display = "none";
    };
  } else {
    readMoreButton.style.display = "none";
  }

  userProfileCard.style.display = "block";
}

export function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  const tablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  if (evt) {
    evt.currentTarget.className += " active";
  } else {
    const defaultTab = document.querySelector(
      `.tablink[data-tab="${tabName}"]`
    );
    if (defaultTab) {
      defaultTab.className += " active";
    }
  }
}

export function displayPubkeyInformation(
  totalPubkeys,
  nonActivePubkeys,
  inactiveNpubs,
  activePubkeys,
  followedKind0
) {
  // console.log("Displaying pubkey information...");
  // console.log("Total Pubkeys:", totalPubkeys);
  // console.log("Non-active Pubkeys:", nonActivePubkeys);
  // console.log("Inactive Npubs:", inactiveNpubs);
  // console.log("Active Pubkeys:", activePubkeys);
  // console.log("Followed Kind 0:", followedKind0);

  document.getElementById(
    "totalPubkeys"
  ).textContent = `Total Pubkeys Found: ${totalPubkeys}`;

  const nonActivePubkeysList = document.getElementById("nonActivePubkeys");
  const nonActiveNpubsList = document.getElementById("nonActiveNpubs");
  nonActivePubkeysList.innerHTML = ""; // Clear previous list
  nonActiveNpubsList.innerHTML = ""; // Clear previous list

  nonActivePubkeys.forEach((pubkey) => {
    // console.log(`Processing non-active pubkey: ${pubkey}`);
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
    const kind0Event = followedKind0.get(pubkey);
    if (kind0Event) {
      // console.log(`Found kind 0 event for pubkey: ${pubkey}`, kind0Event);
      const content = JSON.parse(kind0Event.content);
      const name = content.name || "N/A";
      const nip05 = content.nip05 || "N/A";
      const info = document.createElement("p");
      info.textContent = `Name: ${name}, nip05: ${nip05}`;
      info.style.color = "rgb(193, 177, 148)";
      listItem.appendChild(info);
    } else {
      // console.log(`No kind 0 event found for pubkey: ${pubkey}`);
    }

    nonActivePubkeysList.appendChild(listItem);
  });

  // Ensure inactiveNpubs is an array before iterating
  if (Array.isArray(inactiveNpubs)) {
    inactiveNpubs.forEach((npub) => {
      // console.log(`Processing inactive npub: ${npub}`);
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

      nonActiveNpubsList.appendChild(listItem);
    });
  } else {
    // console.error("inactiveNpubs is not an array:", inactiveNpubs);
  }

  const totalNonActivePubkeys = document.createElement("p");
  totalNonActivePubkeys.textContent = `Total Non-Active Pubkeys: ${nonActivePubkeys.length}`;
  nonActivePubkeysList.appendChild(totalNonActivePubkeys);

  const totalNonActiveNpubs = document.createElement("p");
  totalNonActiveNpubs.textContent = `Total Non-Active Npubs: ${
    Array.isArray(inactiveNpubs) ? inactiveNpubs.length : 0
  }`;
  nonActiveNpubsList.appendChild(totalNonActiveNpubs);

  // console.log("Display update complete.");
}
