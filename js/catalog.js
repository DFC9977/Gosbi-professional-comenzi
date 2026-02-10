export function renderCatalog(container, { canSeePrices, canOrder }) {
  const demoProducts = [
    {
      name: "Gosbi Adult Mini 2kg",
      img: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=60",
      desc: "Hrană uscată pentru câini talie mică."
    },
    {
      name: "Gosbi Adult Medium 12kg",
      img: "https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=60",
      desc: "Hrană uscată pentru câini talie medie."
    },
    {
      name: "Gosbi Cat Adult 2kg",
      img: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=60",
      desc: "Hrană uscată pentru pisici adulte."
    },
    {
      name: "Gosbi Puppy 5kg",
      img: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=900&q=60",
      desc: "Hrană uscată pentru pui."
    }
  ];

  container.innerHTML = "";

  for (const p of demoProducts) {
    const card = document.createElement("div");
    card.className = "product";

    const priceHtml = canSeePrices
      ? `<div class="pprice">Preț: (din Firestore în pasul următor)</div>`
      : `<div class="pprice muted">Prețuri vizibile doar pentru clienți activi</div>`;

    const orderHtml = canOrder
      ? `<button class="btn primary" style="margin-top:10px;width:100%;">Adaugă (pasul următor)</button>`
      : `<button class="btn" style="margin-top:10px;width:100%;" disabled>Comandă indisponibilă</button>`;

    card.innerHTML = `
      <img src="${p.img}" alt="${escapeHtml(p.name)}" />
      <div class="pbody">
        <div class="pname">${escapeHtml(p.name)}</div>
        <div class="pdesc">${escapeHtml(p.desc)}</div>
        ${priceHtml}
        ${orderHtml}
      </div>
    `;

    container.appendChild(card);
  }
}

function escapeHtml(s){
  return (s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
