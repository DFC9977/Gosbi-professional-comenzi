// /js/cart.js

const STORAGE_KEY = "gosbi_cart_v1";

/* =========================
   Internal Helpers
========================= */

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function persist(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
}

function emptyCart() {
  return {
    items: {} // { productId: qty }
  };
}

/* =========================
   Public API
========================= */

export function getCart() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyCart();

  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return emptyCart();
  if (!parsed.items || typeof parsed.items !== "object") return emptyCart();

  return parsed;
}

export function setQuantity(productId, qty) {
  const cart = getCart();
  const quantity = Math.max(0, Number(qty) || 0);

  if (quantity === 0) {
    delete cart.items[productId];
  } else {
    cart.items[productId] = quantity;
  }

  persist(cart);
  return cart;
}

export function increment(productId, step = 1) {
  const cart = getCart();
  const current = Number(cart.items[productId] || 0);
  const next = Math.max(0, current + Number(step));

  if (next === 0) {
    delete cart.items[productId];
  } else {
    cart.items[productId] = next;
  }

  persist(cart);
  return cart;
}

export function removeItem(productId) {
  const cart = getCart();
  delete cart.items[productId];
  persist(cart);
  return cart;
}

export function clearCart() {
  const cart = emptyCart();
  persist(cart);
  return cart;
}

export function getItemsArray() {
  const cart = getCart();

  return Object.entries(cart.items).map(([productId, qty]) => ({
    productId,
    qty: Number(qty)
  }));
}

export function getTotal(productsById) {
  const items = getItemsArray();

  let total = 0;

  for (const item of items) {
    const product = productsById[item.productId];
    if (!product) continue;

    const price = Number(product.priceBase || 0);
    total += price * item.qty;
  }

  return Math.round(total * 100) / 100;
}

export function getItemCount() {
  const items = getItemsArray();
  return items.reduce((sum, item) => sum + item.qty, 0);
}
