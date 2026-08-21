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

const state = { snapshot: null, selectedAddress: null, basketItems: [], quote: null };
const $ = (selector) => document.querySelector(selector);

function normalize(value) {
  return value.toLowerCase().replaceAll("ё", "е").replace(/[^а-яa-z0-9]+/g, " ").trim();
}

function extractPack(value) {
  const match = String(value || "").match(/\d+(?:[.,]\d+)?\s*(?:кг|г|л|мл|шт|рулон(?:а|ов)?)/i);
  return match ? match[0] : "";
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatSnapshotTime(value) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function pluralize(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function parseLines() {
  return $("#basket-input").value.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
}

function syncBasketFromTextarea() {
  const previous = new Map(state.basketItems.map((item) => [normalize(item.query), item]));
  const next = [];
  parseLines().forEach((query) => {
    const key = normalize(query);
    if (!key || next.some((item) => normalize(item.query) === key)) return;
    next.push(previous.get(key) || { id: `${Date.now()}-${Math.random()}`, query, brand: "", pack: extractPack(query), quantity: 1 });
  });
  state.basketItems = next;
  renderBasket();
}

function setTextareaFromItems() {
  $("#basket-input").value = state.basketItems.map((item) => item.query).join("\n");
}

function updateCount() {
  const itemCount = state.basketItems.length;
  const unitCount = state.basketItems.reduce((sum, item) => sum + item.quantity, 0);
  $("#basket-count").textContent = `${itemCount} ${pluralize(itemCount, "позиция", "позиции", "позиций")}`;
  $("#summary-item-count").textContent = itemCount;
  $("#summary-unit-count").textContent = unitCount;
}

function formatItemSpec(item) {
  const details = [item.brand, item.pack].filter(Boolean);
  return details.length ? details.join(" · ") : "бренд и упаковка не указаны";
}

function renderBasket() {
  updateCount();
  const container = $("#basket-items");
  if (!state.basketItems.length) {
    container.innerHTML = '<p class="basket-empty">Список пока пуст. Добавьте товар выше.</p>';
  } else {
    container.innerHTML = state.basketItems.map((item) => `<div class="basket-item" data-id="${item.id}">
      <div class="basket-item-name">${escapeHtml(item.query)}<span class="basket-item-sub">${escapeHtml(formatItemSpec(item))}</span><span class="basket-item-sub">количество можно изменить</span></div>
      <div class="quantity-control" aria-label="Количество: ${escapeHtml(item.query)}">
        <button type="button" data-action="decrease" aria-label="Уменьшить количество">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-action="increase" aria-label="Увеличить количество">+</button>
      </div>
      <button class="remove-item" type="button" data-action="remove" aria-label="Удалить ${escapeHtml(item.query)}">×</button>
    </div>`).join("");
  }

  const summary = $("#summary-items");
  if (!state.basketItems.length) {
    summary.innerHTML = '<p class="summary-empty">Добавьте первый товар — он появится здесь.</p>';
  } else {
    const preview = state.basketItems.slice(0, 5);
    summary.innerHTML = preview.map((item) => `<div class="summary-line"><span>${escapeHtml(item.query)}<small class="summary-line-spec">${escapeHtml(formatItemSpec(item))}</small></span><span>×${item.quantity}</span></div>`).join("") + (state.basketItems.length > preview.length ? `<p class="summary-more">ещё ${state.basketItems.length - preview.length}</p>` : "");
  }
}

function matchesTextConstraint(expected, actual) {
  const expectedValue = normalize(expected || "");
  const actualValue = normalize(actual || "");
  if (!expectedValue) return true;
  return Boolean(actualValue) && (actualValue === expectedValue || actualValue.includes(expectedValue));
}

function packSignature(value) {
  const raw = String(value || "").toLowerCase().replaceAll("ё", "е").replace(",", ".").trim();
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(кг|г|л|мл|шт|рулон(?:а|ов)?)/);
  if (!match) return normalize(raw);
  const amount = Number(match[1]);
  const unit = match[2];
  const conversions = { кг: ["g", 1000], г: ["g", 1], л: ["ml", 1000], мл: ["ml", 1], шт: ["count", 1], рулон: ["count", 1], рулона: ["count", 1], рулонов: ["count", 1] };
  const [canonicalUnit, multiplier] = conversions[unit];
  return `${Math.round(amount * multiplier * 1000) / 1000}:${canonicalUnit}`;
}

function matchesPackConstraint(expected, actual) {
  const expectedValue = String(expected || "").trim();
  if (!expectedValue) return true;
  const expectedSignature = packSignature(expectedValue);
  const actualSignature = packSignature(actual);
  return expectedSignature === actualSignature;
}

function findOffer(retailer, item) {
  const query = normalize(item.query);
  const candidates = retailer.items.filter((offer) => offer.aliases.some((alias) => query.includes(normalize(alias)) || normalize(alias).includes(query)));
  return candidates.find((offer) => matchesTextConstraint(item.brand, offer.brand) && matchesPackConstraint(item.pack, offer.pack)) || null;
}

function buildQuote(items) {
  return state.snapshot.retailers.map((retailer) => {
    const matchedItems = items.map((item) => ({ ...item, offer: findOffer(retailer, item) }));
    const found = matchedItems.filter(({ offer }) => offer?.available !== false && offer?.price != null);
    return {
      ...retailer,
      items: matchedItems,
      foundCount: found.length,
      unitCount: found.reduce((sum, item) => sum + item.quantity, 0),
      total: found.reduce((sum, item) => sum + item.offer.price * item.quantity, 0),
      coverage: items.length ? found.length / items.length : 0,
    };
  });
}

function renderRetailers() {
  const fullCoverage = state.quote.filter((retailer) => retailer.coverage === 1 && retailer.foundCount > 0);
  const best = [...(fullCoverage.length ? fullCoverage : state.quote)].sort((a, b) => b.coverage - a.coverage || a.total - b.total)[0];
  const itemCount = state.basketItems.length;
  $("#recommendation").innerHTML = best
    ? `<span><strong>${best.name}</strong> — ${best.coverage === 1 ? "все позиции найдены" : `нашли ${best.foundCount} из ${itemCount}`}. ${best.coverage === 1 ? "Сейчас это самый низкий ориентир." : "Уточните недостающие товары перед покупкой."}</span><span>Доставка и персональные скидки не учтены</span>`
    : `<span><strong>Не удалось найти позиции.</strong> Попробуйте более короткие названия.</span>`;

  $("#retailer-grid").innerHTML = state.quote.map((retailer) => {
    const isRecommended = retailer.id === best?.id;
    const status = retailer.coverage === 1 ? "Все позиции" : `${retailer.foundCount} из ${itemCount}`;
    return `<article class="retailer-card ${isRecommended ? "is-recommended" : ""}">
      <div class="retailer-top"><div><h3 class="retailer-name">${retailer.name}</h3><p class="retailer-subtitle">${retailer.subtitle}</p></div><span class="card-status ${retailer.coverage < 1 ? "warning" : ""}">${status}</span></div>
      <div class="retailer-total">${formatMoney(retailer.total)}<small>товары</small></div>
      <div class="card-meta"><span>Покрытие: ${Math.round(retailer.coverage * 100)}%</span><span>${retailer.unitCount} шт.</span></div>
      <div class="card-actions"><a class="primary-button" href="${retailer.public_url}" target="_blank" rel="noreferrer">Открыть сайт ↗</a><button class="secondary-button" type="button" data-retailer="${retailer.id}">Список</button></div>
    </article>`;
  }).join("");

  $("#retailer-grid").querySelectorAll("button[data-retailer]").forEach((button) => button.addEventListener("click", () => copyRetailerList(button.dataset.retailer)));
}

function renderItemsTable() {
  const rows = state.basketItems.map((item) => {
    const offers = state.quote.map((retailer) => retailer.items.find((match) => match.id === item.id)?.offer);
    const primaryOffer = offers.find(Boolean);
    const availableOffers = offers.filter((offer) => offer?.available !== false && offer?.price != null);
    const status = availableOffers.length === offers.length ? ["все сети", ""] : availableOffers.length ? ["частично", "warning"] : ["не найдено", "danger"];
    const brand = item.brand || primaryOffer?.brand || "—";
    const pack = item.pack || primaryOffer?.pack || "—";
    return `<tr><td><strong>${escapeHtml(item.query)}</strong></td><td>${escapeHtml(brand)}</td><td>${item.quantity}</td><td>${escapeHtml(pack)}</td>${offers.map((offer) => `<td class="price-cell ${offer?.available === false || offer?.price == null ? "unavailable" : ""}">${offer?.available === false ? "нет" : offer?.price != null ? formatMoney(offer.price * item.quantity) : "—"}</td>`).join("")}<td><span class="item-status ${status[1]}">${status[0]}</span></td></tr>`;
  });
  $("#items-table-body").innerHTML = rows.join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function renderResults() {
  if (!state.basketItems.length) {
    $("#data-status").textContent = "Добавьте хотя бы один товар";
    $("#quick-add-input").focus();
    return;
  }
  state.quote = buildQuote(state.basketItems);
  const address = state.snapshot.addresses.find((item) => item.id === state.selectedAddress);
  $("#results-context").textContent = `${address.label} · ${state.basketItems.length} позиций · цены без персональных скидок`;
  renderRetailers();
  renderItemsTable();
  $("#results-section").classList.remove("hidden");
  $("#data-status").textContent = "Расчёт готов по последнему демо-снимку";
  window.scrollTo({ top: $("#results-section").offsetTop - 18, behavior: "smooth" });
}

function listText(retailer) {
  return retailer.items.filter(({ offer }) => offer?.available !== false && offer?.price != null).map(({ query, offer, quantity }) => `${quantity > 1 ? `${quantity} × ` : ""}${query} — ${formatItemSpec({ brand: offer.brand, pack: offer.pack })}, ${offer.name}`).join("\n");
}

function copyRetailerList(retailerId) {
  const retailer = state.quote?.find((item) => item.id === retailerId);
  if (!retailer) return;
  navigator.clipboard?.writeText(listText(retailer));
  $("#data-status").textContent = `Список для ${retailer.name} скопирован`;
}

function addItems(raw, details = {}) {
  const additions = raw.split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (!additions.length) return;
  const existing = new Map(state.basketItems.map((item) => [normalize(item.query), item]));
  const singleItem = additions.length === 1;
  additions.forEach((query) => {
    const key = normalize(query);
    if (!key || state.basketItems.length >= 20) return;
    const previous = existing.get(key);
    if (previous) {
      if (singleItem) {
        previous.brand = details.brand || previous.brand || "";
        previous.pack = details.pack || previous.pack || "";
      }
      return;
    }
    const item = { id: `${Date.now()}-${Math.random()}`, query, brand: singleItem ? details.brand || "" : "", pack: singleItem ? details.pack || extractPack(query) : extractPack(query), quantity: 1 };
    state.basketItems.push(item);
    existing.set(key, item);
  });
  setTextareaFromItems();
  renderBasket();
  $("#quick-add-input").value = "";
  $("#brand-input").value = "";
  $("#pack-input").value = "";
}

function changeQuantity(id, delta) {
  const item = state.basketItems.find((entry) => entry.id === id);
  if (!item) return;
  item.quantity = Math.max(1, Math.min(20, item.quantity + delta));
  renderBasket();
}

function removeItem(id) {
  state.basketItems = state.basketItems.filter((item) => item.id !== id);
  setTextareaFromItems();
  renderBasket();
}

async function init() {
  try {
    const response = await fetch("./data/demo-quotes.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.snapshot = await response.json();
    state.selectedAddress = state.snapshot.addresses[0].id;
    $("#address-select").innerHTML = state.snapshot.addresses.map((address) => `<option value="${address.id}">${address.label}</option>`).join("");
    $("#summary-location").textContent = state.snapshot.addresses[0].label;
    $("#snapshot-time").textContent = formatSnapshotTime(state.snapshot.generated_at);
    $("#data-status").textContent = "Демо-снимок готов · live-источники не подключены";
    $("#basket-input").value = EXAMPLE_BASKET.slice(0, 3).join("\n");
    syncBasketFromTextarea();

    $("#basket-input").addEventListener("input", syncBasketFromTextarea);
    $("#address-select").addEventListener("change", (event) => {
      state.selectedAddress = event.target.value;
      $("#summary-location").textContent = state.snapshot.addresses.find((address) => address.id === state.selectedAddress).label;
    });
    $("#quick-add-input").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addItems(event.target.value, { brand: $("#brand-input").value.trim(), pack: $("#pack-input").value.trim() }); } });
    $("#add-item-button").addEventListener("click", () => addItems($("#quick-add-input").value, { brand: $("#brand-input").value.trim(), pack: $("#pack-input").value.trim() }));
    $(".quick-picks").addEventListener("click", (event) => { if (event.target.matches("[data-item]")) addItems(event.target.dataset.item); });
    $("#basket-items").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.closest(".basket-item").dataset.id;
      if (button.dataset.action === "increase") changeQuantity(id, 1);
      if (button.dataset.action === "decrease") changeQuantity(id, -1);
      if (button.dataset.action === "remove") removeItem(id);
    });
    $("#load-example").addEventListener("click", () => { $("#basket-input").value = EXAMPLE_BASKET.join("\n"); syncBasketFromTextarea(); });
    $("#compare-button").addEventListener("click", renderResults);
    $("#reset-button").addEventListener("click", () => { $("#results-section").classList.add("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); });
    $("#copy-list-button").addEventListener("click", () => {
      const best = [...(state.quote || [])].sort((a, b) => a.total - b.total)[0];
      if (best) copyRetailerList(best.id);
    });
  } catch (error) {
    $("#data-status").textContent = `Не удалось загрузить снимок: ${error.message}`;
  }
}

init();

