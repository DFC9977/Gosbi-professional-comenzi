// js/catalog.js
// Exports: loadProducts(db), renderProducts(productsGrid, items, opts)
//
// ✅ Includes cart integration via ./cart.js (qty +/− + persistent localStorage)

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { getCart, increment, setQuantity } from "./cart.js";

let _categoriesCache = null;
let _lastItems = [];
let _selectedCategoryId = "ALL";
let _lastRenderOpts = { showPrices: false, db: null, priceRules: null };

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(v) {
  const n = asNumber(v);
  return (Math.round(n * 100) / 100).toLocaleString("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function uniq(arr) {
  return [...new Set(arr)];
}

function ensureGridLayout(productsGrid) {
  if (!productsGrid) return;

  productsGrid.style.display = "grid";
  productsGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(260px, 1fr))";
  productsGrid.style.gap = "16px";
  productsGrid.style.alignItems = "stretch";
  productsGrid.style.justifyItems = "stretch";
  productsGrid.style.width = "100%";
  productsGrid.style.boxSizing = "border-box";
}

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

function findCategoriesHost(productsGrid) {
  const screen = document.getElementById("screenCatalog") || document.body;

  const sidebar =
    screen.querySelector("#categoriesRail") ||
    screen.querySelector("#categories") ||
    screen.querySelector(".categories-rail") ||
    screen.querySelector(".catalog-sidebar") ||
    screen.querySelector(".sidebar-categories") ||
    screen.querySelector("[data-categories]");

  if (sidebar) return { el: sidebar, mode: "sidebar" };

  let top = screen.querySelector("#categoriesTopBar");
  if (!top) {
    top = document.createElement("div");
    top.id = "categoriesTopBar";
    top.style.display = "flex";
    top.style.flexWrap = "wrap";
    top.style.gap = "8px";
    top.style.margin = "12px 0 16px 0";
    top.style.alignItems = "center";
    top.style.justifyContent = "flex-start";

    const parent = productsGrid?.parentElement || screen;
    parent.insertBefore(top, productsGrid);
  }
  return { el: top, mode: "top" };
}

function makeCatButton(label, isActive) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;

  b.style.padding = "8px 10px";
  b.style.borderRadius = "10px";
  b.style.border = isActive
    ? "1px solid rgba(255,255,255,0.6)"
    : "1px solid rgba(255,255,255,0.2)";
  b.style.background = isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)";
  b.style.color = "inherit";
  b.style.cursor = "pointer";
  b.style.whiteSpace = "nowrap";

  return b;
}

function renderCategoriesUI(productsGrid, categories, allowedCategoryIds) {
  const host = findCategoriesHost(productsGrid);

  if (host.mode === "sidebar") {
    host.el.style.display = "flex";
    host.el.style.flexDirection = "column";
    host.el.style.gap = "10px";
    host.el.style.padding = host.el.style.padding || "12px";
  }

  const visibleCats = categories.filter((c) => allowedCategoryIds.includes(c.id));
  const list = [{ id: "ALL", name: "Toate" }, ...visibleCats];

  host.el.innerHTML = "";
  list.forEach((c) => {
    const btn = makeCatButton(c.name, _selectedCategoryId === c.id);
    btn.addEventListener("click", () => {
      _selectedCategoryId = c.id;
      renderProducts(productsGrid, _lastItems, _lastRenderOpts);
    });
    host.el.appendChild(btn);
  });
}

// ✅ calculează adaos: override pe categorie sau global
function getMarkupForProduct(p, priceRules) {
  const catId = String(p?.categoryId || "");
  const byCat = priceRules?.categories?.[catId];
  if (byCat !== undefined && byCat !== null && byCat !== "") return asNumber(byCat);
  return asNumber(priceRules?.globalMarkup);
}

function getBaseGrossPrice(p) {
  return asNumber(p?.priceGross ?? p?.basePrice ?? p?.base_price ?? p?.price ?? 0);
}

function computeFinalPrice(p, showPrice, priceRules) {
  if (!showPrice) return null;
  const base = getBaseGrossPrice(p);
  const markup = getMarkupForProduct(p, priceRules); // %
  return Math.round(base * (1 + markup / 100) * 100) / 100;
}

function getQtyFromCart(productId) {
  const cart = getCart();
  return Number(cart.items?.[productId] || 0);
}

