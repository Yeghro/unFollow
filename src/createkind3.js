import { activeUser, signEvent, relays } from "./nostrService.js";

const PUBLISH_TIMEOUT = 10000;

// Republishes the user's existing follow list with only the inactive `p` tags
// removed. Every other tag and the content are carried over untouched.
export async function createKind3Event(inactivePubkeys, originalEvent) {
  if (!originalEvent) {
    throw new Error("No existing follow list was found; nothing to update.");
  }
  if (originalEvent.pubkey !== activeUser?.pubkey) {
    throw new Error("The follow list does not belong to the logged-in user.");
  }

  const inactive = new Set(inactivePubkeys);
  const tags = originalEvent.tags.filter(
    (tag) => !(tag[0] === "p" && inactive.has(String(tag[1]).toLowerCase()))
  );
  const removed = originalEvent.tags.length - tags.length;
  const kept = tags.filter((tag) => tag[0] === "p").length;

  if (removed === 0) {
    throw new Error("No inactive follows to remove.");
  }
  if (kept === 0) {
    throw new Error("Refusing to publish an empty follow list.");
  }

  const unsignedEvent = {
    kind: 3,
    tags,
    content: originalEvent.content ?? "",
    // Must be newer than the event it replaces
    created_at: Math.max(
      Math.floor(Date.now() / 1000),
      originalEvent.created_at + 1
    ),
  };

  const signedEvent = await signEvent(unsignedEvent);
  const accepted = await publishEventToRelays(signedEvent);
  return { removed, kept, accepted };
}

// Resolves with the number of relays that accepted the event; rejects if none did.
async function publishEventToRelays(signedEvent) {
  const openRelays = Object.values(relays).filter(
    (relay) => relay.readyState === WebSocket.OPEN
  );

  const outcomes = await Promise.all(
    openRelays.map(
      (relay) =>
        new Promise((resolve) => {
          let timer;
          const finish = (result) => {
            clearTimeout(timer);
            relay.removeEventListener("message", onMessage);
            relay.removeEventListener("close", onClose);
            resolve(result);
          };
          const onClose = () => finish({ accepted: false, reason: "closed" });
          const onMessage = (event) => {
            let message;
            try {
              message = JSON.parse(event.data);
            } catch {
              return;
            }
            if (message[0] === "OK" && message[1] === signedEvent.id) {
              finish({ accepted: message[2] === true, reason: message[3] });
            }
          };

          relay.addEventListener("message", onMessage);
          relay.addEventListener("close", onClose);
          timer = setTimeout(
            () => finish({ accepted: false, reason: "timeout" }),
            PUBLISH_TIMEOUT
          );
          relay.send(JSON.stringify(["EVENT", signedEvent]));
        })
    )
  );

  const accepted = outcomes.filter((outcome) => outcome.accepted).length;
  if (accepted === 0) {
    const reasons = [...new Set(outcomes.map((o) => o.reason).filter(Boolean))];
    throw new Error(
      `Event was not accepted by any relay${reasons.length ? ` (${reasons.join(", ")})` : ""}.`
    );
  }
  return accepted;
}
