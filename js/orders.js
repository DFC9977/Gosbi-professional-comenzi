// js/orders.js
// Handles order creation (no confirmation step)

import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";
import { getItemsArray, clearCart } from "./cart.js";

/* ==============================
   Counter (atomic)
============================== */

async function getNextOrderNumber() {
  const counterRef = doc(db, "counters", "orders");

  const nextNumber = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);

    if (!snap.exists()) {
      transaction.set(counterRef, { current: 1000 });
      return 1000;
    }

    const current = Number(snap.data().current || 1000);
    const next = current + 1;

    transaction.update(counterRef, { current: next });

    return next;
  });

  return nextNumber;
}

/* ==============================
   Build Order Snapshot
============================== */

function buildOrderItems(productsById) {
  const cartItems = getItemsArray();

  if (!cartItems.length) {
    throw new Error("Cart is empty");
  }

  const items = [];
  let total = 0;

  for (const ci of cartItems) {
    const product = productsById?.[ci.productId];
    if (!product) continue;

    const unitPriceFinal = Number(product.priceFinal ?? product.price ?? 0);
    const qty = Number(ci.qty || 0);
    const lineTotal = Math.round(unitPriceFinal * qty * 100) / 100;

    total += lineTotal;

    items.push({
      productId: ci.productId,
      name: product.name || "",
      qty,
      unitPriceFinal,
      lineTotal
    });
  }

  total = Math.round(total * 100) / 100;

  return { items, total };
}

/* ==============================
   Public: submitOrder
============================== */

export async function submitOrder({ clientId, clientName }) {
  if (!clientId) throw new Error("Missing clientId");

  // Use final prices already computed in catalog
  const productsById = window.__PRODUCTS_BY_ID__ || {};

  const { items, total } = buildOrderItems(productsById);

  if (!items.length) {
    throw new Error("No valid items in cart");
  }

  const orderNumber = await getNextOrderNumber();

  const orderRef = doc(collection(db, "orders"));

  const orderPayload = {
    orderNumber,
    clientId,
    clientName: clientName || "",
    items,
    total,
    status: "NEW",
    statusHistory: [
      {
        status: "NEW",
        at: new Date().toISOString(),
        adminUid: null
      }
    ],
    createdAt: serverTimestamp()
  };

  await setDoc(orderRef, orderPayload);

  // Reset cart immediately (no confirmation)
  clearCart();

  return {
    orderId: orderRef.id,
    orderNumber,
    total
  };
}
