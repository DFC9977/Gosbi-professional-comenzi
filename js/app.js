import { auth, db } from "./firebase.js";
import {
  fillCountyOptions,
  fillCityDatalist,
  getUserProfile,
  isContactComplete,
  saveContact
} from "./profile.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------------------------
   DOM
--------------------------- */
const screenLoading = document.getElementById("screenLoading");
const screenLogin = document.getElementById("screenLogin");
const screenContactGate = document.getElementById("screenContactGate");
const screenCatalog = document.getElementById("screenCatalog");

const sessionInfo = document.getElementById("sessionInfo");
const btnLogout = document.getElementById("btnLogout");

// Login
const loginPhone = document.getElementById("loginPhone");
const loginPass = document.getElementById("loginPass");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const loginMsg = document.getElementById("loginMsg");

// Contact
const fullName = document.getElementById("fullName");
const address = document.getElementById("address");
const countySelect = document.getElementById("countySelect");
const cityInput = document.getElementById("cityInput");
const cityList = document.getElementById("cityList");
const btnSaveContact = document.getElementById("btnSaveContact");
const btnBackToLogin = document.getElementById("btnBackToLogin");
const contactMsg = document.getElementById("contactMsg");

// Catalog
const productsGrid = document.getElementById("productsGrid");
const btnRefreshProducts = document.getElementById("btnRefreshProducts");
const catalogHint = document.getElementById("catalogHint");

/* ---------------------------
   UI helpers
--------------------------- */
function showOnly(which) {
  screenLoading.hidden = true;
  screenLogin.hidden = true;
  screenContactGate.hidden = true;
  screenCatalog.hidden = true;
  which.hidden = false;
}

function showNote(el, text, type = "info") {
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  el.classList.remove("ok", "err");
  if (type === "ok") el.classList.add("ok");
  if (type === "err") el.classList.add("err");
}

function hideNote(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
  el.classList.remove("ok", "err");
}

/* ---------------------------
   Auth helpers (phone->email)
   (simulare v1 fără SMS)
--------------------------- */
function normalizePhone(raw) {
  return String(raw || "").replace(/\s+/g, "").replace(/[^0-9+]/g, "");
}

function phoneToEmail(phone) {
  // păstrăm doar cifrele ca să fie stabil
  const digits = normalizePhone(phone).replace(/\D/g, "");
  // email fake pentru Firebase Email/Password
  return `${digits}@phone.local`;
}

