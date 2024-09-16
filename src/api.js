import {connectUsersRelays, createWebSocket} from './nostrService.js';
import { nip19 } from "nostr-tools";
import { categorizePubkeys } from "./eventProcessing.js";
import { fetchKind3Events } from './fetching.js';

const isNode = typeof window === 'undefined';

connectUsersRelays();

export async function getInactiveFollows(pubkeyOrNpub, inactiveMonths) {
  try {
    let pubkey = pubkeyOrNpub;

    // Decode npub if necessary
    if (typeof pubkeyOrNpub === 'string' && pubkeyOrNpub.startsWith('npub')) {
      try {
        const decoded = nip19.decode(pubkeyOrNpub);
        pubkey = decoded.data;
      } catch (error) {
        throw new Error("Invalid npub provided: " + error.message);
      }
    } else if (!/^[0-9a-fA-F]{64}$/.test(pubkeyOrNpub)) {
      throw new Error("Invalid pubkey format");
    }

    // Validate inactiveMonths
    inactiveMonths = parseInt(inactiveMonths);
    if (isNaN(inactiveMonths) || inactiveMonths <= 0) {
      throw new Error("Invalid inactiveMonths: must be a positive integer");
    }

    // Use the environment-appropriate functions
    await connectUsersRelays();
    
    // You might need to adapt fetchKind3Events if it uses browser-specific APIs
    const { followedPubkeys, followedTopics, totalPubkeys, totalTopics, eventContent } = 
      await fetchKind3Events(pubkey);

    // Categorize pubkeys
    const { activePubkeys, inactivePubkeys, followedKind0 } = await categorizePubkeys(followedPubkeys, inactiveMonths);

    // Prepare result
    const inactiveProfiles = inactivePubkeys.map(inactivePubkey => ({
      pubkey: inactivePubkey,
      npub: nip19.npubEncode(inactivePubkey),
      name: followedKind0[inactivePubkey]?.name || null,
      nip05: followedKind0[inactivePubkey]?.nip05 || null
    }));

    return {
      totalFollowed: totalPubkeys,
      inactiveCount: inactiveProfiles.length,
      inactiveProfiles,
      inactiveMonths,
      followedTopics,
      totalTopics,
      eventContent
    };

  } catch (error) {
    console.error("Error in getInactiveFollows:", error);
    throw error;
  }
}