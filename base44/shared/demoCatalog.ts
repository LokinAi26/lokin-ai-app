// Demo / sandbox catalog data for Printify + Shopify.
// Used ONLY when the real API secret is missing, so the storefront UI renders
// sample products instead of erroring. Every demo response is flagged
// `demo: true` so the client can badge it. No real API is ever called in demo
// mode, and no invented credential is ever sent to a real provider.
//
// To switch to live data: set the real secret(s) in Settings -> Secrets:
//   Printify: PRINTIFY_API_TOKEN
//   Shopify:  SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN

const IMG = (label, bg = "0b0f14", fg = "A8FF00") =>
  `https://placehold.co/600x600/${bg}/${fg}?text=${encodeURIComponent(label)}`;

const PRINTIFY_PRODUCTS = [
  {
    id: "demo-pfy-1",
    title: "LOKIN Lock Tee (Demo)",
    visible: true,
    is_locked: false,
    blueprint_id: 71,
    print_provider_id: 1,
    description: "Sandbox sample tee. Not a real Printify product.",
    images: [{ src: IMG("LOKIN%20TEE") }],
    variants: [
      { id: "v1", title: "S / Black", sku: "DEMO-T-S", cost: 8.0, price: 24.0, is_enabled: true, options: { color: "Black", size: "S" } },
      { id: "v2", title: "M / Black", sku: "DEMO-T-M", cost: 8.0, price: 24.0, is_enabled: true, options: { color: "Black", size: "M" } },
      { id: "v3", title: "L / Black", sku: "DEMO-T-L", cost: 8.0, price: 26.0, is_enabled: true, options: { color: "Black", size: "L" } },
    ],
  },
  {
    id: "demo-pfy-2",
    title: "Lock In Hoodie (Demo)",
    visible: true,
    is_locked: false,
    blueprint_id: 71,
    print_provider_id: 1,
    description: "Sandbox sample hoodie. Not a real Printify product.",
    images: [{ src: IMG("LOCK%20IN%20HOODIE", "0b0f14", "00E5FF") }],
    variants: [
      { id: "v1", title: "M / Neon Lime", sku: "DEMO-H-M", cost: 18.0, price: 48.0, is_enabled: true, options: { color: "Neon Lime", size: "M" } },
      { id: "v2", title: "L / Neon Lime", sku: "DEMO-H-L", cost: 18.0, price: 48.0, is_enabled: true, options: { color: "Neon Lime", size: "L" } },
    ],
  },
  {
    id: "demo-pfy-3",
    title: "Vault Black Snapback (Demo)",
    visible: true,
    is_locked: false,
    blueprint_id: 71,
    print_provider_id: 1,
    description: "Sandbox sample cap. Not a real Printify product.",
    images: [{ src: IMG("VAULT%20SNAPBACK", "000000", "c8ced8") }],
    variants: [
      { id: "v1", title: "One Size", sku: "DEMO-C-OS", cost: 6.5, price: 28.0, is_enabled: true, options: { size: "One Size" } },
    ],
  },
];

function pfyCatalog() {
  return PRINTIFY_PRODUCTS.map((p) => {
    const prices = p.variants.map((v) => Number(v.price)).filter((n) => !isNaN(n));
    return {
      id: p.id,
      title: p.title,
      thumbnail_url: p.images?.[0]?.src,
      visible: p.visible,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, price: v.price, is_enabled: v.is_enabled })),
      min_price: prices.length ? Math.min(...prices).toFixed(2) : null,
      max_price: prices.length ? Math.max(...prices).toFixed(2) : null,
      currency: "USD",
    };
  });
}

export function printifyDemo(action, payload) {
  switch (action) {
    case "shops":
      return {
        shops: [
          { id: "demo-shop", title: "LOKIN Demo Shop (sandbox)", sales_channel: "demo", currency: "USD", state: "connected" },
        ],
        demo: true,
      };
    case "products":
      return {
        products: PRINTIFY_PRODUCTS.map((p) => ({
          id: p.id,
          title: p.title,
          visible: p.visible,
          is_locked: p.is_locked,
          image: p.images?.[0]?.src,
          variants_count: p.variants.length,
        })),
        page: 1,
        demo: true,
      };
    case "product": {
      const p = PRINTIFY_PRODUCTS.find((x) => String(x.id) === String(payload.id)) || PRINTIFY_PRODUCTS[0];
      return {
        product: {
          id: p.id,
          title: p.title,
          description: p.description,
          blueprint_id: p.blueprint_id,
          print_provider_id: p.print_provider_id,
          visible: p.visible,
          images: p.images,
          variants: p.variants.map((v) => ({
            id: v.id, title: v.title, sku: v.sku, cost: v.cost, price: v.price, is_enabled: v.is_enabled, options: v.options,
          })),
        },
        demo: true,
      };
    }
    case "catalog":
      return { products: pfyCatalog(), shopId: "demo-shop", count: pfyCatalog().length, demo: true };
    case "orders":
      return { orders: [], page: 1, demo: true };
    case "order":
      return { error: "Order detail is not available in demo mode.", demo: true };
    case "createProduct":
      return { product: { id: "demo-pfy-new", title: payload.product?.title || "Demo Product" }, demo: true };
    default:
      return { error: "Unsupported action in demo mode.", demo: true };
  }
}