/* ---------------------------
   Firestore user doc (users/{uid})
--------------------------- */
async function ensureUserDoc(user, phoneDigits = "") {
  const ref = doc(db, "users", user.uid);

  // Nu facem getDoc aici ca să evităm încă o rundă. Setăm merge.
  await setDoc(
    ref,
    {
      role: "client",
      status: "pending",
      phone: phoneDigits || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/* ---------------------------
   Routing
--------------------------- */
async function routeAfterAuth(user) {
  const profile = await getUserProfile(user.uid);

  // Dacă nu există profil (sau e gol), îl inițializăm minim
  // (nu stricăm nimic – merge: true)
  if (!profile) {
    await ensureUserDoc(user, "");
  }

  const freshProfile = profile || (await getUserProfile(user.uid)) || null;

  // Gate: date contact obligatorii
  if (!isContactComplete(freshProfile)) {
    // prefill dacă există ceva
    fullName.value = freshProfile?.contact?.fullName || "";
    address.value = freshProfile?.contact?.address || "";

    const county = freshProfile?.contact?.county || "";
    countySelect.value = county;

    fillCityDatalist(cityList, county);
    cityInput.disabled = !county;

    const city = freshProfile?.contact?.city || "";
    cityInput.value = city || "";

    hideNote(contactMsg);
    showOnly(screenContactGate);
    return;
  }

  // Catalog
  const status = freshProfile?.status || "pending";
  const showPrices = status === "active";

  catalogHint.textContent = showPrices
    ? "Ești activ. Vezi prețuri și poți comanda."
    : "Ești în așteptare (pending). Vezi catalog fără prețuri.";

  showOnly(screenCatalog);
  await loadCatalog(showPrices);
}

/* ---------------------------
   Catalog (fallback dacă nu e implementat complet)
--------------------------- */
async function loadCatalog(showPrices) {
  // încercăm să folosim catalog.js dacă există funcții
  try {
    const mod = await import("./catalog.js");

    // dacă ai funcții în catalog.js, le folosim
    if (typeof mod.loadProducts === "function") {
      const items = await mod.loadProducts();
      if (typeof mod.renderProducts === "function") {
        mod.renderProducts(productsGrid, items, { showPrices });
        return;
      }
      // fallback simplu
      renderFallback(items, showPrices);
      return;
    }
  } catch (e) {
    // ignore – mergem pe fallback
  }

  // fallback “safe”
  productsGrid.innerHTML = `
    <div class="note">
      Catalog-ul nu e încă legat la Firestore (catalog.js). Gate-ul de contact este OK.
    </div>
  `;
}

function renderFallback(items, showPrices) {
  productsGrid.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    productsGrid.innerHTML = `<div class="note">Nu există produse încă.</div>`;
    return;
  }

  for (const p of items) {
    const card = document.createElement("div");
    card.className = "product";

    const priceHtml = showPrices
      ? `<div class="price">${Number(p.price || 0)} lei</div>`
      : `<div class="price muted">Preț ascuns</div>`;

    card.innerHTML = `
      <div class="p-title">${p.name || "Produs"}</div>
      <div class="p-desc muted">${p.description || ""}</div>
      ${priceHtml}
    `;

    productsGrid.appendChild(card);
  }
}

/* ---------------------------
   Init (populate + listeners)
--------------------------- */
function initUI() {
  // Populate counties
  fillCountyOptions(countySelect);

  // City input enabled after county selected
  countySelect.addEventListener("change", () => {
    const county = countySelect.value;
    fillCityDatalist(cityList, county);
    cityInput.value = "";
    cityInput.disabled = !county;
  });

  // Logout
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  });

  // Back to login (only makes sense if user logs out)
  btnBackToLogin.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  });

  // Refresh products
  btnRefreshProducts.addEventListener("click", async () => {
    // citim profilul ca să știm dacă are prețuri
    const u = auth.currentUser;
    if (!u) return;
    const prof = await getUserProfile(u.uid);
    const showPrices = (prof?.status || "pending") === "active";
    await loadCatalog(showPrices);
  });

  // Login
  btnLogin.addEventListener("click", async () => {
    hideNote(loginMsg);

    const phone = normalizePhone(loginPhone.value);
    const pass = String(loginPass.value || "");

    if (!phone) return showNote(loginMsg, "Completează telefonul.", "err");
    if (!pass || pass.length < 6) return showNote(loginMsg, "Parola minim 6 caractere.", "err");

    const email = phoneToEmail(phone);

    btnLogin.disabled = true;
    btnRegister.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged va face routing
    } catch (e) {
      console.error(e);
      showNote(loginMsg, `Firebase: ${e.message || "Eroare login."}`, "err");
    } finally {
      btnLogin.disabled = false;
      btnRegister.disabled = false;
    }
  });

  // Register
  btnRegister.addEventListener("click", async () => {
    hideNote(loginMsg);

    const phone = normalizePhone(loginPhone.value);
    const pass = String(loginPass.value || "");

    if (!phone) return showNote(loginMsg, "Completează telefonul.", "err");
    if (!pass || pass.length < 6) return showNote(loginMsg, "Parola minim 6 caractere.", "err");

    const email = phoneToEmail(phone);
    const digits = phone.replace(/\D/g, "");

    btnLogin.disabled = true;
    btnRegister.disabled = true;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await ensureUserDoc(cred.user, digits);
      showNote(loginMsg, "Cont creat. Completează datele de contact.", "ok");
      // onAuthStateChanged -> routeAfterAuth -> contact gate
    } catch (e) {
      console.error(e);
      showNote(loginMsg, `Firebase: ${e.message || "Eroare creare cont."}`, "err");
    } finally {
      btnLogin.disabled = false;
      btnRegister.disabled = false;
    }
  });

  // Save contact
  btnSaveContact.addEventListener("click", async () => {
    hideNote(contactMsg);

    try {
      btnSaveContact.disabled = true;

      const u = auth.currentUser;
      const uid = u?.uid;
      if (!uid) throw new Error("Sesiune invalidă. Reautentifică-te.");

      await saveContact(uid, {
        fullName: fullName.value,
        address: address.value,
        county: countySelect.value,
        city: cityInput.value
      });

      showNote(contactMsg, "Date salvate. Se deschide catalogul…", "ok");
      await routeAfterAuth(auth.currentUser);
    } catch (e) {
      console.error(e);
      showNote(contactMsg, e?.message || "Eroare la salvare.", "err");
    } finally {
      btnSaveContact.disabled = false;
    }
  });
}

/* ---------------------------
   Boot
--------------------------- */
initUI();
showOnly(screenLoading);
sessionInfo.textContent = "Verific sesiunea…";
btnLogout.hidden = true;

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      sessionInfo.textContent = "Neautentificat";
      btnLogout.hidden = true;
      showOnly(screenLogin);
      return;
    }

    btnLogout.hidden = false;
    sessionInfo.textContent = "Autentificat";

    await routeAfterAuth(user);
  } catch (e) {
    console.error("BOOT ERROR:", e);
    sessionInfo.textContent = "Eroare inițializare";
    btnLogout.hidden = true;
    showOnly(screenLogin);
    showNote(loginMsg, e?.message || "Eroare la inițializare.", "err");
  }
});
