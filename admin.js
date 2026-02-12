// admin.js (ROOT, lângă admin.html)
import { auth, db } from "./js/firebase.js";
import { normalizePhone, phoneToEmail } from "./js/auth.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

$("btnLogin").onclick = async () => {
  $("err").textContent = "";

  const phone = normalizePhone($("phone").value);
  const pass = $("pass").value;

  if (!phone || phone.length < 9) return ($("err").textContent = "Telefon invalid.");
  if (!pass || pass.length < 6) return ($("err").textContent = "Parola minim 6 caractere.");

  const email = phoneToEmail(phone); // IMPORTANT: folosește exact domeniul din app (phone.local)

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    $("err").textContent = e?.message || "Eroare login";
  }
};

$("btnLogout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (u) => {
  $("me").textContent = "";
  $("pending").innerHTML = "";
  $("active").innerHTML = "";
  $("err").textContent = "";

  if (!u) return;

  // Verifică dacă e admin
  const meRef = doc(db, "users", u.uid);
  const meSnap = await getDoc(meRef);
  const me = meSnap.exists() ? meSnap.data() : null;

  $("me").innerHTML = `<small>UID: ${u.uid}</small><br><b>role:</b> ${me?.role || "(lipsește)"} | <b>status:</b> ${me?.status || "(lipsește)"}`;

  if (me?.role !== "admin") {
    $("err").textContent = "Nu ești admin. Setează în Firestore: users/{uid}.role = 'admin'.";
    return;
  }

  await loadUsers();
});

async function loadUsers() {
  // Pending
  const qPend = query(collection(db, "users"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
  const pendSnap = await getDocs(qPend);
  $("pending").innerHTML = pendSnap.size ? "" : "<small>Nimic pending.</small>";
  pendSnap.forEach((s) => $("pending").appendChild(renderUserCard(s.id, s.data(), true)));

  // Active
  const qAct = query(collection(db, "users"), where("status", "==", "active"), orderBy("createdAt", "desc"));
  const actSnap = await getDocs(qAct);
  $("active").innerHTML = actSnap.size ? "" : "<small>Nimic active.</small>";
  actSnap.forEach((s) => $("active").appendChild(renderUserCard(s.id, s.data(), false)));
}

function renderUserCard(uid, u, isPending) {
  const div = document.createElement("div");
  div.className = "card";

  // Prefill safe
  const clientType = u?.clientType || "tip1";
  const channel = u?.channel || "internet";
  const globalMarkup = Number(u?.priceRules?.globalMarkup ?? 0);

  div.innerHTML = `
    <b>${u.phone || "(fără phone)"} </b> <small>(${uid})</small><br>
    <small>status: ${u.status || "-"} | tip: ${u.clientType || "-"} | canal: ${u.channel || "-"}</small>
    <br><br>

    <div class="row">
      <label>Tip client:
        <select class="clientType">
          <option value="tip1">Tip 1</option>
          <option value="tip2">Tip 2</option>
          <option value="tip3">Tip 3</option>
        </select>
      </label>

      <label>Canal:
        <select class="channel">
          <option value="internet">Internet</option>
          <option value="gasit_de_mine">Găsit de mine</option>
          <option value="recomandare_crescator">Recomandare (crescător)</option>
          <option value="alt_crescator">Alt crescător</option>
        </select>
      </label>

      <label>Adaos global (%):
        <input class="globalMarkup" type="number" step="0.01" />
      </label>

      ${isPending ? `<button class="approve">Aprobă</button>` : `<button class="deactivate">Trece în pending</button>`}
    </div>

    <div class="card" style="background:#fafafa">
      <b>Adaos pe categorie (override)</b><br>
      <small>Dacă nu există override, se aplică adaosul global.</small>
      <div class="row" style="margin-top:8px">
        <input class="catId" placeholder="categoryId (ex: hrana-profesionala)" />
        <input class="catMarkup" type="number" step="0.01" placeholder="% categorie" />
        <button class="setCat">Setează/Actualizează</button>
        <button class="delCat">Șterge override</button>
      </div>
      <div class="catList" style="margin-top:8px"></div>
    </div>
  `;

  // set initial values
  div.querySelector(".clientType").value = clientType;
  div.querySelector(".channel").value = channel;
  div.querySelector(".globalMarkup").value = String(globalMarkup);

  // Render existing category overrides
  renderCatList(div, u?.priceRules?.categories || {});

  // actions
  const readForm = () => ({
    clientType: div.querySelector(".clientType").value,
    channel: div.querySelector(".channel").value,
    globalMarkup: Number(div.querySelector(".globalMarkup").value || 0),
  });

  if (isPending) {
    div.querySelector(".approve").onclick = async () => {
      const f = readForm();
      await updateDoc(doc(db, "users", uid), {
        status: "active",
        clientType: f.clientType,
        channel: f.channel,
        priceRules: {
          globalMarkup: f.globalMarkup,
          categories: u?.priceRules?.categories || {}
        },
        updatedAt: serverTimestamp()
      });
      await loadUsers();
    };
  } else {
    div.querySelector(".deactivate").onclick = async () => {
      await updateDoc(doc(db, "users", uid), { status: "pending", updatedAt: serverTimestamp() });
      await loadUsers();
    };
  }

  // Category override set/delete
  div.querySelector(".setCat").onclick = async () => {
    const catId = (div.querySelector(".catId").value || "").trim();
    const markup = Number(div.querySelector(".catMarkup").value || 0);
    if (!catId) return alert("Scrie categoryId.");

    await updateDoc(doc(db, "users", uid), {
      [`priceRules.categories.${catId}`]: markup,
      updatedAt: serverTimestamp()
    });
    // reload to refresh list
    await loadUsers();
  };

  div.querySelector(".delCat").onclick = async () => {
    const catId = (div.querySelector(".catId").value || "").trim();
    if (!catId) return alert("Scrie categoryId.");

    // Firestore: delete field
    const { deleteField } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    await updateDoc(doc(db, "users", uid), {
      [`priceRules.categories.${catId}`]: deleteField(),
      updatedAt: serverTimestamp()
    });
    await loadUsers();
  };

  return div;
}

function renderCatList(div, categoriesObj) {
  const list = div.querySelector(".catList");
  const entries = Object.entries(categoriesObj || {});
  if (!entries.length) {
    list.innerHTML = "<small>(fără override pe categorii)</small>";
    return;
  }
  list.innerHTML = entries
    .map(([k, v]) => `<small><b>${k}</b>: ${Number(v)}%</small>`)
    .join("<br>");
}
