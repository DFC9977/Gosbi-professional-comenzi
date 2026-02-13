// js/orders.js
// Create order with atomic counter + snapshot of items (priceFinal, qty, subtotals)

import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";
import { getItemsArray, clearCart } from "./cart.js";

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildSnapshotItems(productsFinalById) {
  const cartItems = getItemsArray().filter((x) => asNumber(x.qty) > 0);

  if (!cartItems.length) {
    const err = new Error("Cart is empty");
    err.code = "CART_EMPTY";
    throw err;
  }

  const items = [];
  let total = 0;

  for (const ci of cartItems) {
    const p = productsFinalById?.[ci.productId];
    if (!p) continue;

    const qty = asNumber(ci.qty);
    const unitPriceFinal = asNumber(p.priceFinal ?? p.priceBase ?? p.priceGross ?? p.price ?? 0);
    const lineTotal = Math.round(unitPriceFinal * qty * 100) / 100;

    total += lineTotal;

    items.push({
      productId: String(ci.productId),
      name: String(p.name || ""),
      qty,
      unitPriceFinal,
      lineTotal
    });
  }

  total = Math.round(total * 100) / 100;

  if (!items.length) {
    const err = new Error("No valid items in cart");
    err.code = "NO_VALID_ITEMS";
    throw err;
  }

  return { items, total };
}

/**
 * submitOrder
 * - increments counters/orders.current atomically
 * - creates order document in same transaction (no gaps)
 * - clears cart on success
 */
export async function submitOrder({ clientId, clientName }) {
  if (!clientId) {
    const err = new Error("Missing clientId");
    err.code = "MISSING_CLIENT";
    throw err;
  }

  const productsFinalById =
    window.__PRODUCTS_FINAL_BY_ID__ ||
    window.__PRODUCTS_BY_ID__ ||
    {};

  const { items, total } = buildSnapshotItems(productsFinalById);

  const counterRef = doc(db, "counters", "orders");
  const orderRef = doc(collection(db, "orders"));

  const now = Timestamp.now(); // ✅ safe inside arrays/objects

  const { orderNumber } = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);

    let next = 1000;

    if (!snap.exists()) {
      tx.set(counterRef, { current: 1000 });
      next = 1000;
    } else {
      const current = asNumber(snap.data()?.current ?? 1000);
      next = current + 1;
      tx.update(counterRef, { current: next });
    }

    const payload = {
      orderNumber: next,
      clientId,
      clientName: clientName || "",

      items,
      total,

      status: "NEW",
      statusHistory: [
        {
          status: "NEW",
          at: now,        // ✅ Timestamp value, not serverTimestamp()
          adminUid: null
        }
      ],

      createdAt: serverTimestamp(), // ✅ ok at root
      updatedAt: serverTimestamp()  // ✅ ok at root
    };

    tx.set(orderRef, payload);

    return { orderNumber: next };
  });

  clearCart();

  return {
    orderId: orderRef.id,
    orderNumber,
    total
  };
}
