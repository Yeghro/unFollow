export function updateUserProfileCard(profile) {
  const userProfileCard = document.getElementById("userProfileCard");
  const userName = document.getElementById("userName");
  const userBio = document.getElementById("userBio");
  const userPicture = document.getElementById("userPicture");
  const readMoreButton = document.getElementById("readMoreButton");
  const nip5 = document.getElementById("nip05");
  const webSiteUrl = document.getElementById("webSiteUrl");
  const fullBio = profile.about || "No bio provided";

  userName.textContent = profile.name || "No name provided";
  userPicture.src = profile.image || "default-profile.png";
  webSiteUrl.innerHTML = profile.website
    ? `Website: <a href="${profile.website}" target="_blank">${profile.website}</a>`
    : "Website: No URL provided";
  userBio.textContent =
    fullBio.length > 100 ? fullBio.substring(0, 100) + "..." : fullBio;
  nip5.textContent = profile.nip05 || "No NIP-05 identifier";

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
  evt.currentTarget.className += " active";
}

export function displayPubkeyInformation(
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
