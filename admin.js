import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ PUNE CONFIGUL TĂU REAL (același ca în app)
const firebaseConfig = {
  apiKey: "AIzaSyAtAxHsqXRUMQa2pP2473lIng3NwP9lL-I",
  authDomain: "gosbiromania.firebaseapp.com",
  projectId: "gosbiromania",
  storageBucket: "gosbiromania.firebasestorage.app",
  messagingSenderId: "885972653346",
  appId: "1:885972653346:web:fa22097b6ba4ef5432017b"
};
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

$("btnLogin").onclick = async () => {
  $("err").textContent = "";
  const phone = $("phone").value.trim();
  const pass = $("pass").value;

  // login-ul tău e “telefon@app.local”
  const email = `${phone}@app.local`;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    $("err").textContent = e.message;
  }
};

$("btnLogout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (u) => {
  $("me").textContent = "";
  $("pending").innerHTML = "";
  $("active").innerHTML = "";
  if (!u) return;

  // Verifică dacă e admin
  const meRef = doc(db, "users", u.uid);
  const meSnap = await getDoc(meRef);
  const me = meSnap.exists() ? meSnap.data() : null;

  $("me").innerHTML = `<small>UID: ${u.uid}</small><br><b>role:</b> ${me?.role || "(lipsește)"} | <b>status:</b> ${me?.status || "(lipsește)"}`;

  if (me?.role !== "admin") {
    $("err").textContent = "Nu ești admin. Setează users/{uid}.role = 'admin'.";
    return;
  }

  await loadUsers();
});

async function loadUsers() {
  // Pending
  const qPend = query(collection(db, "users"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
  const pendSnap = await getDocs(qPend);
  $("pending").innerHTML = pendSnap.size ? "" : "<small>Nimic pending.</small>";

  pendSnap.forEach(s => $("pending").appendChild(renderUserCard(s.id, s.data(), true)));

  // Active
  const qAct = query(collection(db, "users"), where("status", "==", "active"), orderBy("createdAt", "desc"));
  const actSnap = await getDocs(qAct);
  $("active").innerHTML = actSnap.size ? "" : "<small>Nimic active.</small>";

  actSnap.forEach(s => $("active").appendChild(renderUserCard(s.id, s.data(), false)));
}

function renderUserCard(uid, u, isPending) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <b>${u.phone || "(fără phone)"} </b> <small>(${uid})</small><br>
    <small>status: ${u.status || "-"} | tier: ${u.priceTier || "-"} | channel: ${u.channel || "-"}</small><br><br>
    <div class="row">
      <select class="tier">
        <option value="PF">PF (+20%)</option>
        <option value="REVENZATOR">REVENZATOR (+10%)</option>
        <option value="VIP">VIP</option>
      </select>
      <input class="channel" placeholder="canal (ex WhatsApp, Agent, FB...)" />
      ${isPending ? `<button class="approve">Aprobă</button>` : `<button class="deactivate">Dezactivează</button>`}
    </div>
  `;

  // prefill
  div.querySelector(".tier").value = u.priceTier || "PF";
  div.querySelector(".channel").value = u.channel || "";

  if (isPending) {
    div.querySelector(".approve").onclick = async () => {
      await updateDoc(doc(db, "users", uid), {
        status: "active",
        priceTier: div.querySelector(".tier").value,
        channel: div.querySelector(".channel").value,
        updatedAt: serverTimestamp()
      });
      await loadUsers();
    };
  } else {
    div.querySelector(".deactivate").onclick = async () => {
      await updateDoc(doc(db, "users", uid), {
        status: "pending",
        updatedAt: serverTimestamp()
      });
      await loadUsers();
    };
  }

  return div;
}
