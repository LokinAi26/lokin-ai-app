// App Store 1.0 launch guards. Keep regulated and externally-billed features
// dormant until the required licensed partners / native billing rails are live.
export const RELEASE_FLAGS = Object.freeze({
  appStoreSafeLaunch: true,
  regulatedCannabis: false,
  insuranceTransactions: false,
  externalDigitalSubscriptions: false,
  moneyMovement: false,
  partnerPromotions: false,
});
