import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  ensureUserProfile,
  phoneToEmail,
  signInWithPhonePassword,
  registerWithPhonePassword,
  saveContact,
  getUserProfile
} from "./profile.js";

// UI refs
const screenLoading = document.getElementById("screenLoading");
const screenLogin = document.getElementById("screenLogin");
const screenContactGate = document.getElementById("screenContactGate");
const screenCatalog = document.getElementById("screenCatalog");

const sessionInfo = document.getElementById("sessionInfo");
const btnLogout = document.getElementById("btnLogout");

// Login UI
const loginPhone = document.getElementById("loginPhone");
const loginPass = document.getElementById("loginPass");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const loginMsg = document.getElementById("loginMsg");

// Contact UI
const fullName = document.getElementById("fullName");
const address = document.getElementById("address");
const countySelect = document.getElementById("countySelect");
const cityInput = document.getElementById("cityInput");
const btnSaveContact = document.getElementById("btnSaveContact");
const btnBackToLogin = document.getElementById("btnBackToLogin");
const contactMsg = document.getElementById("contactMsg");

// Catalog UI
const productsGrid = document.getElementById("productsGrid");
const catalogHint = document.getElementById("catalogHint");
const btnRefreshProducts = document.getElementById("btnRefreshProducts");

function showOnly(el) {
  for (const s of [screenLoading, screenLogin, screenContactGate, screenCatalog]) {
    s.hidden = true;
  }
  el.hidden = false;
}

function showNote(el, text, type = "ok") {
  el.hidden = false;
  el.textContent = text;
  el.classList.remove("ok", "err");
  el.classList.add(type);
}

function clearNote(el) {
  el.hidden = true;
  el.textContent = "";
  el.classList.remove("ok", "err");
}

function setSessionLabel(user, profile) {
  if (!user) {
    sessionInfo.textContent = "Neautentificat";
    return;
  }
  const phone = profile?.phone || "";
  const status = profile?.status || "pending";
  sessionInfo.textContent = phone ? `${phone} • ${status}` : `${user.email} • ${status}`;
}

// ------- Auth actions --------
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

btnBackToLogin.addEventListener("click", async () => {
  await signOut(auth);
});

// Login
btnLogin.addEventListener("click", async () => {
  clearNote(loginMsg);
  const phone = (loginPhone.value || "").trim();
  const pass = (loginPass.value || "").trim();
  if (!phone || !pass) {
    showNote(loginMsg, "Completează telefon și parolă.", "err");
    return;
  }
  try {
    btnLogin.disabled = true;
    await signInWithPhonePassword(phone, pass);
  } catch (e) {
    showNote(loginMsg, `Firebase: ${e?.message || "Eroare la login."}`, "err");
  } finally {
    btnLogin.disabled = false;
  }
});

// Register
btnRegister.addEventListener("click", async () => {
  clearNote(loginMsg);
  const phone = (loginPhone.value || "").trim();
  const pass = (loginPass.value || "").trim();
  if (!phone || !pass) {
    showNote(loginMsg, "Completează telefon și parolă.", "err");
    return;
  }
  try {
    btnRegister.disabled = true;
    await registerWithPhonePassword(phone, pass);
    showNote(loginMsg, "Cont creat. Așteaptă validarea adminului.", "ok");
  } catch (e) {
    showNote(loginMsg, `Firebase: ${e?.message || "Eroare la creare cont."}`, "err");
  } finally {
    btnRegister.disabled = false;
  }
});

// Save contact
btnSaveContact.addEventListener("click", async () => {
  clearNote(contactMsg);

  const fn = (fullName.value || "").trim();
  const adr = (address.value || "").trim();
  const county = (countySelect.value || "").trim();
  const city = (cityInput.value || "").trim();

  if (!fn || !adr || !county || !city) {
    showNote(contactMsg, "Completează toate câmpurile (nume, adresă, județ, localitate).", "err");
    return;
  }

  try {
    btnSaveContact.disabled = true;
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Sesiune invalidă. Reautentifică-te.");

    await saveContact(uid, {
      fullName: fn,
      address: adr,
      county,
      city
    });

    showNote(contactMsg, "Date salvate. Se deschide catalogul…", "ok");
    await routeAfterAuth(auth.currentUser);
  } catch (e) {
    showNote(contactMsg, e?.message || "Eroare la salvare.", "err");
  } finally {
    btnSaveContact.disabled = false;
  }
});

// ------- Catalog loading --------
async function loadAndRenderCatalog(profile) {
  const status = profile?.status || "pending";
  const showPrices = status === "active";

  catalogHint.textContent =
    status === "active"
      ? "Ești activ. Vezi prețurile."
      : "Ești în așteptare (pending). Vezi catalog fără prețuri.";

  // 1) import catalog module
  let mod;
  try {
    mod = await import("./catalog.js");
  } catch (e) {
    productsGrid.innerHTML = "";
    showNote(
      loginMsg,
      `Eroare import catalog.js: ${e?.message || e}`,
      "err"
    );
    return;
  }

  // 2) validate exports
  if (typeof mod.loadProducts !== "function" || typeof mod.renderProducts !== "function") {
    productsGrid.innerHTML = `
      <div class="note err">
        catalog.js nu exportă loadProducts() și renderProducts().
      </div>
    `;
    return;
  }

  // 3) fetch + render
  try {
    const items = await mod.loadProducts();
    mod.renderProducts(productsGrid, items, { showPrices });
  } catch (e) {
    // AICI vei vedea clar permission-denied / missing index etc.
    productsGrid.innerHTML = `
      <div class="note err">
        Eroare Firestore la citire produse:<br/>
        <code>${escapeHtml(e?.message || String(e))}</code>
      </div>
    `;
  }
}

btnRefreshProducts.addEventListener("click", async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const profile = await getUserProfile(uid);
    await loadAndRenderCatalog(profile);
  } catch (e) {
    productsGrid.innerHTML = `
      <div class="note err">
        Eroare refresh: <code>${escapeHtml(e?.message || String(e))}</code>
      </div>
    `;
  }
});

// ------- Routing --------
async function routeAfterAuth(user) {
  if (!user) {
    btnLogout.hidden = true;
    setSessionLabel(null, null);
    showOnly(screenLogin);
    return;
  }

  btnLogout.hidden = false;

  // Ensure profile exists
  await ensureUserProfile(user);

  // Load profile
  const profile = await getUserProfile(user.uid);
  setSessionLabel(user, profile);

  // Contact gate
  const hasContact =
    !!profile?.contact?.fullName &&
    !!profile?.contact?.address &&
    !!profile?.contact?.county &&
    !!profile?.contact?.city;

  if (!hasContact) {
    // prefill if any
    fullName.value = profile?.contact?.fullName || "";
    address.value = profile?.contact?.address || "";
    countySelect.value = profile?.contact?.county || "";
    cityInput.value = profile?.contact?.city || "";

    showOnly(screenContactGate);
    return;
  }

  showOnly(screenCatalog);
  await loadAndRenderCatalog(profile);
}

onAuthStateChanged(auth, async (user) => {
  showOnly(screenLoading);
  try {
    await routeAfterAuth(user);
  } catch (e) {
    // fallback
    showOnly(screenLogin);
    clearNote(loginMsg);
    showNote(loginMsg, e?.message || "Eroare la inițializare.", "err");
  }
});

// -------- helpers --------
function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
