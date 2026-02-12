// catalog.js (updated) — categories + correct basePrice display
// Requires: ./firebase.js to export `db` (Firestore instance).

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let _categories = [];     // [{id, name, sortOrder, active}]
let _allProducts = [];    // [{...fields, id}]
let _activeCategoryId = "ALL";

function bySortOrderThenName(a, b) {
  const sa = Number(a.sortOrder ?? 999999);
  const sb = Number(b.sortOrder ?? 999999);
  if (sa !== sb) return sa - sb;
  return String(a.name ?? "").localeCompare(String(b.name ?? ""), "ro", { sensitivity: "base" });
}

function formatLei(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  // show without decimals if integer, else 2 decimals
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? `${Math.round(n)} lei` : `${n.toFixed(2)} lei`;
}

async function loadCategories() {
  const snap = await getDocs(
    query(
      collection(db, "categories"),
      where("active", "==", true),
      orderBy("sortOrder")
    )
  );

  _categories = [];
  snap.forEach((d) => {
    const c = d.data() || {};
    _categories.push({
      id: d.id,
      name: c.name ?? d.id,
      sortOrder: c.sortOrder ?? 999999,
      active: c.active ?? true
    });
  });

  _categories.sort(bySortOrderThenName);
  return _categories;
}

async function loadAllProducts() {
  // We load ALL active products once; client-side filter by category.
  // If you have very many products, we can switch to per-category queries later.
  const snap = await getDocs(
    query(
      collection(db, "products"),
      where("active", "==", true),
      orderBy("sortOrder")
    )
  );

  _allProducts = [];
  snap.forEach((d) => {
    const p = d.data() || {};
    _allProducts.push({ id: d.id, ...p });
  });

  _allProducts.sort(bySortOrderThenName);
  return _allProducts;
}

/**
 * Called by app.js after auth/profile are ready.
 * Returns array of products (active only).
 */
export async function loadProducts() {
  // Load in parallel
  await Promise.all([loadCategories(), loadAllProducts()]);
  return _allProducts;
}

function ensureCategoriesBar(container) {
  // Create once, keep at top
  let bar = container.querySelector(".categories-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "categories-bar";
    bar.style.display = "flex";
    bar.style.flexWrap = "wrap";
    bar.style.gap = "8px";
    bar.style.marginBottom = "14px";
    container.prepend(bar);
  }
  return bar;
}

function renderCategoryButtons(container, onChange) {
  const bar = ensureCategoriesBar(container);
  bar.innerHTML = "";

  const makeBtn = (label, id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.dataset.catId = id;

    // lightweight styling (works even if your CSS doesn't have classes)
    btn.style.padding = "8px 10px";
    btn.style.borderRadius = "999px";
    btn.style.border = "1px solid rgba(255,255,255,0.15)";
    btn.style.background = (id === _activeCategoryId) ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)";
    btn.style.color = "inherit";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", () => {
      _activeCategoryId = id;
      onChange?.(id);
    });

    return btn;
  };

  bar.appendChild(makeBtn("Toate", "ALL"));
  _categories.forEach((c) => bar.appendChild(makeBtn(c.name, c.id)));
}

/**
 * Called by app.js:
 *   renderProducts(productsGrid, items, { showPrices })
 */
export function renderProducts(container, items, { showPrices } = {}) {
  if (!container) return;

  // We will keep the categories bar, but rebuild product cards.
  // So: clear everything, then re-add bar and products.
  container.innerHTML = "";
  renderCategoryButtons(container, () => {
    // re-render on category change using cached items
    renderProducts(container, _allProducts, { showPrices });
  });

  const filtered = (_activeCategoryId === "ALL")
    ? (items ?? [])
    : (items ?? []).filter(p => p.categoryId === _activeCategoryId);

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.textContent = "Nu există produse în această categorie.";
    empty.style.opacity = "0.8";
    container.appendChild(empty);
    return;
  }

  // Products grid wrapper (if your CSS already targets the container as a grid, this won't hurt)
  const grid = document.createElement("div");
  grid.className = "products-grid";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
  grid.style.gap = "14px";

  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.style.border = "1px solid rgba(255,255,255,0.10)";
    card.style.borderRadius = "14px";
    card.style.padding = "12px";
    card.style.background = "rgba(0,0,0,0.12)";

    const name = document.createElement("div");
    name.className = "product-name";
    name.textContent = p.name ?? "(fără nume)";
    name.style.fontWeight = "700";
    name.style.marginBottom = "8px";

    const price = document.createElement("div");
    price.className = "product-price";
    price.style.marginBottom = "10px";

    if (showPrices) {
      // IMPORTANT: Firestore field is basePrice (number)
      // Fallbacks if some products use another field.
      const v = (p.basePrice ?? p.price ?? p.pret ?? null);
      const formatted = formatLei(v);
      price.textContent = formatted ? `Preț: ${formatted}` : "Preț: —";
    } else {
      price.textContent = "Prețuri vizibile doar pentru clienți activi";
      price.style.opacity = "0.85";
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Comandă (în curând)";
    btn.disabled = true;
    btn.style.width = "100%";
    btn.style.padding = "10px 12px";
    btn.style.borderRadius = "12px";
    btn.style.border = "1px solid rgba(255,255,255,0.12)";
    btn.style.background = "rgba(0,0,0,0.15)";
    btn.style.color = "inherit";
    btn.style.opacity = "0.9";

    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(btn);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}
