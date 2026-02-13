// js/catalog.js
// Catalog + Cart + Sticky Summary (clean version)

let _products = [];
let _cart = {};
let _lastRenderOpts = { showPrices: false };

/* =========================
   Helpers
========================= */

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function formatMoney(v) {
  return round2(v).toLocaleString("ro-RO") + " lei";
}

function getItemCount() {
  return Object.values(_cart).reduce((sum, i) => sum + i.qty, 0);
}

function getCartItemsArray() {
  return Object.values(_cart);
}

function getCartTotal() {
  return round2(
    getCartItemsArray().reduce((sum, i) => sum + i.lineTotal, 0)
  );
}

/* =========================
   Load Products
========================= */

export async function loadProducts(db) {
  const { collection, getDocs, query, where } =
    await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

  const snap = await getDocs(
    query(collection(db, "products"), where("active", "==", true))
  );

  _products = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  return _products;
}

/* =========================
   Render Products
========================= */

export function renderProducts(gridEl, items, opts = {}) {
  _lastRenderOpts = opts;
  gridEl.innerHTML = "";

  items.forEach(p => {
    const price = Number(p.priceGross || p.price || 0);

    const card = document.createElement("div");
    card.className = "product-card";
    card.style.border = "1px solid rgba(255,255,255,0.1)";
    card.style.padding = "14px";
    card.style.borderRadius = "14px";

    card.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;">${p.name}</div>
      ${opts.showPrices ? `<div style="opacity:.8;margin-bottom:10px;">Preț: ${formatMoney(price)}</div>` : ""}
      <div style="display:flex;gap:8px;align-items:center;">
        <button data-minus>-</button>
        <input value="0" style="width:40px;text-align:center;" readonly />
        <button data-plus>+</button>
        <button data-add style="margin-left:auto;">Adaugă</button>
      </div>
    `;

    const input = card.querySelector("input");

    card.querySelector("[data-plus]").onclick = () => {
      input.value = Number(input.value) + 1;
    };

    card.querySelector("[data-minus]").onclick = () => {
      input.value = Math.max(0, Number(input.value) - 1);
    };

    card.querySelector("[data-add]").onclick = () => {
      const qty = Number(input.value);
      if (qty <= 0) return;

      const lineTotal = round2(price * qty);

      _cart[p.id] = {
        productId: p.id,
        name: p.name,
        qty,
        unitPriceFinal: price,
        lineTotal
      };

      input.value = 0;
      updateStickyBar();
    };

    gridEl.appendChild(card);
  });

  ensureStickyBar();
}

/* =========================
   Sticky Bar
========================= */

function ensureStickyBar() {
  if (document.getElementById("stickyCartBar")) return;

  const bar = document.createElement("div");
  bar.id = "stickyCartBar";

  bar.style.position = "fixed";
  bar.style.bottom = "12px";
  bar.style.left = "12px";
  bar.style.right = "12px";
  bar.style.background = "rgba(15,20,25,.95)";
  bar.style.border = "1px solid rgba(255,255,255,.15)";
  bar.style.borderRadius = "16px";
  bar.style.padding = "14px";
  bar.style.zIndex = "9999";

  bar.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div id="cartCount"></div>
        <div id="cartTotal" style="font-weight:700;"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <button id="btnToggleSummary">Detalii</button>
        <button id="btnSubmitOrder">Trimite comanda</button>
      </div>
    </div>
    <div id="cartSummaryWrap" style="display:none;margin-top:10px;"></div>
  `;

  document.body.appendChild(bar);

  bar.querySelector("#btnToggleSummary").onclick = () => {
    const wrap = bar.querySelector("#cartSummaryWrap");
    wrap.style.display = wrap.style.display === "none" ? "block" : "none";
    renderSummary();
  };

  bar.querySelector("#btnSubmitOrder").onclick = () => {
    const items = getCartItemsArray();

    if (!items.length) {
      alert("Coș gol.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("catalog:submitOrderRequested", {
        detail: { items }
      })
    );
  };

  updateStickyBar();
}

function renderSummary() {
  const wrap = document.getElementById("cartSummaryWrap");
  wrap.innerHTML = "";

  getCartItemsArray().forEach(i => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.marginBottom = "6px";
    row.innerHTML = `
      <div>${i.name} x ${i.qty}</div>
      <div>${formatMoney(i.lineTotal)}</div>
    `;
    wrap.appendChild(row);
  });
}

function updateStickyBar() {
  const countEl = document.getElementById("cartCount");
  const totalEl = document.getElementById("cartTotal");

  if (!countEl) return;

  const count = getItemCount();
  const total = getCartTotal();

  countEl.textContent = `${count} produse`;
  totalEl.textContent = formatMoney(total);
}
