import assert from "node:assert/strict";
import fs from "node:fs";
import { offerVisibleToUser, filterOffersForUser } from "../base44/shared/offerAccess.js";
import { driverProviderList, getDriverProvider, providerSafetyContract } from "../base44/shared/driverProviderRegistry.js";

const alice = "user-alice";
const bob = "user-bob";

const privateAlice = { id: "a", owner_user_id: alice, visibility: "private", source_type: "official_api" };
const privateBob = { id: "b", owner_user_id: bob, visibility: "private", source_type: "official_api" };
const market = { id: "m", visibility: "market", source_type: "merchant_feed" };
const legacyUser = { id: "lu", created_by_id: alice, source_type: "user_entered" };
const unsafeLegacy = { id: "ul", source_type: "user_entered" };
const legacyMarket = { id: "lm", source_type: "merchant_feed" };

assert.equal(offerVisibleToUser(privateAlice, alice), true, "owner must see private offer");
assert.equal(offerVisibleToUser(privateAlice, bob), false, "other driver must not see private offer");
assert.equal(offerVisibleToUser(market, alice), true, "market offer must be visible");
assert.equal(offerVisibleToUser(legacyUser, alice), true, "legacy creator must retain access");
assert.equal(offerVisibleToUser(legacyUser, bob), false, "legacy user row must not cross accounts");
assert.equal(offerVisibleToUser(unsafeLegacy, alice), false, "unscoped legacy user offer must fail closed");
assert.equal(offerVisibleToUser(legacyMarket, bob), true, "legacy service-role merchant feed may remain market-visible");
assert.deepEqual(filterOffersForUser([privateAlice, privateBob, market], alice).map((row) => row.id), ["a", "m"]);

const safety = providerSafetyContract();
assert.equal(safety.driver_confirmation_required, true);
assert.equal(safety.automatic_platform_action, false);
assert.equal(safety.automatic_acceptance, false);
assert.equal(safety.gps_spoofing, false);
assert.equal(safety.platform_scraping, false);
assert.equal(safety.acceptance_bypass, false);

const uber = getDriverProvider("uber_eats");
const doordash = getDriverProvider("doordash");
const instacart = getDriverProvider("instacart");
const spark = getDriverProvider("walmart_spark");
assert.equal(uber.capabilities.live_offers, false, "Uber public adapter must not claim live offers");
assert.equal(doordash.capabilities.live_offers, false, "DoorDash adapter must not claim public Dasher live offers");
assert.equal(instacart.capabilities.live_offers, false, "Instacart adapter must not claim public Shopper live batches");
assert.equal(spark.key, "spark");
assert.ok(driverProviderList().length >= 8, "registry should cover primary driver platforms");

const ingest = fs.readFileSync(new URL("../base44/functions/ingest-authorized-provider-offer/entry.ts", import.meta.url), "utf8");
assert.match(ingest, /LOKIN_PARTNER_INGEST_SECRET/, "signed ingest secret must be required");
assert.match(ingest, /LOKIN_DRIVER_PROVIDER_ALLOWLIST/, "provider allowlist must be required");
assert.match(ingest, /HMAC/, "HMAC verification must be present");
assert.match(ingest, /platform_verified/, "only signed gateway may assign platform verification");
assert.match(ingest, /automatic_platform_action: false/, "gateway safety response must disable platform action");

for (const file of [
  "../base44/functions/earnings-intelligence/entry.ts",
  "../base44/functions/optimizeRoute/entry.ts",
  "../base44/functions/seal-evaluate/entry.ts",
  "../base44/functions/hotspot-map/entry.ts",
]) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  assert.match(source, /filterOffersForUser/, `${file} must enforce per-driver offer visibility`);
}

console.log(JSON.stringify({
  offer_isolation: "PASS",
  signed_ingest: "PASS",
  deny_by_default: "PASS",
  provider_registry: "PASS",
  safety_contract: "PASS",
}, null, 2));
