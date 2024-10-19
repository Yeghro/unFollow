import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
import { fetchKind0Events } from "./fetching.js";

const RELAY_URLS = [
  "wss://purplepag.es",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://nostrpub.yeghro.site",
];

const CONNECTION_TIMEOUT = 3000;
const VALIDATION_TIMEOUT = 3000;
const RESPONSE_TIMEOUT = 3000;

let relays = {};
let nip07Signer = null;
let activeUser = null;

const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
};

const initializeNip07Signer = async () => {
  try {
    if (typeof window !== "undefined" && window.nostr) {
      nip07Signer = new NDKNip07Signer();
      activeUser = await nip07Signer.user();
      logger.info(`Signer is ready and user is: ${activeUser.npub}`);
    } else {
      logger.warn("NIP-07 extension not detected.");
    }
  } catch (error) {
    logger.error(`Error initializing NDKNip07Signer: ${error.message}`);
  }
};

const createWebSocket = (url) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeoutId = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection to ${url} timed out`));
    }, CONNECTION_TIMEOUT);

    ws.onopen = () => {
      clearTimeout(timeoutId);
      resolve(ws);
    };

    ws.onerror = (error) => {
      clearTimeout(timeoutId);
      reject(error);
    };
  });
};

const connectToRelay = async (url) => {
  try {
    const ws = await createWebSocket(url);
    relays[url] = ws;
    logger.info(`Successfully connected to relay: ${url}`);
    return true;
  } catch (error) {
    logger.warn(`Failed to connect to relay ${url}: ${error.message}`);
    return false;
  }
};

export const connectToRelays = async (urls = RELAY_URLS) => {
  await initializeNip07Signer();

  const newUrls = urls.filter((url) => !relays[url]);
  logger.info(`Attempting to connect to new relays: ${newUrls.join(", ")}`);

  const results = await Promise.all(newUrls.map(connectToRelay));
  const successfulConnections = results.filter(Boolean).length;

  logger.info(
    `Successfully connected to ${successfulConnections} out of ${newUrls.length} new relays.`
  );
  logger.info(`Established Relay Instances: ${Object.keys(relays).join(", ")}`);
};

const validateRelay = async (url) => {
  logger.info(`Starting validation for relay: ${url}`);
  try {
    const ws = await createWebSocket(url);

    const testRequest = JSON.stringify([
      "REQ",
      "test",
      { limit: 1, kinds: [1] },
    ]);
    ws.send(testRequest);

    const response = await Promise.race([
      new Promise((resolve) => {
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message[0] === "EVENT" || message[0] === "EOSE") {
            resolve({ status: "success" });
          }
        };
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("No response")), RESPONSE_TIMEOUT)
      ),
    ]);

    ws.close();
    logger.info(`Relay ${url} validated successfully`);
    return { url, ...response };
  } catch (error) {
    logger.warn(`Validation failed for relay ${url}: ${error.message}`);
    return { url, status: "failed", reason: error.message };
  }
};

const getUserRelays = async (pubkey) => {
  logger.info(`Starting getUserRelays for pubkey: ${pubkey}`);
  const userRelays = new Set();
  const subscriptionId = `user-relays-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  const request = JSON.stringify([
    "REQ",
    subscriptionId,
    {
      authors: [pubkey],
      kinds: [10002],
      limit: 1,
    },
  ]);

  const relayPromises = Object.values(relays).map(async (ws) => {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ status: "timeout", url: ws.url });
      }, RESPONSE_TIMEOUT);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg[0] === "EVENT" && msg[2].kind === 10002) {
          clearTimeout(timeoutId);
          msg[2].tags.forEach((tag) => {
            if (tag[0] === "r") {
              userRelays.add(tag[1]);
            }
          });
          resolve({ status: "success", url: ws.url });
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        logger.warn(`WebSocket error for ${ws.url}: ${error.message}`);
        resolve({ status: "error", url: ws.url, error: error.message });
      };

      ws.send(request);
    });
  });

  const results = await Promise.allSettled(relayPromises);

  results.forEach((result) => {
    if (result.value.status === "timeout") {
      logger.warn(`Timeout fetching user relays from ${result.value.url}`);
    } else if (result.value.status === "error") {
      logger.warn(
        `Error fetching user relays from ${result.value.url}: ${result.value.error}`
      );
    }
  });

  // Close the subscription
  Object.values(relays).forEach((ws) => {
    ws.send(JSON.stringify(["CLOSE", subscriptionId]));
  });

  logger.info(
    `Finished getUserRelays. User relays: ${Array.from(userRelays).join(", ")}`
  );
  return Array.from(userRelays);
};

export const connectUsersRelays = async (targetPubkey) => {
  logger.info(`Starting connectUsersRelays for pubkey: ${targetPubkey}`);

  if (Object.keys(relays).length === 0) {
    logger.info("No existing relays, connecting to default relays");
    await connectToRelays();
  }

  logger.info("Starting to fetch kind 0 events");
  const kind0FetchPromise = fetchKind0Events([targetPubkey]);

  logger.info("Fetching user-specific relays");
  const userRelays = await getUserRelays(targetPubkey);

  logger.info("Validating user relays");
  const validationResults = await Promise.all(userRelays.map(validateRelay));

  const validUserRelays = validationResults
    .filter((result) => result.status === "success")
    .map((result) => result.url);

  logger.info(`Valid user relays: ${validUserRelays.join(", ")}`);

  const allRelayUrls = [...new Set([...RELAY_URLS, ...validUserRelays])];
  logger.info(`All relay URLs: ${allRelayUrls.join(", ")}`);

  logger.info("Connecting to additional relays");
  await connectToRelays(allRelayUrls);

  logger.info("Finished connectUsersRelays");

  return await kind0FetchPromise;
};

export { nip07Signer, activeUser, relays };
