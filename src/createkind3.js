export async function createKind3Event(hexKey, activePubkeys) {
  // Ensure activePubkeys is not empty before creating the event
  if (!activePubkeys || activePubkeys.length === 0) {
    console.error("No active pubkeys provided. Aborting event creation.");
    return;
  }

  // Validate hexKey
  if (!hexKey) {
    console.error("Invalid hexKey. Aborting event creation.");
    return;
  }

  const kind3Event = new NDKEvent(ndk, {
    kind: 3,
    tags: activePubkeys.map((pubkey) => ["p", pubkey]),
    content: "",
    created_at: Math.floor(Date.now() / 1000),
    pubkey: hexKey, // Ensure the hexKey is used as the author's pubkey
  });

  try {
    await kind3Event.sign(nip07signer); // Use nip07signer instead of ndk.signer
    await kind3Event.publish();
    console.log("Kind 3 event created and published:", kind3Event);
  } catch (error) {
    console.error("Failed to create or publish Kind 3 event:", error);
  }
}
