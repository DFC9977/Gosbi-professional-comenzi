// js/catalog.js
// Catalog UI (mobile-first) + cart sticky bar + summary + submit event with items
// Exports: loadProducts(db), renderProducts(productsGrid, items, opts)

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  increment,
  setQuantity,
  getItemCount,
  getItemsArray
} from "./cart.js";

/* =========================
   State
========================= */

let _categoriesCache = null;
let _lastItems = [];
let _selectedCategoryId = "ALL";
let _lastRenderOpts = { showPrices: false, db: null, priceRules: null };

/* =========================
   Helpers
========================= */

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(asNumber(v) * 100) / 100;
}

function formatMoney(v) {
  return round2(v).toLocaleString("ro-RO", { maximumFractionDigits: 2 });
}

function uniq(arr) {
  return [...new Set(arr)];
}

/* =========================
   Pricing
   (Tu ai zis pricebase, dar păstrăm compatibilitatea:
    - citim priceGross/basePrice/price
    - aplicăm markup dacă există priceRules, altfel 0
========================= */

function getBaseGrossPrice(p) {
  return asNumber(p?.priceGross ?? p?.basePrice ?? p?.base_price ?? p?.price ?? 0);
}

function getMarkupForProduct(p, priceRules) {
  const catId = String(p?.categoryId || "");
  const byCat = priceRules?.categories?.[catId];
  if (byCat !== undefined && byCat !== null && byCat !== "") return asNumber(byCat);
  return asNumber(priceRules?.globalMarkup ?? 0);
}

function computeFinalPrice(p, showPrice, priceRules) {
  if (!showPrice) return null;
  const base = getBaseGrossPrice(p);
  const markup = getMarkupForProduct(p, priceRules);
  return round2(base * (1 + markup / 100));
}

/* =========================
   Categories
========================= */

async function loadCategories(db) {
  if (_categoriesCache) return _categoriesCache;

  const snap = await getDocs(
    query(
      collection(db, "categories"),
      where("active", "==", true),
      orderBy("sortOrder"),
      limit(500)
    )
  );

  const cats = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    cats.push({
      id: d.id,
      name: String(data.name || d.id),
      sortOrder: asNumber(data.sortOrder),
      active: data.active !== false
    });
  });

  _categoriesCache = cats;
  return cats;
}

function ensureCategoriesHost(productsGrid) {
  const screen = document.getElementById("screenCatalog") || document.body;

  let top = screen.querySelector("#categoriesTopBar");
  if (!top) {
    top = document.createElement("div");
    top.id = "categoriesTopBar";
    top.style.display = "flex";
    top.style.flexWrap = "wrap";
    top.style.gap = "10px";
    top.style.margin = "12px 0 16px 0";
    top.style.alignItems = "center";

    const parent = productsGrid?.parentElement || screen;
    parent.insertBefore(top, productsGrid);
  }
  return top;
}

function catChip(label, active) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.padding = "10px 12px";
  b.style.borderRadius = "14px";
  b.style.border = active ? "1px solid rgba(255,255,255,0.55)" : "1px solid rgba(255,255,255,0.18)";
  b.style.background = active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
  b.style.color = "inherit";
  b.style.cursor = "pointer";
  b.style.fontWeight = "800";
  return b;
}

async function renderCategories(productsGrid) {
  const db = _lastRenderOpts.db || window.__db || null;
  if (!db) return;

  const categories = await loadCategories(db);
  const presentCategoryIds = uniq(_lastItems.map((p) => String(p.categoryId || "")).filter(Boolean));

  const host = ensureCategoriesHost(productsGrid);
  host.innerHTML = "";

  const list = [{ id: "ALL", name: "Toate" }, ...categories.filter((c) => presentCategoryIds.includes(c.id))];

  list.forEach((c) => {
    const btn = catChip(c.name, _selectedCategoryId === c.id);
    btn.addEventListener("click", () => {
      _selectedCategoryId = c.id;
      renderProducts(productsGrid, _lastItems, _lastRenderOpts);
    });
    host.appendChild(btn);
  });
}

