// LOKIN Driver offer visibility boundary.
// Private account/user-derived offers must never cross driver accounts.
// Explicit market feeds may be shared. Legacy rows are handled conservatively.

const MARKET_SOURCES = new Set(["merchant_feed", "official_api"]);

export function offerVisibleToUser(offer, userId) {
  if (!offer || !userId) return false;
  const uid = String(userId);
  const visibility = String(offer.visibility || "").toLowerCase();
  const owner = String(offer.owner_user_id || "");
  const creator = String(offer.created_by_id || "");

  if (visibility === "market") return true;
  if (visibility === "private") return owner ? owner === uid : creator === uid;
  if (owner) return owner === uid;
  if (creator) return creator === uid;

  // Legacy service-role rows without an owner may only remain globally visible
  // when their provenance is an official/merchant feed. Unscoped user-entered
  // records fail closed instead of becoming cross-account data.
  return MARKET_SOURCES.has(String(offer.source_type || ""));
}

export function filterOffersForUser(offers, userId) {
  return (offers || []).filter((offer) => offerVisibleToUser(offer, userId));
}

export function privateOfferScope(userId) {
  return {
    owner_user_id: String(userId),
    visibility: "private",
  };
}

export function marketOfferScope() {
  return { visibility: "market" };
}
