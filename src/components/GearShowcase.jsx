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
      { variant: "hoodie", name: "AI Pullover Hoodie", sub: "Signature lockup", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b82656a69_ai-pullover-hoodie.jpg" },
      { variant: "hoodie", name: "AI Tech Jacket", sub: "Driver tech shell", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/42d80852c_ai-tech-jacket.jpg" },
      { variant: "tee", name: "Sleeve Detail Tee", sub: "Long sleeve", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/bee6a5aee_sleeve-detail-tee.jpg" },
      { variant: "cap", name: "LOKIN Bucket Hat", sub: "Embroidered lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f585828ef_lokin-bucket-hat.jpg" },
      { variant: "tee", name: "Long Sleeve Tee", sub: "Signature lockup", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/61bcd0077_long-sleeve-tee.jpg" },
    ],
  },
  {
    title: "Driver Collection",
    items: [
      { variant: "hoodie", name: "Driver Hoodie", sub: "Hi-vis trim", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ae443bd91_driver-hoodie.jpg" },
      { variant: "tee", name: "Driver Polo", sub: "Reflective logo", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f1b9ba38a_driver-polo.jpg" },
      { variant: "hoodie", name: "Reflective Driver Jacket", sub: "Night visibility", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c3908770b_reflective-driver-jacket.jpg" },
      { variant: "tee", name: "Hi-Vis Driver Vest", sub: "ANSI-style panels", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e5921244c_hi-vis-driver-vest.jpg" },
    ],
  },
  {
    title: "Bottoms & Headwear",
    items: [
      { variant: "joggers", name: "Driver Joggers", sub: "Athletic fit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b99b47fac_driver-joggers.jpg" },
      { variant: "cap", name: "LOKIN Snapback", sub: "Embroidered lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/61ac3a7bb_lokin-snapback.jpg" },
      { variant: "beanie", name: "Driver Beanie", sub: "Thermal knit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d6b38bc11_driver-beanie.jpg" },
    ],
  },
  {
    title: "Rain Gear Collection",
    items: [
      { variant: "raincoat", name: "Rain Jacket", sub: "Waterproof shell", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/9ab1b935f_rain-jacket.jpg" },
      { variant: "raincoat", name: "Long Rain Coat", sub: "Full coverage", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ca5f02887_long-rain-coat.jpg" },
      { variant: "raincoat", name: "Driver Poncho", sub: "Packable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/365ca42a2_driver-poncho.jpg" },
      { variant: "raincoat", name: "Packable Rain Jacket", sub: "Packs to pouch", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/95967bcc7_packable-rain-jacket.jpg" },
    ],
  },
  {
    title: "Winter Headgear",
    items: [
      { variant: "hoodie", name: "Thermal Hoodie", sub: "Fleece-lined", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3f48eccd7_thermal-hoodie.jpg" },
      { variant: "shiesty", name: "Ski Mask", sub: "Full-face thermal", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/8647afa83_ski-mask.jpg" },
      { variant: "shiesty", name: "LOKIN Balaclava", sub: "Fleece · One size", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e8d486df6_lokin-balaclava.jpg" },
      { variant: "shiesty", name: "Neck Gaiter", sub: "Fleece tube", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7649efe34_neck-gaiter.jpg" },
      { variant: "beanie", name: "Winter Beanie", sub: "Thermal knit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c656ad603_winter-beanie.jpg" },
    ],
  },
  {
    title: "Winter Outerwear",
    items: [
      { variant: "hoodie", name: "Insulated Winter Coat", sub: "Heavy fill", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/23206680e_insulated-winter-coat.jpg" },
      { variant: "hoodie", name: "Driver Puffer Jacket", sub: "Packable warmth", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/cd7f9d33e_driver-puffer-jacket.jpg" },
    ],
  },
  {
    title: "Glow in the Dark",
    items: [
      { variant: "hoodie", name: "Glow Hoodie", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b4603e96b_glow-hoodie.jpg" },
      { variant: "tee", name: "Glow Tee", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/0c4988683_glow-tee.jpg" },
      { variant: "hoodie", name: "Glow Jacket", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3c2145b87_glow-jacket.jpg" },
      { variant: "hoodie", name: "Glow Sweatshirt", sub: "Glow-in-the-dark print", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/942000531_glow-sweatshirt.jpg" },
    ],
  },
  {
    title: "Pizza Bags — Insulated",
    items: [
      { variant: "pizza", name: "Pizza Bag · Small", sub: "18\" · 1-pie" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/13d6366d6_pizza-bag-small.jpg"},
      { variant: "pizza", name: "Pizza Bag · Medium", sub: "20\" · 2-pie" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/fcd6b80a8_pizza-bag-medium.jpg"},
      { variant: "pizza", name: "Pizza Bag · Large", sub: "24\" · 3-pie" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c3d41b873_pizza-bag-large.jpg"},
      { variant: "pizza", name: "Pizza Bag · XL", sub: "Multi-pie", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/21acc3340_pizza-bag-xl.jpg" },
      { variant: "pizza", name: "Pizza Bag · XXL", sub: "Catering size", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/1e86a01cd_pizza-bag-xxl.jpg" },
    ],
  },
  {
    title: "Catering Bags — Insulated",
    items: [
      { variant: "catering", name: "Catering Bag · Compact", sub: "13\" × 10\" × 9\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a717fa91c_catering-bag-compact.jpg"},
      { variant: "catering", name: "Catering Bag · Medium", sub: "18\" × 14\" × 12\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/2734f3c92_catering-bag-medium.jpg"},
      { variant: "catering", name: "Catering Bag · Large", sub: "22\" × 16\" × 13\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/09424e05f_catering-bag-large.jpg"},
      { variant: "catering", name: "Catering Bag · XL", sub: "26\" × 18\" × 14\"" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f1bb82993_catering-bag-xl.jpg"},
    ],
  },
  {
    title: "Tote Bags — Delivery",
    items: [
      { variant: "tote", name: "LOKIN Tote · Small", sub: "Everyday carry", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a2f9d8385_lokin-tote-small.jpg" },
      { variant: "tote", name: "LOKIN Tote · Medium", sub: "Grocery runs", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/341468d3c_lokin-tote-medium.jpg" },
      { variant: "tote", name: "LOKIN Tote · Large", sub: "Bulk hauls", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/de4b1a9fb_lokin-tote-large.jpg" },
    ],
  },
  {
    title: "Drink Cup Holders",
    items: [
      { variant: "cupholder", name: "Cup Carrier · 2-Cup", sub: "Spill-proof slots", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/852f299be_cup-carrier-2.jpg" },
      { variant: "cupholder", name: "Cup Carrier · 4-Cup", sub: "Spill-proof slots", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/4e2032f30_cup-carrier-4.jpg" },
      { variant: "cupholder", name: "Cup Carrier · 6-Cup", sub: "Spill-proof slots", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/397c9951b_cup-carrier-6.jpg" },
    ],
  },
  {
    title: "Food Warming & Transport",
    items: [
      { variant: "delivery", name: "Insulated Food Blanket", sub: "Hot/cold hold", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/38d47f9aa_insulated-food-blanket.jpg" },
      { variant: "delivery", name: "Insulated Bag Cover", sub: "Extra layer", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/06d5329ee_insulated-bag-cover.jpg" },
      { variant: "delivery", name: "Hot/Cold Gel Pack", sub: "Reusable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d3b1d995e_hot-cold-gel-pack.jpg" },
      { variant: "delivery", name: "Thermal Foil Liner", sub: "Heat reflector", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/59e00e8ac_thermal-foil-liner.jpg" },
    ],
  },
  {
    title: "Bags & Carry Gear",
    items: [
      { variant: "tote", name: "Shoulder Delivery Bag", sub: "Padded strap", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7bfc23a6b_shoulder-delivery-bag.jpg" },
      { variant: "pouch", name: "Driver Fanny Pack", sub: "Quick access", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b58ebc9f2_driver-fanny-pack.jpg" },
      { variant: "pouch", name: "Chest Bag", sub: "Ride-ready", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/882d489b3_chest-bag.jpg" },
      { variant: "pouch", name: "Crossbody Bag", sub: "Secure fit", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/8105b1019_crossbody-bag.jpg" },
    ],
  },
  {
    title: "Bike Delivery Gear",
    items: [
      { variant: "delivery", name: "Bike Delivery Bag", sub: "Frame-mount ready", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/29c6b845d_bike-delivery-bag.jpg" },
      { variant: "delivery", name: "Handlebar Bag", sub: "Quick access", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d77cd6bc7_handlebar-bag.jpg" },
      { variant: "delivery", name: "Pannier Bags · Pair", sub: "Rack-mount", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c48098674_pannier-bags.jpg" },
    ],
  },
  {
    title: "Comfort on the Go",
    items: [
      { variant: "pillow", name: "Travel Pillow", sub: "Memory foam", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ae0a51147_travel-pillow.jpg" },
      { variant: "pillow", name: "Neck Pillow", sub: "Memory foam", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/9f95e9471_neck-pillow.jpg" },
    ],
  },
  {
    title: "Comfort Seat & Support",
    items: [
      { variant: "seatcushion", name: "Driver Seat Cushion", sub: "Mesh · breathable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ae6b15364_driver-seat-cushion.jpg" },
      { variant: "seatcushion", name: "Lumbar Support Cushion", sub: "Driver back support", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/7ad49a8ba_lumbar-support.jpg" },
      { variant: "massagecover", name: "Massage Seat Cover", sub: "Vibration nodes", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a02f8e4b8_massage-seat-cover.jpg" },
    ],
  },
  {
    title: "Moisture-Wicking Socks",
    items: [
      { variant: "socks", name: "Socks · Summer Low-Cut 3-Pack", sub: "Cool & dry", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/9edbc8adf_socks-summer-low.jpg" },
      { variant: "socks", name: "Socks · Summer Crew 3-Pack", sub: "Cool & dry", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/66083325d_socks-summer-crew.jpg" },
      { variant: "socks", name: "Socks · Winter Crew 3-Pack", sub: "Thermal", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c8fcfb4ba_socks-winter-crew.jpg" },
    ],
  },
  {
    title: "Safety & Light Protection",
    items: [
      { variant: "glasses", name: "Safety Glasses", sub: "Impact-rated", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b5124a790_safety-glasses.jpg" },
      { variant: "glasses", name: "Anti-Glare Glasses", sub: "Day driving", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/fc1b1932f_anti-glare-glasses.jpg" },
      { variant: "glasses", name: "Night Vision Glasses", sub: "Low-light", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/858ded620_night-vision-glasses.jpg" },
      { variant: "gloves", name: "UV Protection Sleeves", sub: "Sun defense", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/eeec2135a_uv-sleeves.jpg" },
      { variant: "gloves", name: "Hand Warmers", sub: "Reusable", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/99eb1fc61_hand-warmers.jpg" },
    ],
  },
  {
    title: "Stay Warm & Protected",
    items: [
      { variant: "gloves", name: "Heated Gloves", sub: "Battery-powered", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/f5912a0f4_heated-gloves.jpg" },
      { variant: "gloves", name: "Winter Work Gloves", sub: "Grip & warmth", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/ef667a21d_winter-work-gloves.jpg" },
    ],
  },
  {
    title: "Tech & Phone Accessories",
    items: [
      { variant: "phonemount", name: "Bike/Moto Phone Holder", sub: "Handlebar mount", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/579be2f07_bike-phone-holder.jpg" },
      { variant: "phonemount", name: "Magnetic Phone Mount", sub: "Dash mount", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/fcacd2e8c_magnetic-phone-mount.jpg" },
      { variant: "pouch", name: "Waterproof Phone Pouch", sub: "Touch-through", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/5b58fac7e_waterproof-phone-pouch.jpg" },
    ],
  },
  {
    title: "Lanyards & Keychains",
    items: [
      { variant: "keychain", name: "LOKIN Lanyard", sub: "Breakaway clasp", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/0c3f86167_lokin-lanyard.jpg" },
      { variant: "keychain", name: "Retractable Keychain", sub: "Belt clip", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/c6fca1313_retractable-keychain.jpg" },
      { variant: "keychain", name: "LOKIN Keychain", sub: "Lock mark fob", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/2ca35c4a6_lokin-keychain.jpg" },
    ],
  },
  {
    title: "Delivery Tools & Accessories",
    items: [
      { variant: "bottle", name: "Insulated Water Bottle", sub: "24-hr cold", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b2b33ffd4_insulated-water-bottle.jpg" },
      { variant: "flashlight", name: "Mini Flashlight", sub: "Pocket beam", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/80d0423d2_mini-flashlight.jpg" },
      { variant: "tool", name: "Portable Tire Inflator", sub: "Roadside ready", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/144933988_tire-inflator.jpg" },
      { variant: "tool", name: "Multi-Tool Card", sub: "Wallet size", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/3070bbefb_multi-tool-card.jpg" },
      { variant: "keychain", name: "LOKIN Enamel Pin", sub: "Lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/001029abc_lokin-enamel-pin.jpg" },
    ],
  },
  {
    title: "Safety & Visibility",
    items: [
      { variant: "beacon", name: "LED Safety Light", sub: "Clip-on beacon", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/0c3a5fc8b_led-safety-light.jpg" },
      { variant: "beacon", name: "Reflective Strap", sub: "Arm/ankle band", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/807c20235_reflective-strap.jpg" },
      { variant: "sticker", name: "Reflective Sticker Pack", sub: "Night visibility", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/baec00628_reflective-stickers.jpg" },
    ],
  },
  {
    title: "Brand Extras",
    items: [
      { variant: "sticker", name: "LOKIN Sticker Pack", sub: "Signature lockup", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/244f4bf5a_lokin-sticker-pack.jpg" },
      { variant: "sticker", name: "LOKIN Car Decal", sub: "Vinyl · weatherproof", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/79c624fed_lokin-car-decal.jpg" },
      { variant: "sticker", name: "License Plate Frame", sub: "Chrome lock mark", thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/5302feb22_license-plate-frame.jpg" },
    ],
  },
  {
    title: "Delivery Hardware",
    items: [
      { variant: "delivery", name: "Insulated Rolling Delivery Bag", sub: "16\"L × 14\"W × 16\"H · Hot/cold for hours" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/e797f3c01_rolling-delivery-bag.jpg"},
      { variant: "delivery", name: "Foldable Wagon / Cart", sub: "36\"L × 24\"W × 20\"H · 200+ lb" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/b5599d082_foldable-wagon.jpg"},
      { variant: "delivery", name: "Stair Climber Hand Truck", sub: "20\"W × 16\"D × 52\"H · Tri-wheel assist" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/d0a291a58_stair-climber.jpg"},
      { variant: "delivery", name: "Package Rolling Tote", sub: "22\"H × 14\"W × 12\"D · Route-ready" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/a89307b0c_rolling-tote.jpg"},
      { variant: "delivery", name: "Foldable Package Delivery Cart", sub: "36\"L × 24\"W × 20\"H · 200+ lb" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/8c48363ea_delivery-cart.jpg"},
      { variant: "delivery", name: "Trunk / Rear Seat Organizer", sub: "36\"L × 16\"W × 10\"H · Anti-slip" , thumb: "https://base44.app/api/apps/6a7a1c830b6bae64604c3139/files/mp/public/6a7a1c830b6bae64604c3139/13aac4127_trunk-organizer.jpg"},
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
