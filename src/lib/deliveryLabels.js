// Re-export category labels for the frontend (shared module uses plain JS)
export const CATEGORY_LABELS = {
  food_pickup: "Food Pickup",
  grocery_shop_deliver: "Grocery Shop & Deliver",
  grocery_pickup: "Grocery Pickup",
  retail: "Retail",
  package: "Package",
  alcohol: "Alcohol",
  pharmacy: "Pharmacy",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));