/* =========================
   Layout + CSS
========================= */

function ensureGridLayout(productsGrid) {
  if (!productsGrid) return;
  productsGrid.style.display = "grid";
  productsGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(260px, 1fr))";
  productsGrid.style.gap = "16px";
  productsGrid.style.alignItems = "stretch";
  productsGrid.style.width = "100%";
  productsGrid.style.boxSizing = "border-box";
}

function ensureCatalogCSSOnce() {
  if (document.getElementById("catalogCss")) return;

  const style = document.createElement("style");
  style.id = "catalogCss";
  style.textContent = `
    .product-card {
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 16px;
      padding: 14px;
      background: rgba(255,255,255,0.02);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn-soft {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.06);
      color: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .btn-ghost {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: transparent;
      color: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .qty-btn {
      width: 44px;
      height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: transparent;
      color: inherit;
      font-size: 20px;
      cursor: pointer;
    }
    .qty-input {
      width: 72px;
      height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: transparent;
      color: inherit;
      text-align: center;
      padding: 0 8px;
      font-size: 16px;
    }

    /* Sticky bar: mobile bottom, desktop top centered */
    #stickyCartBar {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      top: auto;
      transform: none;
      z-index: 9999;
      border-radius: 16px;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(15, 15, 18, 0.92);
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    @media (min-width: 900px) {
      #stickyCartBar {
        top: 16px;
        bottom: auto;
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        width: min(760px, calc(100vw - 24px));
      }
    }
  `;
  document.head.appendChild(style);
}

/* =========================
   Product Card HTML
========================= */

function productCardHTML(p) {
  const id = String(p.id || "");
  const name = String(p.name || "");
  const showPrice = !!_lastRenderOpts.showPrices;
  const finalPrice = computeFinalPrice(p, showPrice, _lastRenderOpts.priceRules);

  return `
    <div class="product-card" data-product-id="${id}">
      <div style="font-weight:900; font-size:16px; line-height:1.25;">${name}</div>
      <div style="opacity:0.9; font-size:14px;">
        ${showPrice ? `Preț: <b>${formatMoney(finalPrice)} lei</b>` : `Prețuri vizibile doar pentru clienți activi`}
      </div>

      ${
        showPrice
          ? `
          <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
            <button class="qty-btn" type="button" data-action="dec" aria-label="Scade">−</button>
            <input class="qty-input" data-role="qty" type="number" min="0" inputmode="numeric" value="0" />
            <button class="qty-btn" type="button" data-action="inc" aria-label="Crește">+</button>

            <div style="flex:1;"></div>

            <button class="btn-soft" type="button" data-action="add">Adaugă</button>
          </div>
          `
          : `
          <button class="btn-ghost" type="button" disabled style="opacity:0.6; cursor:not-allowed;">
            Comandă (indisponibil)
          </button>
          `
      }
    </div>
  `;
}

/* =========================
   Cart totals based on current rendered prices
========================= */

function buildProductsFinalById() {
  const map = {};
  _lastItems.forEach((p) => {
    const priceFinal = computeFinalPrice(p, true, _lastRenderOpts.priceRules) ?? 0;
    map[p.id] = { ...p, priceFinal };
  });

  // expose for orders.js snapshot (optional)
  window.__PRODUCTS_FINAL_BY_ID__ = map;
  return map;
}

