import {
  relays,
  userRelayUrls,
  normalizeRelayUrl,
  openTemporaryRelay,
} from "./nostrService.js";
import { queryRelay } from "./fetching.js";

const PASS_TIMEOUT = 6000;
const VERIFY_CHUNK = 10; // per-author filters per REQ in the final verification
const OUTBOX_MAX_RELAYS_PER_AUTHOR = 5;
const OUTBOX_CONCURRENCY = 12;
const OUTBOX_DEADLINE_MS = 90000;

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
  const lastNotes = new Map(); // pubkey -> newest kind 1 created_at seen (verification)
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

  // Batch queries can miss authors (relay result caps, quirks). For everyone
  // still unseen, ask for each author's single newest note so the verdict
  // rests on their actual latest note, not on a shared result window.
  const { userRelays, otherRelays } = splitRelays();
  await verifyLatestNotes(allPubkeys.filter((p) => !activePubkeys.has(p)), userRelays);
  await verifyLatestNotes(allPubkeys.filter((p) => !activePubkeys.has(p)), otherRelays);

  // Authors often post only to their own (NIP-65 "write") relays, which none of
  // our shared relays may carry. Ask those relays directly for what's left.
  await verifyViaAuthorRelays(allPubkeys.filter((p) => !activePubkeys.has(p)));

  updateProgress(maxRetries, maxRetries);

  if (!state.anyRelayFinished) {
    throw new Error("No relay responded; refusing to classify follows as inactive.");
  }

  return {
    activePubkeys: Array.from(activePubkeys),
    inactivePubkeys: allPubkeys.filter((pubkey) => !activePubkeys.has(pubkey)),
    followedKind0,
    lastNotes,
  };

  function recordNotes(events) {
    for (const event of events) {
      if (event.kind !== 1 || !scope.has(event.pubkey)) continue;
      if (event.created_at > (lastNotes.get(event.pubkey) ?? 0)) {
        lastNotes.set(event.pubkey, event.created_at);
      }
      if (event.created_at > inactiveThreshold) {
        activePubkeys.add(event.pubkey);
      }
    }
  }

  async function verifyViaAuthorRelays(pubkeys) {
    if (pubkeys.length === 0) return;
    const deadline = Date.now() + OUTBOX_DEADLINE_MS;
    const sharedRelays = Object.values(relays).filter(
      (relay) => relay.readyState === WebSocket.OPEN
    );

    // 1. Each remaining author's newest relay list (kind 10002)
    const relayLists = new Map();
    for (let i = 0; i < pubkeys.length; i += 100) {
      const authors = pubkeys.slice(i, i + 100);
      const results = await Promise.all(
        sharedRelays.map((relay) =>
          queryRelay(relay, [{ authors, kinds: [10002] }], { timeout: PASS_TIMEOUT })
        )
      );
      for (const result of results) {
        if (result.ok) state.anyRelayFinished = true;
        for (const event of result.events) {
          if (event.kind !== 10002 || !scope.has(event.pubkey)) continue;
          const current = relayLists.get(event.pubkey);
          if (!current || event.created_at > current.created_at) {
            relayLists.set(event.pubkey, event);
          }
        }
      }
    }

    // 2. Group authors by the write relays we are not already connected to
    const connected = new Set(Object.keys(relays));
    const authorsByRelay = new Map();
    for (const [pubkey, event] of relayLists) {
      const urls = event.tags
        .filter((tag) => tag[0] === "r" && (!tag[2] || tag[2] === "write"))
        .map((tag) => normalizeRelayUrl(tag[1]))
        .filter((url) => url && !connected.has(url));
      for (const url of [...new Set(urls)].slice(0, OUTBOX_MAX_RELAYS_PER_AUTHOR)) {
        if (!authorsByRelay.has(url)) authorsByRelay.set(url, []);
        authorsByRelay.get(url).push(pubkey);
      }
    }

    // 3. Ask each relay for its authors' newest note (bounded concurrency)
    const queue = Array.from(authorsByRelay);
    const worker = async () => {
      while (queue.length > 0 && Date.now() < deadline) {
        const [url, authors] = queue.shift();
        const todo = authors.filter((pubkey) => !activePubkeys.has(pubkey));
        if (todo.length === 0) continue;

        const socket = await openTemporaryRelay(url);
        if (!socket) continue;
        try {
          for (let i = 0; i < todo.length; i += VERIFY_CHUNK) {
            const chunk = todo
              .slice(i, i + VERIFY_CHUNK)
              .filter((pubkey) => !activePubkeys.has(pubkey));
            if (chunk.length === 0) continue;
            const result = await queryRelay(
              socket,
              chunk.map((pubkey) => ({ authors: [pubkey], kinds: [1], limit: 1 })),
              { timeout: PASS_TIMEOUT }
            );
            if (result.ok) state.anyRelayFinished = true;
            recordNotes(result.events);
          }
        } finally {
          socket.close();
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(OUTBOX_CONCURRENCY, queue.length) }, worker)
    );
  }

  async function verifyLatestNotes(pubkeys, relayList) {
    if (pubkeys.length === 0) return;
    await Promise.all(
      relayList.map(async (relay) => {
        for (let i = 0; i < pubkeys.length; i += VERIFY_CHUNK) {
          const chunk = pubkeys
            .slice(i, i + VERIFY_CHUNK)
            .filter((pubkey) => !activePubkeys.has(pubkey));
          if (chunk.length === 0) continue;

          const result = await queryRelay(
            relay,
            chunk.map((pubkey) => ({ authors: [pubkey], kinds: [1], limit: 1 })),
            { timeout: PASS_TIMEOUT }
          );
          if (result.ok) state.anyRelayFinished = true;
          recordNotes(result.events);
        }
      })
    );
  }

  async function queryBatch(pubkeys, relayList) {
    if (relayList.length === 0) return;

    // Only the newest kind 1 per window and the newest kind 0 are requested
    const filters = [
      { authors: pubkeys, kinds: [1], since: inactiveThreshold },
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
