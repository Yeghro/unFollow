// input.js
import { loginWithNostr } from "./nostrService.js";
import { processManualPubkey } from "./kind3processing.js";

export async function handleLogin() {
  document.getElementById("loadingSpinner").style.display = "block";

  try {
    const profile = await loginWithNostr();
    document.getElementById("loadingSpinner").style.display = "none";
    return profile;
  } catch (error) {
    document.getElementById("loadingSpinner").style.display = "none";
    if (error.message.includes("cancel")) {
      alert("Login process was canceled.");
    } else {
      alert("Network issue occurred. Please try again later.");
    }
    throw error;
  }
}

export async function handleManualPubkeyCheck() {
  const manualPubkeyInput = document.getElementById("manualPubkey");
  const manualPubkey = manualPubkeyInput.value.trim();
  if (manualPubkey) {
    document.getElementById("loadingSpinner").style.display = "block";
    try {
      const inactiveMonthsInput = document.getElementById("inactiveMonths");
      const inactiveMonths = parseInt(inactiveMonthsInput.value);
      const result = await processManualPubkey(manualPubkey, inactiveMonths);
      document.getElementById("loadingSpinner").style.display = "none";
      return result;
    } catch (error) {
      document.getElementById("loadingSpinner").style.display = "none";
      alert("An error occurred while processing the manual pubkey.");
      throw error;
    }
  } else {
    alert("Please enter a valid pubkey/npub.");
  }
}

export function getInactiveMonths() {
  const inactiveMonthsInput = document.getElementById("inactiveMonths");
  return parseInt(inactiveMonthsInput.value);
}