const SHOPIFY_PRODUCTS = [
  {
    id: "demo-sho-1",
    title: "LOKIN Lock Tee (Demo)",
    status: "active",
    vendor: "LOKIN AI",
    product_type: "Apparel",
    body_html: "<p>Sandbox sample tee. Not a real Shopify product.</p>",
    image: { src: IMG("LOKIN%20TEE") },
    variants: [
      { id: "v1", title: "S / Black", sku: "DEMO-T-S", price: "24.00", compare_at_price: null, inventory_quantity: 12, option1: "S", option2: "Black" },
      { id: "v2", title: "M / Black", sku: "DEMO-T-M", price: "24.00", compare_at_price: null, inventory_quantity: 8, option1: "M", option2: "Black" },
      { id: "v3", title: "L / Black", sku: "DEMO-T-L", price: "26.00", compare_at_price: null, inventory_quantity: 5, option1: "L", option2: "Black" },
    ],
  },
  {
    id: "demo-sho-2",
    title: "Lock In Hoodie (Demo)",
    status: "active",
    vendor: "LOKIN AI",
    product_type: "Apparel",
    body_html: "<p>Sandbox sample hoodie. Not a real Shopify product.</p>",
    image: { src: IMG("LOCK%20IN%20HOODIE", "0b0f14", "00E5FF") },
    variants: [
      { id: "v1", title: "M / Neon Lime", sku: "DEMO-H-M", price: "48.00", compare_at_price: "55.00", inventory_quantity: 6, option1: "M", option2: "Neon Lime" },
      { id: "v2", title: "L / Neon Lime", sku: "DEMO-H-L", price: "48.00", compare_at_price: "55.00", inventory_quantity: 4, option1: "L", option2: "Neon Lime" },
    ],
  },
  {
    id: "demo-sho-3",
    title: "Vault Black Snapback (Demo)",
    status: "active",
    vendor: "LOKIN AI",
    product_type: "Accessories",
    body_html: "<p>Sandbox sample cap. Not a real Shopify product.</p>",
    image: { src: IMG("VAULT%20SNAPBACK", "000000", "c8ced8") },
    variants: [
      { id: "v1", title: "One Size", sku: "DEMO-C-OS", price: "28.00", compare_at_price: null, inventory_quantity: 20, option1: "One Size", option2: null },
    ],
  },
];

function shoVariantSummary(v) {
  return {
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compare_at_price: v.compare_at_price,
    available: v.inventory_quantity ?? null,
    option1: v.option1,
    option2: v.option2,
  };
}

function shoCatalog() {
  return SHOPIFY_PRODUCTS.map((p) => {
    const variants = p.variants.map(shoVariantSummary);
    const prices = variants.map((v) => Number(v.price)).filter((n) => !isNaN(n));
    return {
      id: p.id,
      title: p.title,
      thumbnail_url: p.image?.src,
      status: p.status,
      variants,
      min_price: prices.length ? Math.min(...prices).toFixed(2) : null,
      max_price: prices.length ? Math.max(...prices).toFixed(2) : null,
      currency: "USD",
    };
  });
}

export function shopifyDemo(action, payload) {
  switch (action) {
    case "shop":
      return {
        shop: {
          id: "demo-shop",
          name: "LOKIN Demo Store (sandbox)",
          domain: "lokin-demo.myshopify.com",
          currency: "USD",
          country: "US",
          plan: "demo",
        },
        demo: true,
      };
    case "products":
      return {
        products: SHOPIFY_PRODUCTS.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          vendor: p.vendor,
          product_type: p.product_type,
          image: p.image?.src,
          variants_count: p.variants.length,
        })),
        link: null,
        demo: true,
      };
    case "product": {
      const p = SHOPIFY_PRODUCTS.find((x) => String(x.id) === String(payload.id)) || SHOPIFY_PRODUCTS[0];
      return {
        product: {
          id: p.id,
          title: p.title,
          body_html: p.body_html,
          vendor: p.vendor,
          product_type: p.product_type,
          status: p.status,
          images: [p.image],
          variants: p.variants.map(shoVariantSummary),
        },
        demo: true,
      };
    }
    case "catalog":
      return { products: shoCatalog(), count: shoCatalog().length, demo: true };
    case "orders":
      return { orders: [], demo: true };
    case "order":
      return { error: "Order detail is not available in demo mode.", demo: true };
    case "createProduct":
      return { product: { id: "demo-sho-new", title: payload.product?.title || "Demo Product" }, demo: true };
    default:
      return { error: "Unsupported action in demo mode.", demo: true };
  }
}