import { relays, userRelayUrls } from "./nostrService.js";
import { queryRelay } from "./fetching.js";

const KIND1_LIMIT = 500;
const PASS_TIMEOUT = 6000;

export async function categorizePubkeys(
  followedPubkeys,
  inactiveMonths = 8,
  maxRetries = 12,
  batchSize = 250
) {
  if (Object.keys(relays).length === 0) {
    throw new Error("No relays connected.");
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const inactiveThreshold = currentTime - inactiveMonths * 30 * 24 * 60 * 60;

  const allPubkeys = Array.from(new Set(followedPubkeys));
  const activePubkeys = new Set();
  const followedKind0 = new Map();
  const state = { anyRelayFinished: false };
  const scope = new Set(allPubkeys);
  console.log("Followed pubkeys sent to categorize:", allPubkeys.length);

  const progressContainer = document.getElementById("progressContainer");
  progressContainer.style.display = "block";

  // Repeated passes are intentional: each pass drops authors already seen
  // active, so busy authors stop crowding quiet ones out of relay result limits.
  let remainingPubkeys = allPubkeys;
  let retryCount = 0;

  while (remainingPubkeys.length > 0 && retryCount < maxRetries) {
    const nextRemaining = [];

    for (const batch of createBatches(remainingPubkeys, batchSize)) {
      const { userRelays, otherRelays } = splitRelays();

      // The user's own relays take priority; the rest are only asked about
      // authors still not seen active.
      await queryBatch(batch, userRelays);
      const unseen = batch.filter((pubkey) => !activePubkeys.has(pubkey));
      if (unseen.length > 0) {
        await queryBatch(unseen, otherRelays);
      }

      for (const pubkey of batch) {
        if (!activePubkeys.has(pubkey)) nextRemaining.push(pubkey);
      }
    }

    remainingPubkeys = nextRemaining;
    retryCount++;
    updateProgress(retryCount, maxRetries);
  }

  updateProgress(maxRetries, maxRetries);

  if (!state.anyRelayFinished) {
    throw new Error("No relay responded; refusing to classify follows as inactive.");
  }

  return {
    activePubkeys: Array.from(activePubkeys),
    inactivePubkeys: allPubkeys.filter((pubkey) => !activePubkeys.has(pubkey)),
    followedKind0,
  };

  async function queryBatch(pubkeys, relayList) {
    if (relayList.length === 0) return;

    // Only the newest kind 1 per window and the newest kind 0 are requested
    const filters = [
      { authors: pubkeys, kinds: [1], since: inactiveThreshold, limit: KIND1_LIMIT },
    ];
    const needProfile = pubkeys.filter((pubkey) => !followedKind0.has(pubkey));
    if (needProfile.length > 0) {
      filters.push({ authors: needProfile, kinds: [0] });
    }

    const results = await Promise.all(
      relayList.map((relay) => queryRelay(relay, filters, { timeout: PASS_TIMEOUT }))
    );

    for (const result of results) {
      if (result.ok) state.anyRelayFinished = true;
      for (const event of result.events) {
        if (!scope.has(event.pubkey)) continue;
        if (event.kind === 1 && event.created_at > inactiveThreshold) {
          activePubkeys.add(event.pubkey);
        } else if (event.kind === 0) {
          const current = followedKind0.get(event.pubkey);
          if (!current || event.created_at > current.created_at) {
            followedKind0.set(event.pubkey, event);
          }
        }
      }
    }
  }
}

function splitRelays() {
  const open = Object.entries(relays).filter(
    ([, relay]) => relay.readyState === WebSocket.OPEN
  );
  return {
    userRelays: open.filter(([url]) => userRelayUrls.has(url)).map(([, r]) => r),
    otherRelays: open.filter(([url]) => !userRelayUrls.has(url)).map(([, r]) => r),
  };
}

function createBatches(array, size) {
  const batches = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

function updateProgress(completedRetries, maxRetries) {
  const progress = Math.round((completedRetries / maxRetries) * 100);
  if (typeof window !== "undefined" && window.document) {
    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${progress}%`;
    }
  }
  console.log(`Progress: ${progress}%`);
}
