// Vehicle tags for earnings logging and per-vehicle earnings comparisons.
// Single source shared by the income form and the comparison cards.
export const VEHICLES = [
  { value: "car", label: "Car" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "cargo_van", label: "Cargo van" },
  { value: "box_truck", label: "Box truck" },
  { value: "other", label: "Other" },
];

export function vehicleLabel(value) {
  return VEHICLES.find((v) => v.value === value)?.label ?? "Unlabeled";
}

// Maps the driver profile's vehicle class to the closest earnings tag.
export function tagFromProfileType(vehicleType) {
  if (vehicleType === "cargo_van") return "cargo_van";
  if (vehicleType === "box_truck") return "box_truck";
  if (vehicleType === "other") return "other";
  return "car"; // personal_car
}