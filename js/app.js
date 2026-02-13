// js/app.js

import { auth, db } from "./firebase.js";
import { submitOrder } from "./orders.js";
import { clearCart } from "./cart.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  fillCountyOptions,
  fillCityDatalist,
  getUserProfile,
  isContactComplete,
  saveContact,
} from "./profile.js";

import { loadProducts, renderProducts } from "./catalog.js";


/* =======================
   SUBMIT ORDER LISTENER
======================= */
window.addEventListener("catalog:submitOrderRequested", async (event) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("Trebuie să fii logat.");
      return;
    }

    const items = event?.detail?.items || [];
    if (!items.length) {
      alert("Coș gol.");
      return;
    }

    const result = await submitOrder({
      clientId: user.uid,
      clientName: user.email || "",
      items
    });

    alert(`Comanda #${result.orderNumber} a fost trimisă.`);

    // 🔥 GOLIRE COȘ
    clearCart();

    // 🔄 Refresh catalog pentru resetare UI
    await refreshCatalog();

  } catch (err) {
    console.error(err);
    alert(err?.message || "Eroare la trimiterea comenzii.");
  }
});


/* -------------------- DOM -------------------- */
const screenLoading = document.getElementById("screenLoading");
const screenLogin = document.getElementById("screenLogin");
const screenContactGate = document.getElementById("screenContactGate");
const screenCatalog = document.getElementById("screenCatalog");
const screenAdmin = document.getElementById("screenAdmin");

const sessionInfo = document.getElementById("sessionInfo");
const btnLogout = document.getElementById("btnLogout");
const btnAdmin = document.getElementById("btnAdmin");

const loginPhone = document.getElementById("loginPhone");
const loginPass = document.getElementById("loginPass");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const loginMsg = document.getElementById("loginMsg");

const fullName = document.getElementById("fullName");
const address = document.getElementById("address");
const countySelect = document.getElementById("countySelect");
const cityInput = document.getElementById("cityInput");
const cityList = document.getElementById("cityList");
const btnSaveContact = document.getElementById("btnSaveContact");
const btnBackToLogin = document.getElementById("btnBackToLogin");
const contactMsg = document.getElementById("contactMsg");

const productsGrid = document.getElementById("productsGrid");
const catalogHint = document.getElementById("catalogHint");
const btnRefreshProducts = document.getElementById("btnRefreshProducts");

const btnBackToCatalog = document.getElementById("btnBackToCatalog");
const adminFrame = document.getElementById("adminFrame");


/* -------------------- Helpers -------------------- */
function showOnly(el) {
  const screens = [screenLoading, screenLogin, screenContactGate, screenCatalog, screenAdmin];
  for (const s of screens) if (s) s.hidden = (s !== el);
}

function showNote(el, text, kind = "info") {
  if (!el) return;
  el.hidden = false;
  el.textContent = text || "";
  el.classList.remove("ok", "err", "info");
  el.classList.add(kind);
}

function clearNote(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
  el.classList.remove("ok", "err", "info");
}

function normalizePhone(p) {
  return String(p || "").replace(/\s+/g, "").trim();
}

function phoneToEmail(phone) {
  const p = normalizePhone(phone);
  return p ? `${p}@phone.local` : "";
}

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const phone = (user.email || "").replace("@phone.local", "");
  const payload = {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    role: "client",
    status: "pending",
    phone: phone || "",
    email: user.email || "",
    contact: { completed: false },
  };

  await setDoc(ref, payload, { merge: true });
  return payload;
}

function setSessionText(user) {
  if (!user) {
    sessionInfo.textContent = "Neautentificat";
    btnLogout.hidden = true;
    if (btnAdmin) btnAdmin.style.display = "none";
    return;
  }
  const phone = (user.email || "").replace("@phone.local", "");
  sessionInfo.textContent = `Autentificat: ${phone || user.email || user.uid}`;
  btnLogout.hidden = false;
}

function setCatalogHint(profile) {
  const status = profile?.status || "pending";
  if (!catalogHint) return;
  catalogHint.textContent =
    status === "active"
      ? "Cont activ. Prețurile sunt vizibile."
      : "Ești în așteptare (pending). Vezi catalog fără prețuri.";
}


/* -------------------- Catalog -------------------- */
btnRefreshProducts?.addEventListener("click", async () => {
  try {
    btnRefreshProducts.disabled = true;
    await refreshCatalog();
  } finally {
    btnRefreshProducts.disabled = false;
  }
});

function normalizePrice(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

async function refreshCatalog() {
  const user = auth.currentUser;
  if (!user) return;

  const profile = (await getUserProfile(user.uid)) || (await ensureUserDoc(user));
  const canSeePrices = profile?.status === "active" || profile?.role === "admin";

  const rawItems = await loadProducts(db);

  const items = (rawItems || []).map((p) => {
    const base = normalizePrice(
      p?.priceGross ?? p?.basePrice ?? p?.base_price ?? p?.price ?? p?.basePriceRon
    );
    return { ...p, priceGross: base, basePrice: base, base_price: base, price: base };
  });

  renderProducts(productsGrid, items, {
    showPrices: canSeePrices,
    db,
    priceRules: profile?.priceRules || null,
  });
}
