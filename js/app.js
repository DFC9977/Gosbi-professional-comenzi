import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { loginWithPhone, registerWithPhone, logout } from "./auth.js";
import {
  fillCountyOptions,
  fillCityOptions,
  getUserProfile,
  isContactComplete,
  saveContact
} from "./profile.js";

import { renderCatalog } from "./catalog.js";

// Screens
const screenLoading = document.getElementById("screenLoading");
const screenLogin = document.getElementById("screenLogin");
const screenContactGate = document.getElementById("screenContactGate");
const screenCatalog = document.getElementById("screenCatalog");

// Header
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
const citySelect = document.getElementById("citySelect");
const btnSaveContact = document.getElementById("btnSaveContact");
const btnBackToLogin = document.getElementById("btnBackToLogin");
const contactMsg = document.getElementById("contactMsg");

// Catalog UI
const productsGrid = document.getElementById("productsGrid");
const catalogHint = document.getElementById("catalogHint");
const btnRefreshProducts = document.getElementById("btnRefreshProducts");

function showOnly(screen) {
  for (const el of [screenLoading, screenLogin, screenContactGate, screenCatalog]) {
    el.hidden = (el !== screen);
  }
}

function showNote(el, text, type) {
  el.hidden = false;
  el.textContent = text;
  el.className = `note ${type || ""}`.trim();
}
function hideNote(el) {
  el.hidden = true;
  el.textContent = "";
  el.className = "note";
}

// Populate selects
fillCountyOptions(countySelect);
countySelect.addEventListener("change", () => {
  fillCityOptions(citySelect, countySelect.value);
});

// Buttons
btnLogin.addEventListener("click", async () => {
  hideNote(loginMsg);
  try {
    btnLogin.disabled = true;
    await loginWithPhone(loginPhone.value, loginPass.value);
  } catch (e) {
    showNote(loginMsg, e.message || "Eroare la login.", "err");
  } finally {
    btnLogin.disabled = false;
  }
});

btnRegister.addEventListener("click", async () => {
  hideNote(loginMsg);
  try {
    btnRegister.disabled = true;
    await registerWithPhone(loginPhone.value, loginPass.value);
    showNote(loginMsg, "Cont creat. Status: pending (admin validează).", "ok");
  } catch (e) {
    showNote(loginMsg, e.message || "Eroare la creare cont.", "err");
  } finally {
    btnRegister.disabled = false;
  }
});

btnLogout.addEventListener("click", async () => {
  await logout();
});

btnBackToLogin.addEventListener("click", async () => {
  await logout();
});

btnSaveContact.addEventListener("click", async () => {
  hideNote(contactMsg);
  try {
    btnSaveContact.disabled = true;
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Sesiune invalidă. Reautentifică-te.");

    await saveContact(uid, {
      fullName: fullName.value,
      address: address.value,
      county: countySelect.value,
      city: citySelect.value
    });

    showNote(contactMsg, "Date salvate. Se deschide catalogul…", "ok");
    await routeAfterAuth(auth.currentUser);
  } catch (e) {
    showNote(contactMsg, e.message || "Eroare la salvare.", "err");
  } finally {
    btnSaveContact.disabled = false;
  }
});

btnRefreshProducts.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (user) await routeAfterAuth(user);
});

onAuthStateChanged(auth, async (user) => {
  hideNote(loginMsg);
  hideNote(contactMsg);

  if (!user) {
    sessionInfo.textContent = "Neautentificat";
    btnLogout.hidden = true;
    showOnly(screenLogin);
    return;
  }

  btnLogout.hidden = false;
  await routeAfterAuth(user);
});

async function routeAfterAuth(user) {
  showOnly(screenLoading);

  const profile = await getUserProfile(user.uid);
  const phone = profile?.phone || "";
  sessionInfo.textContent = phone ? `Autentificat: ${phone}` : `Autentificat`;

  // Gate 1: contact
  if (!isContactComplete(profile)) {
    // prefill dacă există parțial
    fullName.value = profile?.contact?.fullName || "";
    address.value = profile?.contact?.address || "";

    const county = profile?.contact?.county || "";
    countySelect.value = county;

    fillCityOptions(citySelect, county);
    const city = profile?.contact?.city || "";
    citySelect.value = city;

    showOnly(screenContactGate);
    return;
  }

  // Catalog access
  const isActive = profile?.status === "active";
  const canSeePrices = isActive;    // conform cerinței
  const canOrder = isActive;        // comanda în pasul următor

  catalogHint.textContent = isActive
    ? "Ești activ: vezi prețuri și poți comanda."
    : "Ești pending: vezi catalog fără prețuri și nu poți comanda (admin validează).";

  renderCatalog(productsGrid, { canSeePrices, canOrder });
  showOnly(screenCatalog);
}