function productCardHTML(p, showPrice, priceRules) {
  const id = String(p.id || "");
  const name = String(p.name || "");
  const finalPrice = computeFinalPrice(p, showPrice, priceRules);
  const qty = showPrice ? getQtyFromCart(id) : 0;

  return `
    <div class="product-card"
         data-product-id="${id}"
         style="border:1px solid rgba(255,255,255,0.10); border-radius:16px; padding:14px; display:flex; flex-direction:column; gap:10px;">
      
      <div style="font-weight:700; line-height:1.25;">${name}</div>

      <div style="opacity:0.9;">
        ${
          showPrice
            ? `Preț: <b>${formatMoney(finalPrice)} lei</b>`
            : `Prețuri vizibile doar pentru clienți activi`
        }
      </div>

      ${
        showPrice
          ? `
          <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
            <button type="button" data-action="dec"
              style="width:42px; height:38px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:transparent; color:inherit; font-size:18px; cursor:pointer;">−</button>

            <input data-role="qty" type="number" min="0" value="${qty}"
              style="width:70px; height:38px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:transparent; color:inherit; text-align:center; padding:0 8px;" />

            <button type="button" data-action="inc"
              style="width:42px; height:38px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:transparent; color:inherit; font-size:18px; cursor:pointer;">+</button>

            <div style="flex:1;"></div>

            <button type="button" data-action="add"
              style="padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:inherit; cursor:pointer;">
              Adaugă
            </button>
          </div>
          `
          : `
          <button type="button" disabled
            style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:inherit; opacity:0.6;">
            Comandă (indisponibil)
          </button>
          `
      }
    </div>
  `;
}

/** Attach cart listeners ONCE per grid (delegation) */
function ensureCartBindings(productsGrid) {
  if (!productsGrid) return;
  if (productsGrid.dataset.cartBound === "1") return;
  productsGrid.dataset.cartBound = "1";

  // Click delegation (+/−/add)
  productsGrid.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-action]");
    if (!btn) return;

    const card = btn.closest(".product-card");
    const productId = card?.dataset?.productId;
    if (!productId) return;

    const action = btn.dataset.action;
    if (action === "dec") increment(productId, -1);
    else if (action === "inc") increment(productId, +1);
    else if (action === "add") increment(productId, +1);

    syncVisibleQty(productsGrid, productId);
  });

  // Qty input change delegation
  productsGrid.addEventListener("change", (e) => {
    const input = e.target?.closest?.('input[data-role="qty"]');
    if (!input) return;

    const card = input.closest(".product-card");
    const productId = card?.dataset?.productId;
    if (!productId) return;

    const v = Math.max(0, Number(input.value || 0));
    setQuantity(productId, v);

    syncVisibleQty(productsGrid, productId);
  });

  // Global sync when cart updates from elsewhere (category switching etc.)
  window.addEventListener("cart:updated", () => {
    syncAllVisibleQty(productsGrid);
  });
}

function syncVisibleQty(productsGrid, productId) {
  const card = productsGrid?.querySelector?.(`.product-card[data-product-id="${CSS.escape(productId)}"]`);
  if (!card) return;
  const input = card.querySelector('input[data-role="qty"]');
  if (!input) return;
  input.value = String(getQtyFromCart(productId));
}

function syncAllVisibleQty(productsGrid) {
  if (!productsGrid) return;
  const cards = productsGrid.querySelectorAll(".product-card[data-product-id]");
  cards.forEach((card) => {
    const productId = card.dataset.productId;
    const input = card.querySelector('input[data-role="qty"]');
    if (!input) return;
    input.value = String(getQtyFromCart(productId));
  });
}

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

  ensureGridLayout(productsGrid);
  ensureCartBindings(productsGrid);

  const screenHint = document.getElementById("catalogHint");
  if (screenHint) {
    screenHint.textContent = _lastRenderOpts.showPrices
      ? "Cont activ. Prețurile sunt vizibile."
      : "Ești în așteptare (pending). Vezi catalog fără prețuri.";
  }

  // Build global products map for later order submit
  window.__PRODUCTS_BY_ID__ = window.__PRODUCTS_BY_ID__ || {};
  _lastItems.forEach((p) => (window.__PRODUCTS_BY_ID__[p.id] = p));

  // Categories UI
  try {
    const db = _lastRenderOpts.db || window.__db || null;
    const categories = db ? await loadCategories(db) : [];
    const presentCategoryIds = uniq(
      _lastItems.map((p) => String(p.categoryId || "")).filter(Boolean)
    );
    if (categories.length) renderCategoriesUI(productsGrid, categories, presentCategoryIds);
  } catch (e) {
    console.warn("Categories load failed:", e);
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
    const cardWrap = document.createElement("div");
    cardWrap.innerHTML = productCardHTML(p, _lastRenderOpts.showPrices, _lastRenderOpts.priceRules);
    productsGrid.appendChild(cardWrap.firstElementChild);
  });

  // After render: ensure qty matches cart (especially when switching categories)
  if (_lastRenderOpts.showPrices) syncAllVisibleQty(productsGrid);
}
