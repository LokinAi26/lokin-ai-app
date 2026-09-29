import { useState } from "react";
import { Search } from "lucide-react";
import ApparelMockup from "@/components/ApparelMockup";

// Full LOKIN catalog — 25 categories, 92 products.
// Apparel + delivery systems from the Driver Collection poster,
// plus the 7-piece Delivery Hardware ecosystem lineup.
// Every variant maps to a purpose-built ApparelMockup visual so no
// product ever renders as the wrong object; `selfdefense` is reserved
// for actual safety/utility-kit items only.
const SECTIONS = [
  {
    title: "Apparel Collection",
    items: [
      { variant: "hoodie", name: "AI Pullover Hoodie", sub: "Signature lockup", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d774b32eb_01_ai_pullover_hoodie.png" },
      { variant: "hoodie", name: "AI Tech Jacket", sub: "Driver tech shell", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7f79ced33_02_ai_tech_jacket.png" },
      { variant: "tee", name: "Sleeve Detail Tee", sub: "Long sleeve", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a234b3606_03_sleeve_detail.png" },
      { variant: "cap", name: "LOKIN Bucket Hat", sub: "Embroidered lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c748f4f87_04_ai_bucket_hat.png" },
      { variant: "tee", name: "Long Sleeve Tee", sub: "Signature lockup", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c58e33b60_05_long_sleeve.png" },
    ],
  },
  {
    title: "Driver Collection",
    items: [
      { variant: "hoodie", name: "Driver Hoodie", sub: "Hi-vis trim", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/0221c6cf0_09_driver_hoodie.png" },
      { variant: "tee", name: "Driver Polo", sub: "Reflective logo", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/bf2a416c7_12_driver_polo.png" },
      { variant: "hoodie", name: "Reflective Driver Jacket", sub: "Night visibility", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3e4b46182_11_reflective_jacket.png" },
      { variant: "tee", name: "Hi-Vis Driver Vest", sub: "ANSI-style panels", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c3469fd2a_10_hi_vis_vest.png" },
    ],
  },
  {
    title: "Bottoms & Headwear",
    items: [
      { variant: "joggers", name: "Driver Joggers", sub: "Athletic fit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/cd8527663_10_driver_gloves.png" },
      { variant: "cap", name: "LOKIN Snapback", sub: "Embroidered lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b0e031123_07_snapback.png" },
      { variant: "beanie", name: "Driver Beanie", sub: "Thermal knit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3e1e8b590_09_driver_hoodie.png" },
    ],
  },
  {
    title: "Rain Gear Collection",
    items: [
      { variant: "raincoat", name: "Rain Jacket", sub: "Waterproof shell", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/0f25ecc04_14_rain_jacket.png" },
      { variant: "raincoat", name: "Long Rain Coat", sub: "Full coverage", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/6f6bc4e5f_15_long_rain_coat.png" },
      { variant: "raincoat", name: "Driver Poncho", sub: "Packable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b6fd43b24_12_driver_polo.png" },
      { variant: "raincoat", name: "Packable Rain Jacket", sub: "Packs to pouch", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a2e74e90a_17_packable_jacket.png" },
    ],
  },
  {
    title: "Winter Headgear",
    items: [
      { variant: "hoodie", name: "Thermal Hoodie", sub: "Fleece-lined", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/29cd6b881_21_thermal_hoodie.png" },
      { variant: "shiesty", name: "Ski Mask", sub: "Full-face thermal", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7504f49e4_22_ski_mask.png" },
      { variant: "shiesty", name: "LOKIN Balaclava", sub: "Fleece · One size", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ccfbb2f55_23_balaclava.png" },
      { variant: "shiesty", name: "Neck Gaiter", sub: "Fleece tube", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7ec899f4f_09_neck_gaiter.png" },
      { variant: "beanie", name: "Winter Beanie", sub: "Thermal knit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d1c595098_glow_beanie.png" },
    ],
  },
  {
    title: "Winter Outerwear",
    items: [
      { variant: "hoodie", name: "Insulated Winter Coat", sub: "Heavy fill", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/396606124_19_insulated_coat.png" },
      { variant: "hoodie", name: "Driver Puffer Jacket", sub: "Packable warmth", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/55692cf87_20_puffer_jacket.png" },
    ],
  },
  {
    title: "Glow in the Dark",
    items: [
      { variant: "hoodie", name: "Glow Hoodie", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1a2979b43_glow_hoodie.png" },
      { variant: "tee", name: "Glow Tee", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e80557fbc_31_glow_tee.png" },
      { variant: "hoodie", name: "Glow Jacket", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/567ab9a0e_32_glow_jacket.png" },
      { variant: "hoodie", name: "Glow Sweatshirt", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/8c5461798_33_glow_sweatshirt.png" },
    ],
  },
  {
    title: "Pizza Bags — Insulated",
    items: [
      { variant: "pizza", name: "Pizza Bag · Small", sub: "18\" · 1-pie" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c957edcca_28_pizza_bag_small.png"},
      { variant: "pizza", name: "Pizza Bag · Medium", sub: "20\" · 2-pie" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/dbd7f8b40_29_pizza_bag_medium.png"},
      { variant: "pizza", name: "Pizza Bag · Large", sub: "24\" · 3-pie" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/62c8d1032_30_pizza_bag_large.png"},
      { variant: "pizza", name: "Pizza Bag · XL", sub: "Multi-pie", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/37ae96dd1_31_pizza_bag_xlarge.png" },
      { variant: "pizza", name: "Pizza Bag · XXL", sub: "Catering size", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1c7a411b5_32_pizza_bag_xxlarge.png" },
    ],
  },
  {
    title: "Catering Bags — Insulated",
    items: [
      { variant: "catering", name: "Catering Bag · Compact", sub: "13\" × 10\" × 9\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e5c884465_33_catering_bag_small.png"},
      { variant: "catering", name: "Catering Bag · Medium", sub: "18\" × 14\" × 12\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1ab6f91ee_34_catering_bag_medium.png"},
      { variant: "catering", name: "Catering Bag · Large", sub: "22\" × 16\" × 13\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/4bb54a364_35_catering_bag_large.png"},
      { variant: "catering", name: "Catering Bag · XL", sub: "26\" × 18\" × 14\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1a31277da_36_catering_bag_xlarge.png"},
    ],
  },
  {
    title: "Tote Bags — Delivery",
    items: [
      { variant: "tote", name: "LOKIN Tote · Small", sub: "Everyday carry", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f5c74b14b_37_tote_small.png" },
      { variant: "tote", name: "LOKIN Tote · Medium", sub: "Grocery runs", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a2387b2d1_38_tote_medium.png" },
      { variant: "tote", name: "LOKIN Tote · Large", sub: "Bulk hauls", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1fb1f356b_39_tote_large.png" },
    ],
  },
  {
    title: "Drink Cup Holders",
    items: [
      { variant: "cupholder", name: "Cup Carrier · 2-Cup", sub: "Spill-proof slots", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/4bd56ca15_40_two_cup_holder.png" },
      { variant: "cupholder", name: "Cup Carrier · 4-Cup", sub: "Spill-proof slots", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/06028bba2_41_four_cup_holder.png" },
      { variant: "cupholder", name: "Cup Carrier · 6-Cup", sub: "Spill-proof slots", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/69fe8a9d7_42_six_cup_holder.png" },
    ],
  },
  {
    title: "Food Warming & Transport",
    items: [
      { variant: "delivery", name: "Insulated Food Blanket", sub: "Hot/cold hold", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/97f21bfd5_44_insulated_food_cover.png" },
      { variant: "delivery", name: "Insulated Bag Cover", sub: "Extra layer", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d418fe8b9_44_insulated_food_cover.png" },
      { variant: "delivery", name: "Hot/Cold Gel Pack", sub: "Reusable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/afb378f5d_45_hot_cold_pack.png" },
      { variant: "delivery", name: "Thermal Foil Liner", sub: "Heat reflector", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a4402ff4b_46_thermal_foil_liner.png" },
    ],
  },
  {
    title: "Bags & Carry Gear",
    items: [
      { variant: "tote", name: "Shoulder Delivery Bag", sub: "Padded strap", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/16cffb59e_51_bike_delivery_bag.png" },
      { variant: "pouch", name: "Driver Fanny Pack", sub: "Quick access", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1b3113d08_48_fanny_pack.png" },
      { variant: "pouch", name: "Chest Bag", sub: "Ride-ready", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/969a954bd_49_chest_bag.png" },
      { variant: "pouch", name: "Crossbody Bag", sub: "Secure fit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/5677142d5_06_crossbody_bag.png" },
    ],
  },
  {
    title: "Bike Delivery Gear",
    items: [
      { variant: "delivery", name: "Bike Delivery Bag", sub: "Frame-mount ready", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/db65fb12b_51_bike_delivery_bag.png" },
      { variant: "delivery", name: "Handlebar Bag", sub: "Quick access", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/51be33bcd_52_bike_handlebar_bag.png" },
      { variant: "delivery", name: "Pannier Bags · Pair", sub: "Rack-mount", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e2ac83023_53_bike_panniers.png" },
    ],
  },
  {
    title: "Comfort on the Go",
    items: [
      { variant: "pillow", name: "Travel Pillow", sub: "Memory foam", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/988eb84de_54_travel_pillow.png" },
      { variant: "pillow", name: "Neck Pillow", sub: "Memory foam", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/08c9a33b9_55_neck_pillow.png" },
    ],
  },
  {
    title: "Comfort Seat & Support",
    items: [
      { variant: "seatcushion", name: "Driver Seat Cushion", sub: "Mesh · breathable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/fcf49e553_56_seat_cushion.png" },
      { variant: "seatcushion", name: "Lumbar Support Cushion", sub: "Driver back support", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ad741cdaf_58_lumbar_cushion.png" },
      { variant: "massagecover", name: "Massage Seat Cover", sub: "Vibration nodes", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/77550a6ba_57_massage_seat_cover.png" },
    ],
  },
  {
    title: "Moisture-Wicking Socks",
    items: [
      { variant: "socks", name: "Socks · Summer Low-Cut 3-Pack", sub: "Cool & dry", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f2949a341_59_summer_low_socks.png" },
      { variant: "socks", name: "Socks · Summer Crew 3-Pack", sub: "Cool & dry", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d8725e5f4_60_summer_crew_socks.png" },
      { variant: "socks", name: "Socks · Winter Crew 3-Pack", sub: "Thermal", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/4ff359b26_61_winter_socks.png" },
    ],
  },
  {
    title: "Safety & Light Protection",
    items: [
      { variant: "glasses", name: "Safety Glasses", sub: "Impact-rated", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/072c6d23f_62_safety_glasses.png" },
      { variant: "glasses", name: "Anti-Glare Glasses", sub: "Day driving", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/6d63f681f_63_anti_glare_glasses.png" },
      { variant: "glasses", name: "Night Vision Glasses", sub: "Low-light", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1c6da7bd8_64_night_vision_glasses.png" },
      { variant: "gloves", name: "UV Protection Sleeves", sub: "Sun defense", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/8b9b3f066_65_uv_sleeves.png" },
      { variant: "gloves", name: "Hand Warmers", sub: "Reusable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b4c9efb16_66_hand_warmers.png" },
    ],
  },
  {
    title: "Stay Warm & Protected",
    items: [
      { variant: "gloves", name: "Heated Gloves", sub: "Battery-powered", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d03b34415_67_heated_gloves.png" },
      { variant: "gloves", name: "Winter Work Gloves", sub: "Grip & warmth", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/5e4c63d2b_68_winter_gloves.png" },
    ],
  },
  {
    title: "Tech & Phone Accessories",
    items: [
      { variant: "phonemount", name: "Bike/Moto Phone Holder", sub: "Handlebar mount", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/678cbe816_69_bike_phone_holder.png" },
      { variant: "phonemount", name: "Magnetic Phone Mount", sub: "Dash mount", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1ef63c577_70_magnetic_phone_mount.png" },
      { variant: "pouch", name: "Waterproof Phone Pouch", sub: "Touch-through", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/9bb76fbdc_71_waterproof_phone_pouch.png" },
    ],
  },
  {
    title: "Lanyards & Keychains",
    items: [
      { variant: "keychain", name: "LOKIN Lanyard", sub: "Breakaway clasp", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7e171e13b_72_lanyard.png" },
      { variant: "keychain", name: "Retractable Keychain", sub: "Belt clip", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/fe9724d3a_73_retractable_keychain.png" },
      { variant: "keychain", name: "LOKIN Keychain", sub: "Lock mark fob", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a73e52ede_74_keychain.png" },
    ],
  },
  {
    title: "Delivery Tools & Accessories",
    items: [
      { variant: "bottle", name: "Insulated Water Bottle", sub: "24-hr cold", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/13292996b_75_insulated_bottle.png" },
      { variant: "flashlight", name: "Mini Flashlight", sub: "Pocket beam", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d78340285_76_mini_flashlight.png" },
      { variant: "tool", name: "Portable Tire Inflator", sub: "Roadside ready", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/dd1a4d197_77_tire_inflator.png" },
      { variant: "tool", name: "Multi-Tool Card", sub: "Wallet size", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/773a18921_78_multi_tool_card.png" },
      { variant: "keychain", name: "LOKIN Enamel Pin", sub: "Lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/001029abc_lokin-enamel-pin.jpg" },
    ],
  },
  {
    title: "Safety & Visibility",
    items: [
      { variant: "beacon", name: "LED Safety Light", sub: "Clip-on beacon", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/4a2d2b261_80_led_safety_light.png" },
      { variant: "beacon", name: "Reflective Strap", sub: "Arm/ankle band", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3a79b8c96_81_reflective_strap.png" },
      { variant: "sticker", name: "Reflective Sticker Pack", sub: "Night visibility", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/377eab561_82_reflective_stickers.png" },
    ],
  },
  {
    title: "Brand Extras",
    items: [
      { variant: "sticker", name: "LOKIN Sticker Pack", sub: "Signature lockup", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/cb056406b_83_sticker_pack.png" },
      { variant: "sticker", name: "LOKIN Car Decal", sub: "Vinyl · weatherproof", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/2510c4400_84_car_decal.png" },
      { variant: "sticker", name: "License Plate Frame", sub: "Chrome lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/5302feb22_license-plate-frame.jpg" },
    ],
  },
  {
    title: "Delivery Hardware",
    items: [
      { variant: "delivery", name: "Insulated Rolling Delivery Bag", sub: "16\"L × 14\"W × 16\"H · Hot/cold for hours" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c4af48f69_51_bike_delivery_bag.png"},
      { variant: "delivery", name: "Foldable Wagon / Cart", sub: "36\"L × 24\"W × 20\"H · 200+ lb" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b5599d082_foldable-wagon.jpg"},
      { variant: "delivery", name: "Stair Climber Hand Truck", sub: "20\"W × 16\"D × 52\"H · Tri-wheel assist" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d0a291a58_stair-climber.jpg"},
      { variant: "delivery", name: "Package Rolling Tote", sub: "22\"H × 14\"W × 12\"D · Route-ready" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e8ecb9bf2_38_tote_medium.png"},
      { variant: "delivery", name: "Foldable Package Delivery Cart", sub: "36\"L × 24\"W × 20\"H · 200+ lb" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/37ebf4a6b_26_delivery_bag.png"},
      { variant: "delivery", name: "Trunk / Rear Seat Organizer", sub: "36\"L × 16\"W × 10\"H · Anti-slip" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/5afca44ed_09_neck_gaiter.png"},
      { variant: "delivery", name: "Car Dividing Tray", sub: "36\"L × 34\"W × 10\"H · Modular" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/970b6af99_car-dividing-tray.jpg"},
    ],
  },
];

function matchesItem(it, words) {
  const hay = `${it.name} ${it.sub}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export default function GearShowcase() {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const visible = words.length
    ? SECTIONS.map((s) => ({ ...s, items: s.items.filter((it) => matchesItem(it, words)) })).filter((s) => s.items.length > 0)
    : SECTIONS;
  const shown = visible.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[11px] tracking-[0.24em] text-white/40 font-display">THE COLLECTION · LOKIN GEAR</div>
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/35">{total} ITEMS</span>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" style={{ width: 16, height: 16 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the catalog…"
          className="w-full rounded-2xl border border-white/10 bg-black/40 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50"
        />
      </div>
      {words.length > 0 && (
        <div className="text-[11px] text-white/40 mb-3">
          {shown} of {total} items
        </div>
      )}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 lokin-panel p-6 text-center text-sm text-white/50">
          No gear matches &ldquo;{query}&rdquo;. Try another word.
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((s) => (
            <div key={s.title}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm font-bold text-white">{s.title}</div>
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[10px] text-white/35">{s.items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {s.items.map((it) => (
                  <div
                    key={it.name + it.sub}
                    className="rounded-2xl border border-white/10 lokin-panel p-2.5 active:scale-[0.98] active:border-primary/40 transition-all"
                  >
                    <div className="rounded-xl bg-black/40 border border-white/5 overflow-hidden">
                      {it.thumb ? (
                        <img src={it.thumb} alt={it.name} className="w-full aspect-square object-cover" loading="lazy" />
                      ) : (
                        <ApparelMockup variant={it.variant} />
                      )}
                    </div>
                    <div className="px-1 pt-2">
                      {it.badge && (
                        <span className="inline-block bg-primary text-black text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                          {it.badge}
                        </span>
                      )}
                      <div className="text-sm font-semibold text-white truncate leading-tight">{it.name}</div>
                      <div className="text-[11px] text-white/45">{it.sub}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm font-bold text-primary">
                          {it.price ? `$${it.price}` : <span className="text-white/25 text-[11px] font-normal">Price soon</span>}
                        </div>
                        <button
                          className="bg-primary text-black text-xs font-bold px-3.5 py-1.5 rounded-full active:scale-95 transition-transform"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
