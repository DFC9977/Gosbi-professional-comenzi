// js/catalog.js
// Catalog module used by js/app.js
// Exports: loadProducts(db), renderProducts(productsGrid, items, opts)
//
// What this fixes:
// - renders a proper category UI (sidebar if found, otherwise a top bar)
// - makes the products grid responsive (not "stacked on the side")
// - avoids hard dependency on a specific HTML structure

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let _categoriesCache = null;        // [{id,name,sortOrder,active}]
let _lastItems = [];                // last loaded products
let _selectedCategoryId = "ALL";    // current filter

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(v) {
  const n = asNumber(v);
  // keep integers clean, allow .50 etc
  return (Math.round(n * 100) / 100).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

async function loadCategories(db) {
  if (_categoriesCache) return _categoriesCache;

  // categories: active=true, order by sortOrder asc
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

function uniq(arr) {
  return [...new Set(arr)];
}

function findCategoriesHost(productsGrid) {
  const screen = document.getElementById("screenCatalog") || document.body;

  // Try common "sidebar" hosts (your UI screenshot shows a left rail)
  const sidebar =
    screen.querySelector("#categoriesRail") ||
    screen.querySelector("#categories") ||
    screen.querySelector(".categories-rail") ||
    screen.querySelector(".catalog-sidebar") ||
    screen.querySelector(".sidebar-categories") ||
    screen.querySelector("[data-categories]");

  if (sidebar) return { el: sidebar, mode: "sidebar" };

  // Fallback: create a top bar above the grid (inside the same parent)
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

    // insert before productsGrid
    const parent = productsGrid?.parentElement || screen;
    parent.insertBefore(top, productsGrid);
  }
  return { el: top, mode: "top" };
}

function makeCatButton(label, isActive) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;

  // Try to match your existing dark theme: keep styles minimal and safe
  b.style.padding = "8px 10px";
  b.style.borderRadius = "10px";
  b.style.border = isActive ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.2)";
  b.style.background = isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)";
  b.style.color = "inherit";
  b.style.cursor = "pointer";
  b.style.whiteSpace = "nowrap";

  return b;
}

function renderCategoriesUI(productsGrid, categories, allowedCategoryIds) {
  const host = findCategoriesHost(productsGrid);

  // If it's a sidebar, make it vertical and visible (in case it was empty)
  if (host.mode === "sidebar") {
    host.el.style.display = "flex";
    host.el.style.flexDirection = "column";
    host.el.style.gap = "10px";
    host.el.style.padding = host.el.style.padding || "12px";
  }

  // Build list: ALL + categories that exist in current products
  const visibleCats = categories.filter((c) => allowedCategoryIds.includes(c.id));
  const list = [{ id: "ALL", name: "Toate" }, ...visibleCats];

  host.el.innerHTML = "";
  list.forEach((c) => {
    const btn = makeCatButton(c.name, _selectedCategoryId === c.id);
    btn.addEventListener("click", () => {
      _selectedCategoryId = c.id;
      // re-render using last loaded items
      renderProducts(productsGrid, _lastItems, _lastRenderOpts);
    });
    host.el.appendChild(btn);
  });
}

function ensureGridLayout(productsGrid) {
  if (!productsGrid) return;

  // Force a responsive grid so cards don't "stack on the side"
  productsGrid.style.display = "grid";
  productsGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(260px, 1fr))";
  productsGrid.style.gap = "16px";
  productsGrid.style.alignItems = "stretch";
  productsGrid.style.justifyItems = "stretch";
  productsGrid.style.width = "100%";
  productsGrid.style.boxSizing = "border-box";

  // Sometimes the parent is constrained; try to allow full width
  const parent = productsGrid.parentElement;
  if (parent) {
    parent.style.width = parent.style.width || "100%";
    parent.style.boxSizing = "border-box";
  }
}

function productCardHTML(p, showPrice, priceMultiplier) {
  const name = String(p.name || "");
  const priceBase = asNumber(p.basePrice);
  const price = showPrice ? Math.round(priceBase * asNumber(priceMultiplier) * 100) / 100 : null;

  return `
    <div class="product-card" style="border:1px solid rgba(255,255,255,0.10); border-radius:16px; padding:14px;">
      <div style="font-weight:700; line-height:1.25; margin-bottom:10px;">${name}</div>
      <div style="opacity:0.9; margin-bottom:12px;">
        ${showPrice ? `Preț: <b>${formatMoney(price)} lei</b>` : `Prețuri vizibile doar pentru clienți activi`}
      </div>
      <button type="button" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:inherit;">
        Comandă (în curând)
      </button>
    </div>
  `;
}

let _lastRenderOpts = { showPrices: false, priceMultiplier: 1 };

/**
 * Called by app.js
 * Must return all active products (filtering & sorting handled client-side).
 */
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
  snap.forEach((d) => {
    items.push({ id: d.id, ...(d.data() || {}) });
  });

  _lastItems = items;
  return items;
}

/**
 * Called by app.js
 */
export async function renderProducts(productsGrid, items, opts = {}) {
  _lastItems = Array.isArray(items) ? items : [];
  _lastRenderOpts = {
    showPrices: !!opts.showPrices,
    priceMultiplier: asNumber(opts.priceMultiplier || 1)
  };

  ensureGridLayout(productsGrid);

  const screenHint = document.getElementById("catalogHint");
  if (screenHint) {
    screenHint.textContent = _lastRenderOpts.showPrices
      ? "Cont activ. Prețurile sunt vizibile."
      : "Ești în așteptare (pending). Vezi catalog fără prețuri.";
  }

  // Load categories and render UI
  try {
    const db = opts.db || (window.__db || null);
    // If app.js doesn't pass db, try to grab it from window (optional)
    const categories = db ? await loadCategories(db) : [];
    const presentCategoryIds = uniq(_lastItems.map((p) => String(p.categoryId || "")).filter(Boolean));
    if (categories.length) {
      renderCategoriesUI(productsGrid, categories, presentCategoryIds);
    }
  } catch (e) {
    // Don't block product rendering if categories fail
    console.warn("Categories load failed:", e);
  }

  // Filter
  const filtered =
    _selectedCategoryId === "ALL"
      ? _lastItems
      : _lastItems.filter((p) => String(p.categoryId || "") === _selectedCategoryId);

  // Render products
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
    wrap.innerHTML = productCardHTML(p, _lastRenderOpts.showPrices, _lastRenderOpts.priceMultiplier);
    productsGrid.appendChild(wrap.firstElementChild);
  });
}
