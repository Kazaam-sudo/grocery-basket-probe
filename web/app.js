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

const state = { snapshot: null, catalog: null, selectedAddress: null, basketItems: [], quote: null, pendingProduct: null, suggestions: [], suggestionIndex: -1 };
const $ = (selector) => document.querySelector(selector);

function normalize(value) {
  return value.toLowerCase().replaceAll("ё", "е").replace(/[^а-яa-z0-9]+/g, " ").trim();
}

function extractPack(value) {
  const match = String(value || "").match(/\d+(?:[.,]\d+)?\s*(?:кг|г|л|мл|шт|рулон(?:а|ов)?)/i);
  return match ? match[0] : "";
}


function catalogItems() {
  return Array.isArray(state.catalog?.items) ? state.catalog.items : [];
}

function productSearchText(product) {
  return normalize([
    product.name,
    product.brand,
    ...(product.aliases || []),
    ...(product.search_terms || []),
  ].filter(Boolean).join(" "));
}

function productSuggestions(query) {
  const needle = normalize(query);
  if (!needle) return [];
  return catalogItems()
    .map((product, index) => {
      const name = normalize(product.name);
      const brand = normalize(product.brand || "");
      const aliases = (product.aliases || []).map(normalize);
      const score = name.startsWith(needle) ? 0 : brand.startsWith(needle) ? 1 : aliases.some((alias) => alias.startsWith(needle)) ? 2 : 3;
      return { product, index, score };
    })
    .filter(({ product }) => productSearchText(product).includes(needle))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, 7)
    .map(({ product }) => product);
}

function renderSelectedProduct() {
  const container = $("#selected-product");
  const button = $("#add-item-button");
  if (!container) return;
  if (!state.pendingProduct) {
    container.innerHTML = "<span>Выберите точный товар из подсказок — бренд и упаковка подставятся автоматически.</span>";
    if (button) button.disabled = true;
    return;
  }
  const details = [state.pendingProduct.brand, state.pendingProduct.pack].filter(Boolean).join(" · ");
  container.innerHTML = "<strong>Выбрано:</strong> " + escapeHtml(state.pendingProduct.name) + "<span>" + escapeHtml(details) + "</span>";
  if (button) button.disabled = false;
}

function renderProductSuggestions() {
  const container = $("#product-suggestions");
  const input = $("#quick-add-input");
  if (!container || !input) return;
  const query = input.value.trim();
  if (!query || !state.suggestions.length) {
    container.classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
    container.innerHTML = "";
    return;
  }
  container.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
  container.innerHTML = state.suggestions.map((product, index) => "<button type=\"button\" class=\"product-suggestion " + (index === state.suggestionIndex ? "is-active" : "") + "\" role=\"option\" aria-selected=\"" + (index === state.suggestionIndex) + "\" data-product-id=\"" + escapeHtml(product.id) + "\"><span class=\"product-suggestion-name\">" + escapeHtml(product.name) + "</span><span class=\"product-suggestion-meta\">" + escapeHtml([product.brand, product.pack].filter(Boolean).join(" · ")) + "</span></button>").join("");
}

function handleProductInput(event) {
  state.pendingProduct = null;
  state.suggestionIndex = -1;
  state.suggestions = productSuggestions(event.target.value);
  renderSelectedProduct();
  renderProductSuggestions();
}

function selectProduct(product) {
  if (!product) return;
  state.pendingProduct = product;
  state.suggestionIndex = -1;
  state.suggestions = [];
  $("#quick-add-input").value = product.name;
  renderSelectedProduct();
  renderProductSuggestions();
}

function handleProductKeydown(event) {
  if (event.key === "ArrowDown" && state.suggestions.length) {
    event.preventDefault();
    state.suggestionIndex = Math.min(state.suggestionIndex + 1, state.suggestions.length - 1);
    renderProductSuggestions();
    return;
  }
  if (event.key === "ArrowUp" && state.suggestions.length) {
    event.preventDefault();
    state.suggestionIndex = Math.max(state.suggestionIndex - 1, 0);
    renderProductSuggestions();
    return;
  }
  if (event.key === "Escape") {
    state.suggestions = [];
    state.suggestionIndex = -1;
    renderProductSuggestions();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    if (state.suggestions[state.suggestionIndex]) {
      selectProduct(state.suggestions[state.suggestionIndex]);
    } else if (state.pendingProduct) {
      addSelectedProduct();
    } else {
      $("#data-status").textContent = "Сначала выберите товар из подсказок";
    }
  }
}

