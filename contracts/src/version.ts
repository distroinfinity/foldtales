/**
 * Sent on every backend call and checked by the server. Schemas are strict, so any change
 * to a wire shape bumps this, additive or not. Old cached clients then take the authored
 * path until they update.
 */
export const CONTRACT_VERSION = 2;
