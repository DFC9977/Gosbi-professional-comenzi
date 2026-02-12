// js/app.js
import { auth, db } from "./firebase.js";

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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  fillCountyOptions,
  fillCityDatalist,
  getUserProfile,
  isContactComplete,
  saveContact,
} from "./profile.js";

import { loadProducts, renderProducts } from "./catalog.js";

/* -------------------- DOM -------------------- */
const screenLoading = document.getElementById("screenLoading");
const screenLogin = document.getElementById("screenLogin");
const screenContactGate = document.getElementById("screenContactGate");
const screenCatalog = document.getElementById("screenCatalog");

const sessionInfo = document.getElementById("sessionInfo");
const btnLogout = document.getElementById("btnLogout");
const adminLink = document.getElementById("adminLink");

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

/* -------------------- Helpers -------------------- */
function showOnly(el) {
  for (const s of [screenLoading, screenLogin, screenContactGate, screenCatalog]) {
    if (!s) continue;
    s.hidden = s !== el;
  }
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

// Simulăm login „telefon + parolă” prin email/password
function phoneToEmail(phone) {
  const p = normalizePhone(phone);
  if (!p) return "";
  return `${p}@phone.local`;
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
    if (adminLink) adminLink.style.display = "none";
    return;
  }
  const phone = (user.email || "").replace("@phone.local", "");
  sessionInfo.textContent = `Autentificat: ${phone || user.email || user.uid}`;
  btnLogout.hidden = false;
}

function setCatalogHint(profile) {
  const status = profile?.status || "pending";
  if (status === "active") {
    catalogHint.textContent = "Cont activ. Prețurile sunt vizibile.";
  } else {
    catalogHint.textContent = "Ești în așteptare (pending). Vezi catalog fără prețuri.";
  }
}

/* -------------------- UI: Contact (county/city) -------------------- */
function initCountyCity() {
  if (countySelect && countySelect.options.length <= 1) {
    fillCountyOptions(countySelect);
  }

  countySelect?.addEventListener("change", () => {
    const county = countySelect.value;
    fillCityDatalist(cityList, county);
    cityInput.value = "";
    cityInput.disabled = !county;
  });
}

/* -------------------- Auth Buttons -------------------- */
btnLogin?.addEventListener("click", async () => {
  clearNote(loginMsg);

  const phone = normalizePhone(loginPhone.value);
  const pass = String(loginPass.value || "");

  if (!phone) return showNote(loginMsg, "Completează telefonul.", "err");
  if (pass.length < 4) return showNote(loginMsg, "Parola e prea scurtă.", "err");

  try {
    btnLogin.disabled = true;
    await signInWithEmailAndPassword(auth, phoneToEmail(phone), pass);
  } catch (e) {
    showNote(loginMsg, e?.message || "Eroare la login.", "err");
  } finally {
    btnLogin.disabled = false;
  }
});

btnRegister?.addEventListener("click", async () => {
  clearNote(loginMsg);

  const phone = normalizePhone(loginPhone.value);
  const pass = String(loginPass.value || "");

  if (!phone) return showNote(loginMsg, "Completează telefonul.", "err");
  if (pass.length < 6) return showNote(loginMsg, "Parola trebuie să aibă minim 6 caractere.", "err");

  try {
    btnRegister.disabled = true;
    await createUserWithEmailAndPassword(auth, phoneToEmail(phone), pass);
    showNote(loginMsg, "Cont creat. Te autentific…", "ok");
  } catch (e) {
    showNote(loginMsg, e?.message || "Eroare la creare cont.", "err");
  } finally {
    btnRegister.disabled = false;
  }
});

btnLogout?.addEventListener("click", async () => {
  try { await signOut(auth); } catch (e) {}
});

btnBackToLogin?.addEventListener("click", async () => {
  clearNote(contactMsg);
  try { await signOut(auth); } catch (e) {}
});

/* -------------------- Contact Save -------------------- */
btnSaveContact?.addEventListener("click", async () => {
  clearNote(contactMsg);

  const user = auth.currentUser;
  if (!user) return showNote(contactMsg, "Sesiune invalidă. Reautentifică-te.", "err");

  try {
    btnSaveContact.disabled = true;

    await saveContact(user.uid, {
      fullName: fullName.value,
      address: address.value,
      county: countySelect.value,
      city: cityInput.value,
    });

    showNote(contactMsg, "Date salvate. Se deschide catalogul…", "ok");
    await routeAfterAuth(user);
  } catch (e) {
    showNote(contactMsg, e?.message || "Eroare la salvare.", "err");
  } finally {
    btnSaveContact.disabled = false;
  }
});

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

  // Gate prețuri
  const canSeePrices = profile?.status === "active" || profile?.role === "admin";

  // ✅ FIX: loadProducts(db)
  const rawItems = await loadProducts(db);

  // Normalize preț (tu vei folosi priceGross în timp; aici păstrăm compatibil)
  const items = (rawItems || []).map((p) => {
    const base = normalizePrice(p?.priceGross ?? p?.price ?? p?.basePrice ?? p?.base_price ?? p?.basePriceRon);
    return { ...p, priceGross: base, price: base, basePrice: base, base_price: base };
  });

  // ✅ FIX: trecem db către catalog (pentru categorii)
  renderProducts(productsGrid, items, { showPrices: canSeePrices, db });
}

/* -------------------- Routing -------------------- */
async function routeAfterAuth(user) {
  setSessionText(user);

  const base = await ensureUserDoc(user);
  const profile = (await getUserProfile(user.uid)) || base;

  // ✅ Buton Admin în aplicație
  if (adminLink) {
    adminLink.style.display = profile?.role === "admin" ? "inline-block" : "none";
  }

  // Gate contact
  if (!isContactComplete(profile)) {
    fullName.value = profile?.contact?.fullName || "";
    address.value = profile?.contact?.address || "";

    const county = profile?.contact?.county || "";
    countySelect.value = county;

    fillCityDatalist(cityList, county);
    cityInput.disabled = !county;

    const city = profile?.contact?.city || "";
    cityInput.value = city;

    clearNote(contactMsg);
    showOnly(screenContactGate);
    return;
  }

  setCatalogHint(profile);
  showOnly(screenCatalog);

  try {
    await refreshCatalog();
  } catch (e) {
    productsGrid.innerHTML = `<div class="note">Eroare la încărcarea produselor: ${escapeHtml(e?.message || "unknown")}</div>`;
  }
}

/* -------------------- Boot -------------------- */
initCountyCity();
showOnly(screenLoading);
setSessionText(null);

onAuthStateChanged(auth, async (user) => {
  clearNote(loginMsg);
  clearNote(contactMsg);

  if (!user) {
    setSessionText(null);
    showOnly(screenLogin);
    return;
  }

  showOnly(screenLoading);

  try {
    await routeAfterAuth(user);
  } catch (e) {
    setSessionText(user);
    showOnly(screenLogin);
    showNote(loginMsg, `Eroare: ${e?.message || "unknown"}`, "err");
  }
});

/* -------------------- small util -------------------- */
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
