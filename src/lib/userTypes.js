// User types LOKIN AI serves — delivery drivers, truckers, and travelers.
export const USER_TYPES = [
  {
    value: "driver",
    label: "Delivery Driver",
    short: "Driver",
    emoji: "🛵",
    tagline: "Lock in. Make more.",
    homeTitle: "Command Center",
    accent: "primary",
  },
  {
    value: "trucker",
    label: "Trucker",
    short: "Trucker",
    emoji: "🚛",
    tagline: "Long haul. Locked in.",
    homeTitle: "Cockpit",
    accent: "accent",
  },
  {
    value: "traveler",
    label: "Traveler",
    short: "Traveler",
    emoji: "🧭",
    tagline: "Road trips. Locked in.",
    homeTitle: "Trip Hub",
    accent: "primary",
  },
];

export function getRoleMeta(userType) {
  return USER_TYPES.find((t) => t.value === userType) || USER_TYPES[0];
}