function focusProductSearch(query) {
  const input = $("#quick-add-input");
  input.value = query;
  state.pendingProduct = null;
  state.suggestions = productSuggestions(query);
  state.suggestionIndex = -1;
  renderSelectedProduct();
  renderProductSuggestions();
  input.focus();
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
  const searchTerms = [item.query, ...(item.searchTerms || [])].map(normalize).filter(Boolean);
  const candidates = retailer.items.filter((offer) => offer.aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    return searchTerms.some((term) => term.includes(normalizedAlias) || normalizedAlias.includes(term));
  }));
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

function addSelectedProduct() {
  const product = state.pendingProduct;
  if (!product) {
    $("#data-status").textContent = "Сначала выберите товар из подсказок";
    $("#quick-add-input").focus();
    return;
  }
  const existing = state.basketItems.find((item) => item.productId === product.id);
  if (existing) {
    existing.quantity = Math.min(20, existing.quantity + 1);
  } else {
    state.basketItems.push({
      id: String(Date.now()) + "-" + Math.random(),
      productId: product.id,
      gtin: product.gtin || "",
      query: product.name,
      brand: product.brand || "",
      pack: product.pack || "",
      searchTerms: [...(product.aliases || []), ...(product.search_terms || [])],
      source: product.source || "",
      sourceUrl: product.source_url || "",
      quantity: 1,
    });
  }
  setTextareaFromItems();
  state.pendingProduct = null;
  state.suggestions = [];
  state.suggestionIndex = -1;
  $("#quick-add-input").value = "";
  renderSelectedProduct();
  renderProductSuggestions();
  renderBasket();
  $("#data-status").textContent = "Добавлен товар: " + product.name;
}

function addItems() {
  addSelectedProduct();
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
    const [snapshotResponse, catalogResponse] = await Promise.all([
      fetch("./data/demo-quotes.json"),
      fetch("./data/product-catalog.json"),
    ]);
    if (!snapshotResponse.ok) throw new Error("HTTP " + snapshotResponse.status + " для снимка");
    if (!catalogResponse.ok) throw new Error("HTTP " + catalogResponse.status + " для каталога");
    state.snapshot = await snapshotResponse.json();
    state.catalog = await catalogResponse.json();
    if (!Array.isArray(state.catalog.items)) throw new Error("каталог имеет неверный формат");
    state.selectedAddress = state.snapshot.addresses[0].id;
    $("#address-select").innerHTML = state.snapshot.addresses.map((address) => "<option value=\"" + address.id + "\">" + address.label + "</option>").join("");
    $("#summary-location").textContent = state.snapshot.addresses[0].label;
    $("#snapshot-time").textContent = formatSnapshotTime(state.snapshot.generated_at);
    $("#data-status").textContent = "Каталог готов · " + state.catalog.items.length + " реальных карточек · цены демо-снимка";
    $("#basket-input").value = EXAMPLE_BASKET.slice(0, 3).join("\n");
    syncBasketFromTextarea();
    renderSelectedProduct();

    $("#basket-input").addEventListener("input", syncBasketFromTextarea);
    $("#address-select").addEventListener("change", (event) => {
      state.selectedAddress = event.target.value;
      $("#summary-location").textContent = state.snapshot.addresses.find((address) => address.id === state.selectedAddress).label;
    });
    $("#quick-add-input").addEventListener("input", handleProductInput);
    $("#quick-add-input").addEventListener("keydown", handleProductKeydown);
    $("#add-item-button").addEventListener("click", addSelectedProduct);
    $("#product-suggestions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-product-id]");
      if (!button) return;
      const product = catalogItems().find((entry) => entry.id === button.dataset.productId);
      selectProduct(product);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".product-search")) {
        state.suggestions = [];
        state.suggestionIndex = -1;
        renderProductSuggestions();
      }
    });
    $(".quick-picks").addEventListener("click", (event) => {
      if (event.target.matches("[data-item]")) focusProductSearch(event.target.dataset.item);
    });
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
    $("#data-status").textContent = "Не удалось загрузить каталог: " + error.message;
  }
}
init();

