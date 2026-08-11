// Frontend constants + helpers. Logic lives in base44/shared/delivery.js
// (single source of truth) and is re-exported here for the UI.
export * from "../../base44/shared/delivery.js";

export const CATEGORY_OPTIONS = Object.entries(
  // re-declare locally to avoid circular reliance on the re-export shape
  {
    food_pickup: "Food Pickup",
    grocery_shop_deliver: "Grocery Shop & Deliver",
    grocery_pickup: "Grocery Pickup",
    retail: "Retail",
    package: "Package",
    alcohol: "Alcohol",
    pharmacy: "Pharmacy",
  }
).map(([value, label]) => ({ value, label }));

export const AVOID_TYPES = [
  { value: "customer", label: "Customer" },
  { value: "restaurant", label: "Restaurant" },
  { value: "store", label: "Store" },
  { value: "location", label: "Location" },
  { value: "apartment", label: "Apartment Complex" },
];

export const AVOID_REASONS = [
  { value: "slow", label: "Slow" },
  { value: "poor_parking", label: "Poor Parking" },
  { value: "long_wait", label: "Long Wait" },
  { value: "low_tips", label: "Low Tips" },
  { value: "difficult_location", label: "Difficult Location" },
  { value: "personal_preference", label: "Personal Preference" },
  { value: "other", label: "Other" },
];

export const DAILY_GOAL_PRESETS = [100, 150, 200, 300];