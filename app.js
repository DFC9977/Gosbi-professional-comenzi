// PASUL 2: conectare simpla la Firebase (fara login inca).
// Folosim CDN + ES modules. Nu folosim npm.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Config-ul tau Firebase (OK sa fie in frontend)
const firebaseConfig = {
  apiKey: "AIzaSyAO-ARS_5u7nG8EOKNl6yILeoILbleeuo4",
  authDomain: "gosbiromania.firebaseapp.com",
  projectId: "gosbiromania",
  storageBucket: "gosbiromania.firebasestorage.app",
  messagingSenderId: "885972653346",
  appId: "1:885972653346:web:76fda6a5435050e432017b",
};

const elStatus = document.getElementById("fbStatus");
const elProject = document.getElementById("fbProject");
const elAuthDomain = document.getElementById("fbAuthDomain");

function setStatus(type, text) {
  elStatus.classList.remove("ok", "warn", "bad");
  elStatus.classList.add(type);
  elStatus.textContent = text;
}

try {
  const app = initializeApp(firebaseConfig);

  // doar initializam Auth ca test (nu facem login in pasul 2)
  getAuth(app);

  elProject.textContent = firebaseConfig.projectId || "(lipsa)";
  elAuthDomain.textContent = firebaseConfig.authDomain || "(lipsa)";
  setStatus("ok", "Connected ✅");

  console.log("[Firebase] Connected:", firebaseConfig.projectId);
} catch (err) {
  console.error("[Firebase] ERROR:", err);
  setStatus("bad", "Error ❌ (verifica firebaseConfig)");
  elProject.textContent = "—";
  elAuthDomain.textContent = "—";
}