function buildCartSummaryLines() {
  const productsById = buildProductsFinalById();
  return getItemsArray()
    .filter((x) => Number(x.qty) > 0)
    .map((x) => {
      const p = productsById[x.productId];
      const unit = round2(p?.priceFinal || 0);
      const qty = Number(x.qty || 0);
      return {
        productId: x.productId,
        name: String(p?.name || "Produs"),
        qty,
        unit,
        lineTotal: round2(unit * qty)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

function computeCartTotal() {
  return round2(buildCartSummaryLines().reduce((s, it) => s + it.lineTotal, 0));
}

/* =========================
   Sticky bar + Summary
========================= */

function ensureStickyBar() {
  ensureCatalogCSSOnce();

  let bar = document.getElementById("stickyCartBar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "stickyCartBar";

  bar.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div style="flex:1; min-width:0;">
        <div style="font-size:12px; opacity:0.85;">Coș</div>
        <div id="stickyCartMeta" style="font-size:14px; font-weight:900;">0 produse</div>
        <div id="stickyCartTotal" style="font-size:13px; opacity:0.92; margin-top:2px;">0 lei</div>
      </div>

      <button id="btnToggleSummary" class="btn-ghost" type="button">Detalii</button>
      <button id="btnSubmitOrder" class="btn-soft" type="button">Trimite comanda</button>
    </div>

    <div id="cartSummaryWrap" style="display:none; border-top:1px solid rgba(255,255,255,0.10); padding-top:10px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
        <div style="font-weight:900;">Sumar</div>
        <button id="btnCloseSummary" class="btn-ghost" type="button">Închide</button>
      </div>

      <div id="cartSummaryDrawer" style="display:flex; flex-direction:column; gap:8px; max-height:52vh; overflow:auto;"></div>

      <div style="border-top:1px dashed rgba(255,255,255,0.18); margin-top:10px; padding-top:10px; display:flex; align-items:center; justify-content:space-between;">
        <div style="opacity:0.9;">Total</div>
        <div id="cartSummaryTotal" style="font-weight:900;">0 lei</div>
      </div>
    </div>
  `;

  document.body.appendChild(bar);

  const toggle = () => {
    const wrap = bar.querySelector("#cartSummaryWrap");
    const isOpen = wrap.style.display !== "none";
    wrap.style.display = isOpen ? "none" : "block";
    if (!isOpen) renderSummary(bar);
    applyBodyPaddingForBar();
  };

  bar.querySelector("#btnToggleSummary").addEventListener("click", toggle);
  bar.querySelector("#btnCloseSummary").addEventListener("click", () => {
    bar.querySelector("#cartSummaryWrap").style.display = "none";
    applyBodyPaddingForBar();
  });

  // ✅ SUBMIT: trimite items în event.detail
  bar.querySelector("#btnSubmitOrder").addEventListener("click", () => {
    const count = getItemCount();
    if (count <= 0) {
      alert("Coșul este gol.");
      return;
    }

    const items = buildCartSummaryLines().map((it) => ({
      productId: it.productId,
      name: it.name,
      qty: it.qty,
      unitPriceFinal: it.unit,
      lineTotal: it.lineTotal
    }));

    window.dispatchEvent(
      new CustomEvent("catalog:submitOrderRequested", {
        detail: { items }
      })
    );
  });

  // live update on cart changes
  window.addEventListener("cart:updated", () => {
    updateStickyBar(bar);
    const wrap = bar.querySelector("#cartSummaryWrap");
    if (wrap.style.display !== "none") renderSummary(bar);
  });

  // resize padding
  window.addEventListener("resize", applyBodyPaddingForBar);

  updateStickyBar(bar);
  applyBodyPaddingForBar();
  return bar;
}

function renderSummary(bar) {
  const drawer = bar.querySelector("#cartSummaryDrawer");
  const totalEl = bar.querySelector("#cartSummaryTotal");
  drawer.innerHTML = "";

  const lines = buildCartSummaryLines();
  if (!lines.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.8";
    empty.textContent = "Coșul este gol.";
    drawer.appendChild(empty);
    totalEl.textContent = "0 lei";
    return;
  }

  lines.forEach((it) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr auto";
    row.style.gap = "10px";
    row.style.alignItems = "center";
    row.style.padding = "10px";
    row.style.border = "1px solid rgba(255,255,255,0.10)";
    row.style.borderRadius = "12px";
    row.style.background = "rgba(255,255,255,0.03)";

    row.innerHTML = `
      <div style="min-width:0;">
        <div style="font-weight:900; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${it.name}</div>
        <div style="font-size:12px; opacity:0.9; margin-top:2px;">${it.qty} × ${formatMoney(it.unit)} lei</div>
      </div>
      <div style="font-weight:900; font-size:13px;">${formatMoney(it.lineTotal)} lei</div>
    `;
    drawer.appendChild(row);
  });

  totalEl.textContent = `${formatMoney(computeCartTotal())} lei`;
}

function updateStickyBar(bar) {
  if (!_lastRenderOpts.showPrices) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";

  const count = getItemCount();
  const total = computeCartTotal();

  bar.querySelector("#stickyCartMeta").textContent = `${count} ${count === 1 ? "produs" : "produse"}`;
  bar.querySelector("#stickyCartTotal").textContent = `${formatMoney(total)} lei`;

  const btn = bar.querySelector("#btnSubmitOrder");
  btn.disabled = count <= 0;
  btn.style.opacity = count <= 0 ? "0.55" : "1";
  btn.style.cursor = count <= 0 ? "not-allowed" : "pointer";
}

function applyBodyPaddingForBar() {
  const bar = document.getElementById("stickyCartBar");
  if (!bar) return;

  const isMobile = window.matchMedia("(max-width: 899px)").matches;
  if (!isMobile) {
    document.body.style.paddingBottom = "";
    return;
  }

  const summaryOpen = bar.querySelector("#cartSummaryWrap")?.style.display !== "none";
  document.body.style.paddingBottom = summaryOpen ? "220px" : "140px";
}

/* =========================
   Cart bindings (delegation)
========================= */

function ensureCartBindings(productsGrid) {
  if (!productsGrid) return;
  if (productsGrid.dataset.cartBound === "1") return;
  productsGrid.dataset.cartBound = "1";

  productsGrid.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-action]");
    if (!btn) return;

    const card = btn.closest(".product-card");
    const productId = card?.dataset?.productId;
    if (!productId) return;

    const action = btn.dataset.action;

    if (action === "dec") increment(productId, -1);
    if (action === "inc") increment(productId, +1);
    if (action === "add") increment(productId, +1);
  });

  productsGrid.addEventListener("change", (e) => {
    const input = e.target?.closest?.('input[data-role="qty"]');
    if (!input) return;

    const card = input.closest(".product-card");
    const productId = card?.dataset?.productId;
    if (!productId) return;

    const v = Math.max(0, Number(input.value || 0));
    setQuantity(productId, v);
  });
}

/* =========================
   Public API
========================= */

export async function loadProducts(db) {
  const snap = await getDocs(
    query(
      collection(db, "products"),
      where("active", "==", true),
      orderBy("sortOrder"),
      orderBy("name"),
      limit(2000)
    )
  );

  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...(d.data() || {}) }));
  _lastItems = items;
  return items;
}

export async function renderProducts(productsGrid, items, opts = {}) {
  _lastItems = Array.isArray(items) ? items : [];
  _lastRenderOpts = {
    showPrices: !!opts.showPrices,
    db: opts.db || null,
    priceRules: opts.priceRules || null
  };

  ensureCatalogCSSOnce();
  ensureGridLayout(productsGrid);
  ensureCartBindings(productsGrid);

  const hint = document.getElementById("catalogHint");
  if (hint) {
    hint.textContent = _lastRenderOpts.showPrices
      ? "Cont activ. Prețurile sunt vizibile."
      : "Ești în așteptare (pending). Vezi catalog fără prețuri.";
  }

  // categories
  try {
    await renderCategories(productsGrid);
  } catch (e) {
    console.warn("categories failed:", e);
  }

  const filtered =
    _selectedCategoryId === "ALL"
      ? _lastItems
      : _lastItems.filter((p) => String(p.categoryId || "") === _selectedCategoryId);

  if (!productsGrid) return;
  productsGrid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.8";
    empty.textContent = "Nu există produse în această categorie.";
    productsGrid.appendChild(empty);
    return;
  }

  filtered.forEach((p) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = productCardHTML(p);
    productsGrid.appendChild(wrap.firstElementChild);
  });

  // sticky bar
  const bar = ensureStickyBar();
  updateStickyBar(bar);
}
