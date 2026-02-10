import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * Citește produsele active din Firestore:
 * collection: products
 * fields: name (string), description (string), price (number), image (string optional), active (bool)
 */
export async function loadProducts() {
  const q = query(
    collection(db, "products"),
    where("active", "==", true),
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      name: data.name || "",
      description: data.description || "",
      price: Number(data.price ?? 0),
      image: data.image || "" // optional
    };
  });
}

/**
 * Randează produsele în UI.
 * canSeePrices: dacă user.status === "active"
 * canOrder: (v1) îl lăsăm false până facem coș / comenzi
 */
export function renderProducts(container, items, { showPrices } = {}) {
  const canSeePrices = !!showPrices;
  const canOrder = false; // pasul următor (coș + comenzi)

  container.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = `
      <div class="note">
        Nu există produse active încă în Firestore.
      </div>
    `;
    return;
  }

  for (const p of items) {
    const card = document.createElement("div");
    card.className = "product";

    const imgHtml = p.image
      ? `<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" />`
      : `<div class="pimg ph"></div>`;

    const priceHtml = canSeePrices
      ? `<div class="pprice">Preț: <strong>${formatMoney(p.price)} lei</strong></div>`
      : `<div class="pprice muted">Prețuri vizibile doar pentru clienți activi</div>`;

    const orderHtml = canOrder
      ? `<button class="btn primary" style="margin-top:10px;width:100%;">Adaugă</button>`
      : `<button class="btn" style="margin-top:10px;width:100%;" disabled>Comandă (în curând)</button>`;

    card.innerHTML = `
      ${imgHtml}
      <div class="pbody">
        <div class="pname">${escapeHtml(p.name)}</div>
        <div class="pdesc">${escapeHtml(p.description)}</div>
        ${priceHtml}
        ${orderHtml}
      </div>
    `;

    container.appendChild(card);
  }
}

/* ---------------- helpers ---------------- */

function formatMoney(n) {
  const v = Number.isFinite(n) ? n : 0;
  return String(Math.round(v));
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
