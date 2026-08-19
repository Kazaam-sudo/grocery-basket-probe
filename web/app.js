const EXAMPLE_BASKET = [
  "молоко 2,5% 1 л",
  "бананы 1 кг",
  "яйца 10 шт",
  "хлеб белый",
  "макароны 500 г",
  "масло сливочное 180 г",
  "кофе молотый 250 г",
  "туалетная бумага 8 рулонов",
];

const state = { snapshot: null, selectedAddress: null, basketLines: [], quote: null };

const $ = (selector) => document.querySelector(selector);

function normalize(value) {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^а-яa-z0-9]+/g, " ")
    .trim();
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatSnapshotTime(value) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function parseBasket() {
  return $("#basket-input").value.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
}

function updateCount() {
  const count = parseBasket().length;
  $("#basket-count").textContent = `${count} ${count === 1 ? "позиция" : count < 5 ? "позиции" : "позиций"}`;
}

function findOffer(retailer, line) {
  const query = normalize(line);
  return retailer.items.find((item) => item.aliases.some((alias) => query.includes(normalize(alias)) || normalize(alias).includes(query)));
}

function buildQuote(lines) {
  return state.snapshot.retailers.map((retailer) => {
    const items = lines.map((query) => ({ query, offer: findOffer(retailer, query) }));
    const found = items.filter(({ offer }) => offer?.available !== false && offer?.price != null);
    return {
      ...retailer,
      items,
      foundCount: found.length,
      total: found.reduce((sum, { offer }) => sum + offer.price, 0),
      coverage: lines.length ? found.length / lines.length : 0,
    };
  });
}

function renderRetailers() {
  const sorted = [...state.quote].sort((a, b) => b.coverage - a.coverage || a.total - b.total);
  const best = sorted.find((retailer) => retailer.foundCount > 0);
  $("#recommendation").innerHTML = best
    ? `<span><strong>Предварительный выбор:</strong> ${best.name} покрывает ${best.foundCount} из ${state.basketLines.length} позиций.</span><span>Сборы и доставка: <strong>неизвестны</strong></span>`
    : `<span><strong>Не удалось найти позиции.</strong> Попробуйте более короткие названия.</span>`;

  $("#retailer-grid").innerHTML = state.quote.map((retailer) => {
    const isRecommended = retailer.id === best?.id;
    const status = retailer.coverage === 1 ? "Все позиции найдены" : `${retailer.foundCount} из ${state.basketLines.length} найдены`;
    return `<article class="retailer-card ${isRecommended ? "is-recommended" : ""}">
      <div class="retailer-top"><div><h3 class="retailer-name">${retailer.name}</h3><p class="retailer-subtitle">${retailer.subtitle}</p></div><span class="card-status ${retailer.coverage < 1 ? "warning" : ""}">${status}</span></div>
      <div class="retailer-total">${formatMoney(retailer.total)}<small>товары</small></div>
      <div class="card-meta"><span>Покрытие: ${Math.round(retailer.coverage * 100)}%</span><span>Снимок: ${formatSnapshotTime(state.snapshot.generated_at)}</span></div>
      <div class="card-actions"><a class="primary-button" href="${retailer.public_url}" target="_blank" rel="noreferrer">Открыть сайт ↗</a><button class="secondary-button" type="button" data-retailer="${retailer.id}">Список</button></div>
    </article>`;
  }).join("");

  $("#retailer-grid").querySelectorAll("button[data-retailer]").forEach((button) => {
    button.addEventListener("click", () => copyRetailerList(button.dataset.retailer));
  });
}

function renderItemsTable() {
  const retailers = state.quote;
  const rows = state.basketLines.map((query) => {
    const offers = retailers.map((retailer) => retailer.items.find((item) => item.query === query)?.offer);
    const primaryOffer = offers.find(Boolean);
    const status = offers.some((offer) => offer?.available !== false && offer?.price != null)
      ? (offers.every((offer) => offer?.available !== false && offer?.price != null) ? ["все сети", ""] : ["частично", "warning"])
      : ["не найдено", "danger"];
    return `<tr><td><strong>${escapeHtml(query)}</strong></td><td>${escapeHtml(primaryOffer?.pack || "—")}</td>${offers.map((offer) => `<td class="price-cell ${offer?.available === false || offer?.price == null ? "unavailable" : ""}">${offer?.available === false ? "нет" : formatMoney(offer?.price)}</td>`).join("")}<td><span class="item-status ${status[1]}">${status[0]}</span></td></tr>`;
  });
  $("#items-table-body").innerHTML = rows.join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function renderResults() {
  state.basketLines = parseBasket();
  if (!state.basketLines.length) {
    $("#data-status").textContent = "Добавьте хотя бы один товар";
    $("#basket-input").focus();
    return;
  }
  state.quote = buildQuote(state.basketLines);
  const address = state.snapshot.addresses.find((item) => item.id === state.selectedAddress);
  $("#results-context").textContent = `${address.label} · ${state.basketLines.length} позиций · цены без персональных скидок`;
  renderRetailers();
  renderItemsTable();
  $("#results-section").classList.remove("hidden");
  $("#data-status").textContent = "Расчёт готов по последнему демо-снимку";
  window.scrollTo({ top: $("#results-section").offsetTop - 20, behavior: "smooth" });
}

function listText(retailer) {
  return retailer.items.filter(({ offer }) => offer?.available !== false && offer?.price != null).map(({ query, offer }) => `${query} — ${offer.name}, ${offer.pack}`).join("\n");
}

function copyRetailerList(retailerId) {
  const retailer = state.quote.find((item) => item.id === retailerId);
  if (!retailer) return;
  navigator.clipboard?.writeText(listText(retailer));
  $("#data-status").textContent = `Список для ${retailer.name} скопирован`;
}

function downloadCsv() {
  const header = ["запрос", ...state.quote.map((retailer) => retailer.name), "упаковка"].join(";");
  const lines = state.basketLines.map((query) => {
    const offers = state.quote.map((retailer) => retailer.items.find((item) => item.query === query)?.offer);
    const pack = offers.find(Boolean)?.pack || "";
    return [query, ...offers.map((offer) => offer?.price ?? ""), pack].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";");
  });
  const blob = new Blob(["\ufeff" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "korzinka-comparison.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function init() {
  try {
    const response = await fetch("./data/demo-quotes.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.snapshot = await response.json();
    state.selectedAddress = state.snapshot.addresses[0].id;
    $("#address-select").innerHTML = state.snapshot.addresses.map((address) => `<option value="${address.id}">${address.label}</option>`).join("");
    $("#snapshot-time").textContent = formatSnapshotTime(state.snapshot.generated_at);
    $("#data-status").textContent = "Демо-снимок готов · live-источники не подключены";
    $("#basket-input").addEventListener("input", updateCount);
    $("#address-select").addEventListener("change", (event) => { state.selectedAddress = event.target.value; });
    $("#load-example").addEventListener("click", () => { $("#basket-input").value = EXAMPLE_BASKET.join("\n"); updateCount(); });
    $("#compare-button").addEventListener("click", renderResults);
    $("#reset-button").addEventListener("click", () => { $("#results-section").classList.add("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); });
    $("#copy-list-button").addEventListener("click", () => copyRetailerList(state.quote?.[0]?.id));
    $("#download-button").addEventListener("click", downloadCsv);
    $("#basket-input").value = EXAMPLE_BASKET.slice(0, 3).join("\n");
    updateCount();
  } catch (error) {
    $("#data-status").textContent = `Не удалось загрузить снимок: ${error.message}`;
  }
}

init();
