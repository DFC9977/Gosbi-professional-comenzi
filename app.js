import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAO-ARS_5u7nG8EOKNl6yILeoILbleeuo4",
  authDomain: "gosbiromania.firebaseapp.com",
  projectId: "gosbiromania",
  storageBucket: "gosbiromania.firebasestorage.app",
  messagingSenderId: "885972653346",
  appId: "1:885972653346:web:76fda6a5435050e432017b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI
const authCard = document.getElementById("authCard");
const appCard = document.getElementById("appCard");
const btnLogout = document.getElementById("btnLogout");
const subTitle = document.getElementById("subTitle");

const inpPhone = document.getElementById("phone");
const inpPass = document.getElementById("pass");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const authMsg = document.getElementById("authMsg");

const who = document.getElementById("who");
const roleEl = document.getElementById("role");
const statusEl = document.getElementById("status");
const catalogList = document.getElementById("catalogList");

// Helpers
function showMsg(text) {
  authMsg.style.display = "block";
  authMsg.textContent = text;
}

function hideMsg() {
  authMsg.style.display = "none";
  authMsg.textContent = "";
}

function normalizePhone(raw) {
  const p = (raw || "").replace(/\s+/g, "");
  // acceptam doar format simplu pentru v1: 07xxxxxxxx (10 cifre)
  if (!/^07\d{8}$/.test(p)) return null;
  return p;
}

function phoneToEmail(phone) {
  // email "mascat" pentru a folosi Email/Password fara email real
  return `${phone}@app.local`;
}

async function getOrCreateUserProfile(uid, phone) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return snap.data();

  const profile = {
    phone,
    role: "client",
    status: "pending",
    channel: null, // admin il seteaza ulterior: partener/online/direct
    createdAt: Date.now(),
    profile: {
      fullName: "",
      address: {
        street: "",
        no: "",
        block: "",
        stair: "",
        apt: "",
        city: "",
        county: "",
        notes: "",
      },
    },
  };

  await setDoc(ref, profile, { merge: true });
  return profile;
}

function renderCatalog(isActive) {
  // Demo catalog local (pasul urmator va citi din Firestore)
  const demo = [
    { id: "p1", name: "Produs 2kg", desc: "Descriere expandabila (demo). Ambalaj 2kg." , price: 35 },
    { id: "p2", name: "Produs 5kg", desc: "Descriere expandabila (demo). Ambalaj 5kg." , price: 79 },
    { id: "p3", name: "Produs 12kg", desc: "Descriere expandabila (demo). Ambalaj 12kg.", price: 169 },
  ];

  catalogList.innerHTML = "";
  for (const p of demo) {
    const card = document.createElement("div");
    card.className = "pcard";

    const name = document.createElement("div");
    name.className = "pname";
    name.textContent = p.name;

    // descriere expandabila simpla: click pe descriere
    const desc = document.createElement("details");
    desc.style.marginTop = "6px";

    const sum = document.createElement("summary");
    sum.style.cursor = "pointer";
    sum.textContent = "Detalii";

    const body = document.createElement("div");
    body.className = "pdesc";
    body.textContent = p.desc;

    desc.appendChild(sum);
    desc.appendChild(body);

    const price = document.createElement("div");
    price.className = "pprice " + (isActive ? "" : "lock");
    price.textContent = isActive ? `Pret: ${p.price} lei (TVA inclus)` : "Pret: (disponibil dupa aprobare)";

    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(price);

    catalogList.appendChild(card);
  }
}

// Actions
btnRegister.addEventListener("click", async () => {
  hideMsg();

  const phone = normalizePhone(inpPhone.value);
  const pass = (inpPass.value || "").trim();

  if (!phone) return showMsg("Telefon invalid. Foloseste formatul 07xxxxxxxx.");
  if (pass.length < 6) return showMsg("Parola prea scurta. Minim 6 caractere.");

  try {
    const email = phoneToEmail(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    await getOrCreateUserProfile(cred.user.uid, phone);

    showMsg("Cont creat. Este in asteptare pana il valideaza admin.");
  } catch (e) {
    console.error(e);
    if (e.code === "auth/email-already-in-use") {
      showMsg("Exista deja un cont cu acest telefon. Foloseste Intra.");
    } else {
      showMsg("Eroare la creare cont: " + (e.message || e.code));
    }
  }
});

btnLogin.addEventListener("click", async () => {
  hideMsg();

  const phone = normalizePhone(inpPhone.value);
  const pass = (inpPass.value || "").trim();

  if (!phone) return showMsg("Telefon invalid. Foloseste formatul 07xxxxxxxx.");
  if (!pass) return showMsg("Introdu parola.");

  try {
    const email = phoneToEmail(phone);
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    console.error(e);
    showMsg("Login esuat: verifica telefonul si parola.");
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// State
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // logged out
    authCard.style.display = "block";
    appCard.style.display = "none";
    btnLogout.style.display = "none";
    subTitle.textContent = "Autentificare (Pasul 3)";
    return;
  }

  btnLogout.style.display = "inline-block";
  authCard.style.display = "none";
  appCard.style.display = "block";
  subTitle.textContent = "Cont conectat";

  // profile in Firestore
  // incercam sa extragem telefonul din email-ul mascat
  const phone = (user.email || "").replace("@app.local", "");
  const profile = await getOrCreateUserProfile(user.uid, phone);

  who.textContent = profile.phone || "(telefon)";
  roleEl.textContent = profile.role || "client";

  const isActive = profile.status === "active";
  statusEl.classList.remove("ok", "warn", "bad");
  statusEl.classList.add(isActive ? "ok" : "warn");
  statusEl.textContent = profile.status || "pending";

  renderCatalog(isActive);
});
