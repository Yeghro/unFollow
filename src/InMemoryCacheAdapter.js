class InMemoryCacheAdapter {
  constructor() {
    this.cache = new Map();
    this.ready = true;
  }

  async query(subscription) {
    const result = this.cache.get(subscription.pubkey);
    if (result) {
      subscription.callback(result);
    }
  }

  async setEvent(event, filters, relay) {
    this.cache.set(event.pubkey, event);
  }

  async deleteEvent(event) {
    this.cache.delete(event.pubkey);
  }

  async fetchProfile(pubkey) {
    return this.cache.get(pubkey) || null;
  }

  saveProfile(pubkey, profile) {
    this.cache.set(pubkey, profile);
  }

  async loadNip05(nip05, maxAgeForMissing) {
    return this.cache.get(nip05) || null;
  }

  saveNip05(nip05, profile) {
    this.cache.set(nip05, profile);
  }

  async loadUsersLNURLDoc(pubkey, maxAgeInSecs, maxAgeForMissing) {
    return this.cache.get(pubkey) || null;
  }

  saveUsersLNURLDoc(pubkey, doc) {
    this.cache.set(pubkey, doc);
  }

  updateRelayStatus(relayUrl, info) {
    this.cache.set(relayUrl, info);
  }

  getRelayStatus(relayUrl) {
    return this.cache.get(relayUrl);
  }

  onReady(callback) {
    if (this.ready) {
      callback();
    }
  }

  clear() {
    this.cache.clear();
  }
}

export default InMemoryCacheAdapter;
