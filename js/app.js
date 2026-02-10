// js/app.js
import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { getProfile, saveContact } from "./profile.js";
import { loadProducts, renderProducts } from "./catalog.js";

/* ---------------- UI refs ---------------- */
const screenLoading = document.getElementById("screenLoading");
const screenLogin = document.getElementById("screenLogin");
const screenContactGate = document.getElementById("screenContactGate");
const screenCatalog = document.getElementById("screenCatalog");

const sessionInfo = document.getElementById("sessionInfo");
const btnLogout = document.getElementById("btnLogout");

const loginPhone = document.getElementById("loginPhone");
const loginPass = document.getElementById("loginPass");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const loginMsg = document.getElementById("loginMsg");

const fullName = document.getElementById("fullName");
const address = document.getElementById("address");
const countySelect = document.getElementById("countySelect");

// IMPORTANT: acum ai INPUT + DATALIST (nu SELECT)
const cityInput = document.getElementById("cityInput");
const cityList = document.getElementById("cityList");

const btnSaveContact = document.getElementById("btnSaveContact");
const btnBackToLogin = document.getElementById("btnBackToLogin");
const contactMsg = document.getElementById("contactMsg");

const productsGrid = document.getElementById("productsGrid");
const catalogHint = document.getElementById("catalogHint");
const btnRefreshProducts = document.getElementById("btnRefreshProducts");

/* ---------------- helpers ---------------- */
function showOnly(el) {
  [screenLoading, screenLogin, screenContactGate, screenCatalog].forEach((x) => {
    if (!x) return;
    x.hidden = x !== el;
  });
}

function showNote(node, text, kind = "ok") {
  if (!node) return;
  node.textContent = text;
  node.hidden = false;
  node.classList.remove("ok", "err");
  node.classList.add(kind);
}

function clearNote(node) {
  if (!node) return;
  node.hidden = true;
  node.textContent = "";
  node.classList.remove("ok", "err");
}

function toPhoneEmail(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) throw new Error("Introdu un număr de telefon.");
  return `${digits}@phone.local`;
}

function fillCountyOptions(selectEl) {
  if (!selectEl) return;
  const counties = [
    "Alba","Arad","Argeș","Bacău","Bihor","Bistrița-Năsăud","Botoșani","Brașov","Brăila","București",
    "Buzău","Caraș-Severin","Călărași","Cluj","Constanța","Covasna","Dâmbovița","Dolj","Galați","Giurgiu",
    "Gorj","Harghita","Hunedoara","Ialomița","Iași","Ilfov","Maramureș","Mehedinți","Mureș","Neamț",
    "Olt","Prahova","Satu Mare","Sălaj","Sibiu","Suceava","Teleorman","Timiș","Tulcea","Vaslui",
    "Vâlcea","Vrancea"
  ];

  // dacă e deja populat, nu mai duplicăm
  if (selectEl.options.length > 1) return;

  counties.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    selectEl.appendChild(opt);
  });
}

function fillCityDatalist(_datalistEl, _county) {
  // Dacă vrei listă completă de localități pe județe, o facem mâine.
  // Momentan inputul rămâne liber + activat după județ.
  if (!_datalistEl) return;
  _datalistEl.innerHTML = "";
}

/* ---------------- app flow ---------------- */
fillCountyOptions(countySelect);

// activează localitatea după județ
if (countySelect) {
  countySelect.addEventListener("change", () => {
    const county = countySelect.value || "";
    fillCityDatalist(cityList, county);
    if (cityInput) {
      cityInput.disabled = !county;
      if (!county) cityInput.value = "";
    }
  });
}

btnBackToLogin?.addEventListener("click", () => {
  clearNote(contactMsg);
  showOnly(screenLogin);
});

btnLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (e) {
    // chiar dacă dă eroare, UI se va actualiza din onAuthStateChanged
    console.error(e);
  }
});

btnLogin?.addEventListener("click", async () => {
  clearNote(loginMsg);
  try {
    btnLogin.disabled = true;
    btnRegister.disabled = true;

    const email = toPhoneEmail(loginPhone.value);
    const pass = String(loginPass.value || "");
    if (!pass) throw new Error("Introdu parola.");

    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged continuă flow-ul
  } catch (e) {
    showNote(loginMsg, e?.message || "Eroare la login.", "err");
  } finally {
    btnLogin.disabled = false;
    btnRegister.disabled = false;
  }
});

