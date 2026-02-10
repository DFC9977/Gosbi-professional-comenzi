import { db } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * EXEMPLE (înlocuiește cu lista ta completă)
 * Structura e intenționat simplă.
 */
const COUNTY_CITY = {
  "Cluj": ["Cluj-Napoca", "Turda", "Dej"],
  "Bihor": ["Oradea", "Salonta", "Marghita"],
  "Satu Mare": ["Satu Mare", "Carei", "Negrești-Oaș"],
  "Sălaj": ["Zalău", "Șimleu Silvaniei", "Jibou"]
};

export function fillCountyOptions(countySelect) {
  const counties = Object.keys(COUNTY_CITY).sort((a,b)=>a.localeCompare(b,"ro"));
  for (const c of counties) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countySelect.appendChild(opt);
  }
}

export function fillCityOptions(citySelect, county) {
  citySelect.innerHTML = `<option value="">Selectează localitate</option>`;
  const cities = COUNTY_CITY[county] || [];
  for (const city of cities) {
    const opt = document.createElement("option");
    opt.value = city;
    opt.textContent = city;
    citySelect.appendChild(opt);
  }
  citySelect.disabled = !county || cities.length === 0;
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export function isContactComplete(profile) {
  return Boolean(profile?.contact?.completed === true);
}

export async function saveContact(uid, payload) {
  const { fullName, address, county, city } = payload;

  if (!fullName || fullName.trim().length < 3) throw new Error("Completează numele complet.");
  if (!address || address.trim().length < 6) throw new Error("Completează adresa completă.");
  if (!county) throw new Error("Selectează județul.");
  if (!city) throw new Error("Selectează localitatea.");

  const ref = doc(db, "users", uid);

  await setDoc(ref, {
    contact: {
      fullName: fullName.trim(),
      address: address.trim(),
      county,
      city,
      completed: true,
      completedAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  return true;
}
