// Client-side net-profit estimates for the Driver Opportunity Hub.
// Uses the driver's saved DriverPreference (mileage cost, mpg, gas price)
// so comparison is personalized without per-listing AI cost.

export function estimateNet(opp, prefs = {}) {
  const hours = Number(opp.est_weekly_hours) > 0 ? Number(opp.est_weekly_hours) : 30;
  const miles = Number(opp.est_weekly_miles) > 0 ? Number(opp.est_weekly_miles) : 250;
  const rate = Number(opp.pay_amount) || 0;
  const gross = Math.round(rate * hours);

  // Prefer the driver's mileage cost (IRS standard $/mile); fall back to mpg+gas.
  const mileageCost = Number(prefs.mileage_cost) > 0 ? Number(prefs.mileage_cost) : 0.67;
  const vehicleCost = Math.round(miles * mileageCost);

  const net = gross - vehicleCost;
  const netPerHour = hours > 0 ? Math.round((net / hours) * 10) / 10 : 0;
  return { hours, miles, gross, vehicleCost, net, netPerHour };
}

export const PAY_SOURCE_LABEL = {
  advertised: "Advertised",
  estimated: "LOKIN estimate",
  user_reported: "Driver-reported",
};

export const SCHEDULE_LABEL = {
  flexible: "Flexible",
  fixed_shifts: "Fixed shifts",
  on_demand: "On-demand",
  part_time: "Part-time",
  full_time: "Full-time",
};

export const ROLE_LABEL = {
  personal_car: "Personal car",
  cargo_van: "Cargo van",
  box_truck: "Box truck",
  any: "Any vehicle",
};