btnRegister?.addEventListener("click", async () => {
  clearNote(loginMsg);
  try {
    btnLogin.disabled = true;
    btnRegister.disabled = true;

    const email = toPhoneEmail(loginPhone.value);
    const pass = String(loginPass.value || "");
    if (pass.length < 6) throw new Error("Parola trebuie să aibă minim 6 caractere.");

    await createUserWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged continuă flow-ul
  } catch (e) {
    showNote(loginMsg, e?.message || "Eroare la creare cont.", "err");
  } finally {
    btnLogin.disabled = false;
    btnRegister.disabled = false;
  }
});

btnSaveContact?.addEventListener("click", async () => {
  clearNote(contactMsg);
  try {
    btnSaveContact.disabled = true;

    const u = auth.currentUser;
    if (!u) throw new Error("Sesiune invalidă. Reautentifică-te.");

    const payload = {
      fullName: String(fullName?.value || "").trim(),
      address: String(address?.value || "").trim(),
      county: String(countySelect?.value || "").trim(),
      city: String(cityInput?.value || "").trim(),
    };

    if (!payload.fullName) throw new Error("Completează numele complet.");
    if (!payload.address) throw new Error("Completează adresa completă.");
    if (!payload.county) throw new Error("Alege județul.");
    if (!payload.city) throw new Error("Completează localitatea.");

    await saveContact(u.uid, payload);

    showNote(contactMsg, "Date salvate. Se deschide catalogul…", "ok");
    await routeAfterAuth(u); // du-l mai departe
  } catch (e) {
    showNote(contactMsg, e?.message || "Eroare la salvare.", "err");
  } finally {
    btnSaveContact.disabled = false;
  }
});

btnRefreshProducts?.addEventListener("click", async () => {
  const u = auth.currentUser;
  if (!u) return;
  await showCatalog(u);
});

async function routeAfterAuth(user) {
  // IMPORTANT: pentru user null -> login (fără Firestore)
  if (!user) {
    sessionInfo.textContent = "Neautentificat";
    btnLogout.hidden = true;
    showOnly(screenLogin);
    return;
  }

  sessionInfo.textContent = "Autentificat";
  btnLogout.hidden = false;

  // de aici încolo putem folosi Firestore (suntem logați)
  let profile;
  try {
    profile = await getProfile(user.uid);
  } catch (e) {
    // dacă profilul nu se poate citi, nu bloca: arată o eroare + buton logout
    console.error(e);
    showOnly(screenLogin);
    showNote(loginMsg, e?.message || "Nu pot citi profilul din Firestore (rules?).", "err");
    return;
  }

  const contact = profile?.contact || {};
  const needsContact =
    !contact.fullName || !contact.address || !contact.county || !contact.city;

  if (needsContact) {
    // prefill dacă există
    if (fullName) fullName.value = contact.fullName || "";
    if (address) address.value = contact.address || "";

    const county = contact.county || "";
    if (countySelect) {
      fillCountyOptions(countySelect);
      countySelect.value = county;
    }

    if (cityInput) {
      cityInput.disabled = !county;
      if (county) fillCityDatalist(cityList, county);
      cityInput.value = contact.city || "";
    }

    showOnly(screenContactGate);
    return;
  }

  await showCatalog(user);
}

async function showCatalog(user) {
  clearNote(loginMsg);
  clearNote(contactMsg);

  showOnly(screenCatalog);

  let profile;
  try {
    profile = await getProfile(user.uid);
  } catch (e) {
    console.error(e);
    showNote(
      catalogHint,
      e?.message || "Nu pot citi profilul (rules / conexiune).",
      "err"
    );
    return;
  }

  const status = profile?.status || "pending";
  const canSeePrices = status === "active";

  catalogHint.textContent =
    status === "active"
      ? "Ești activ. Vezi prețurile."
      : "Ești în așteptare (pending). Vezi catalog fără prețuri.";

  try {
    const items = await loadProducts();
    renderProducts(productsGrid, items, { showPrices: canSeePrices });
  } catch (e) {
    console.error(e);
    // nu blocăm UI
    productsGrid.innerHTML = `<div class="note err">Nu pot încărca produsele (rules / conexiune / index). ${escapeHtml(e?.message || "")}</div>`;
  }
}

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------- boot ---------------- */
showOnly(screenLoading);

onAuthStateChanged(auth, async (user) => {
  try {
    await routeAfterAuth(user);
  } catch (e) {
    console.error(e);
    // fallback: nu rămâne pe loading
    showOnly(screenLogin);
    showNote(loginMsg, e?.message || "Eroare neașteptată în aplicație.", "err");
  }
});
