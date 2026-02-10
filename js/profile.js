import { db } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const COUNTIES = [
  "Alba","Arad","Argeș","Bacău","Bihor","Bistrița-Năsăud","Botoșani","Brăila","Brașov","București",
  "Buzău","Caraș-Severin","Călărași","Cluj","Constanța","Covasna","Dâmbovița","Dolj","Galați","Giurgiu",
  "Gorj","Harghita","Hunedoara","Ialomița","Iași","Ilfov","Maramureș","Mehedinți","Mureș","Neamț",
  "Olt","Prahova","Satu Mare","Sălaj","Sibiu","Suceava","Teleorman","Timiș","Tulcea","Vâlcea","Vaslui","Vrancea"
];

const COUNTY_CITIES = {
  "București": ["București"],
  "Cluj": ["Cluj-Napoca","Turda","Dej"],
  "Bihor": ["Oradea","Salonta","Marghita"],
  "Satu Mare": ["Satu Mare","Carei","Negrești-Oaș"],
  "Sălaj": ["Zalău","Șimleu Silvaniei","Jibou"],
  "Timiș": ["Timișoara","Lugoj","Sânnicolau Mare"],
  "Iași": ["Iași","Pașcani","Hârlău"],
  "Constanța": ["Constanța","Mangalia","Medgidia"]
};

export function fillCountyOptions(countySelect) {
  for (const c of COUNTIES) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    countySelect.appendChild(opt);
  }
}

export function fillCityDatalist(cityListEl, county) {
  cityListEl.innerHTML = "";
  const cities = COUNTY_CITIES[county] || [];
  for (const city of cities) {
    const opt = document.createElement("option");
    opt.value = city;
    cityListEl.appendChild(opt);
  }
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

  if (!fullName || fullName.trim().length < 3) throw new Error("Completează numele.");
  if (!address || address.trim().length < 6) throw new Error("Completează adresa.");
  if (!county) throw new Error("Selectează județul.");
  if (!city || city.trim().length < 2) throw new Error("Completează localitatea.");

  const ref = doc(db, "users", uid);

  await setDoc(ref, {
    contact: {
      fullName: fullName.trim(),
      address: address.trim(),
      county,
      city: city.trim(),
      completed: true,
      completedAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  return true;
}
