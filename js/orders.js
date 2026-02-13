// js/orders.js
// Submit order with full client snapshot + product snapshot

import { auth, db } from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ==============================
   Helpers
================================ */

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/* ==============================
   Main submitOrder
================================ */

export async function submitOrder({ clientId }) {
  if (!clientId) throw new Error("clientId lipsă.");

  const user = auth.currentUser;
  if (!user) throw new Error("Trebuie să fii logat.");

  /* ==========================
     1️⃣ Luăm datele clientului
  ========================== */

  const userRef = doc(db, "users", clientId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("Document client inexistent.");
  }

  const userData = userSnap.data() || {};
  const contact = userData.contact || {};

  const clientSnapshot = {
    uid: clientId,
    email: userData.email || "",
    phone: userData.phone || "",
    fullName: contact.fullName || "",
    county: contact.county || "",
    city: contact.city || "",
    address: contact.address || "",
    clientType: userData.clientType || "",
    channel: userData.channel || ""
  };

  /* ==========================
     2️⃣ Luăm coșul din localStorage
  ========================== */

  const rawCart = JSON.parse(localStorage.getItem("cart") || "[]");

  if (!Array.isArray(rawCart) || rawCart.length === 0) {
    throw new Error("Coș gol.");
  }

  /* ==========================
     3️⃣ Construim snapshot produse
  ========================== */

  const items = rawCart.map((item) => {
    const qty = Number(item.qty || 0);
    const unitPriceFinal = round2(item.unitPriceFinal || item.priceFinal || 0);
    const lineTotal = round2(unitPriceFinal * qty);

    return {
      productId: item.productId || item.id,
      name: item.name || "",
      qty,
      unitPriceFinal,
      lineTotal
    };
  });

  const total = round2(
    items.reduce((sum, i) => sum + i.lineTotal, 0)
  );

  /* ==========================
     4️⃣ Generare număr comandă
  ========================== */

  const counterRef = doc(db, "counters", "orders");

  const result = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);

    let nextNumber = 1000;

    if (counterSnap.exists()) {
      const current = counterSnap.data().lastNumber || 1000;
      nextNumber = current + 1;
    }

    transaction.set(counterRef, {
      lastNumber: nextNumber
    }, { merge: true });

    const orderRef = doc(collection(db, "orders"));

    const payload = {
      orderNumber: nextNumber,
      clientId,
      clientSnapshot,
      items,
      total,
      status: "NEW",
      statusHistory: [
        {
          status: "NEW",
          at: Timestamp.now(),   // 🔥 IMPORTANT: NU serverTimestamp
          adminUid: null
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(orderRef, payload);

    return {
      orderNumber: nextNumber
    };
  });

  /* ==========================
     5️⃣ Reset cart
  ========================== */

  localStorage.removeItem("cart");

  return result;
}
