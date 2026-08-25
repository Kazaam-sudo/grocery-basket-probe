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

const state = { snapshot: null, catalog: null, selectedAddress: null, basketItems: [], quote: null, comparison: null, pendingProduct: null, suggestions: [], suggestionIndex: -1 };
const $ = (selector) => document.querySelector(selector);

function normalize(value) {
  return String(value || "").toLowerCase().replaceAll("ё", "е").replace(/[^а-яa-z0-9]+/g, " ").trim();
}

function extractPack(value) {
  const match = String(value || "").match(/\d+(?:[.,]\d+)?\s*(?:кг|г|л|мл|шт|рулон(?:а|ов)?)/i);
  return match ? match[0] : "";
}


function catalogItems() {
  return Array.isArray(state.catalog?.items) ? state.catalog.items : [];
}

function categoryOptions() {
  const groups = new Map();
  catalogItems().forEach((item) => {
    const id = item.category_id || normalize(item.aliases?.[0] || item.name);
    const label = item.category_label || item.aliases?.[0] || item.name;
    if (!groups.has(id)) {
      groups.set(id, { id, label, aliases: item.category_aliases || item.aliases || [], variants: [] });
    }
    groups.get(id).variants.push(item);
  });
  return [...groups.values()];
}

function searchOptionText(option) {
  return normalize([
    option.label,
    option.brand,
    option.pack,
    ...(option.aliases || []),
  ].filter(Boolean).join(" "));
}

function filterOptions(options, query) {
  const needle = normalize(query);
  if (!needle) return options.slice(0, 7);
  return options
    .map((option, index) => {
      const text = searchOptionText(option);
      const score = text.startsWith(needle) ? 0 : option.label && normalize(option.label).startsWith(needle) ? 1 : 2;
      return { option, index, score };
    })
    .filter(({ option }) => searchOptionText(option).includes(needle))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, 7)
    .map(({ option }) => option);
}

function brandOptions(query) {
  if (!state.pendingCategory) return [];
  const brands = new Map();
  state.pendingCategory.variants.forEach((variant) => {
    const brand = variant.brand || "Без бренда";
    if (!brands.has(brand)) brands.set(brand, { id: brand, label: brand, aliases: [brand], variants: [] });
    brands.get(brand).variants.push(variant);
  });
  return filterOptions([...brands.values()], query);
}

function packOptions(query) {
  if (!state.pendingCategory || !state.pendingBrand) return [];
  const variants = state.pendingCategory.variants
    .filter((variant) => (variant.brand || "Без бренда") === state.pendingBrand)
    .map((variant) => ({ id: variant.id, label: variant.pack, pack: variant.pack, aliases: [variant.name, ...(variant.aliases || [])], variant }));
  return filterOptions(variants, query);
}

function selectorInput(field) {
  return $({
    product: "#quick-add-input",
    brand: "#brand-search-input",
    pack: "#pack-search-input",
  }[field]);
}

function selectorList(field) {
  return $({
    product: "#product-suggestions",
    brand: "#brand-suggestions",
    pack: "#pack-suggestions",
  }[field]);
}

function selectorOptions(field, query) {
  if (field === "product") return filterOptions(categoryOptions(), query);
  if (field === "brand") return brandOptions(query);
  return packOptions(query);
}

function renderSelectorState() {
  const brandStep = $("#brand-step");
  const packStep = $("#pack-step");
  const brandInput = selectorInput("brand");
  const packInput = selectorInput("pack");
  const addButton = $("#add-item-button");
  brandStep.classList.toggle("hidden", !state.pendingCategory);
  packStep.classList.toggle("hidden", !state.pendingBrand);
  brandInput.disabled = !state.pendingCategory;
  packInput.disabled = !state.pendingBrand;
  addButton.disabled = !state.pendingProduct;

  const selected = $("#selected-product");
  if (state.pendingProduct) {
    const details = [state.pendingProduct.brand, state.pendingProduct.pack].filter(Boolean).join(" · ");
    selected.innerHTML = "<strong>Выбрано:</strong> " + escapeHtml(state.pendingProduct.name) + "<span>" + escapeHtml(details) + "</span>";
  } else if (state.pendingBrand) {
    selected.innerHTML = "<span>Теперь выберите упаковку из доступных фасовок.</span>";
  } else if (state.pendingCategory) {
    selected.innerHTML = "<span>Товар выбран. Теперь выберите бренд из каталога.</span>";
  } else {
    selected.innerHTML = "<span>Сначала выберите товар, затем бренд и упаковку из каталога.</span>";
  }
}

function renderSelectorSuggestions(field) {
  const list = selectorList(field);
  const input = selectorInput(field);
  if (!list || !input) return;
  const query = input.value.trim();
  const suggestions = state.suggestions[field] || [];
  if (!suggestions.length) {
    list.classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
    list.innerHTML = "";
    return;
  }
  list.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
  list.innerHTML = suggestions.map((option, index) => {
    const label = option.label;
    const meta = field === "product"
      ? (option.variants.length + " " + pluralize(option.variants.length, "вариант", "варианта", "вариантов"))
      : field === "brand"
        ? (option.variants.length + " " + pluralize(option.variants.length, "фасовка", "фасовки", "фасовок"))
        : option.variant.name;
    return "<button type=\"button\" class=\"selector-suggestion " + (index === state.suggestionIndex[field] ? "is-active" : "") + "\" role=\"option\" aria-selected=\"" + (index === state.suggestionIndex[field]) + "\" data-option-field=\"" + field + "\" data-option-id=\"" + escapeHtml(option.id) + "\"><span class=\"selector-suggestion-name\">" + escapeHtml(label) + "</span><span class=\"selector-suggestion-meta\">" + escapeHtml(meta) + "</span></button>";
  }).join("");
}

function clearSuggestions() {
  ["product", "brand", "pack"].forEach((field) => {
    state.suggestions[field] = [];
    state.suggestionIndex[field] = -1;
    renderSelectorSuggestions(field);
  });
}

function handleSelectorInput(field, event) {
  if (field === "product") {
    state.pendingCategory = null;
    state.pendingBrand = null;
    state.pendingProduct = null;
    selectorInput("brand").value = "";
    selectorInput("pack").value = "";
  } else if (field === "brand") {
    state.pendingBrand = null;
    state.pendingProduct = null;
    selectorInput("pack").value = "";
  } else {
    state.pendingProduct = null;
  }
  state.suggestionIndex[field] = -1;
  state.suggestions[field] = selectorOptions(field, event.target.value);
  renderSelectorState();
  renderSelectorSuggestions(field);
}

function selectSelectorOption(field, id) {
  const option = (state.suggestions[field] || []).find((entry) => entry.id === id);
  if (!option) return;
  if (field === "product") {
    state.pendingCategory = option;
    state.pendingBrand = null;
    state.pendingProduct = null;
    selectorInput("product").value = option.label;
    selectorInput("brand").value = "";
    selectorInput("pack").value = "";
    renderSelectorState();
    clearSuggestions();
    state.suggestions.brand = selectorOptions("brand", "");
    renderSelectorSuggestions("brand");
    selectorInput("brand").focus();
    return;
  }
  if (field === "brand") {
    state.pendingBrand = option.label;
    state.pendingProduct = null;
    selectorInput("brand").value = option.label;
    selectorInput("pack").value = "";
    renderSelectorState();
    clearSuggestions();
    state.suggestions.pack = selectorOptions("pack", "");
    renderSelectorSuggestions("pack");
    selectorInput("pack").focus();
    return;
  }
  state.pendingProduct = option.variant;
  selectorInput("pack").value = option.variant.pack;
  renderSelectorState();
  clearSuggestions();
}

function handleSelectorKeydown(field, event) {
  const suggestions = state.suggestions[field] || [];
  if (event.key === "ArrowDown" && suggestions.length) {
    event.preventDefault();
    state.suggestionIndex[field] = Math.min(state.suggestionIndex[field] + 1, suggestions.length - 1);
    renderSelectorSuggestions(field);
    return;
  }
  if (event.key === "ArrowUp" && suggestions.length) {
    event.preventDefault();
    state.suggestionIndex[field] = Math.max(state.suggestionIndex[field] - 1, 0);
    renderSelectorSuggestions(field);
    return;
  }
  if (event.key === "Escape") {
    state.suggestions[field] = [];
    state.suggestionIndex[field] = -1;
    renderSelectorSuggestions(field);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const option = suggestions[state.suggestionIndex[field]];
    if (option) {
      selectSelectorOption(field, option.id);
    } else if (field === "pack" && state.pendingProduct) {
      addSelectedProduct();
    } else {
      $("#data-status").textContent = "Выберите вариант из списка";
    }
  }
}

function focusProductSearch(query) {
  const input = selectorInput("product");
  input.value = query;
  handleSelectorInput("product", { target: input });
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

function parsePack(value) {
  const raw = String(value || "").toLowerCase().replaceAll("ё", "е").replace(",", ".").trim();
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(кг|г|л|мл|шт|рулон(?:а|ов)?)/);
  if (!match) return null;
  const conversions = { кг: ["g", 1000], г: ["g", 1], л: ["ml", 1000], мл: ["ml", 1], шт: ["count", 1], рулон: ["count", 1], рулона: ["count", 1], рулонов: ["count", 1] };
  const [unit, multiplier] = conversions[match[2]];
  return { amount: Number(match[1]) * multiplier, unit };
}

function catalogMetadataForItem(item) {
  if (item.categoryId || item.categoryLabel) return item;
  const query = normalize(item.query);
  return catalogItems().find((product) => [product.name, ...(product.aliases || []), product.category_label].some((value) => {
    const text = normalize(value);
    return text && (query.includes(text) || text.includes(query));
  })) || null;
}

function offerSearchScore(item, offer) {
  if (!offer) return -Infinity;
  const metadata = catalogMetadataForItem(item);
  const terms = [item.query, ...(item.searchTerms || []), metadata?.category_label, ...(metadata?.category_aliases || [])].map(normalize).filter(Boolean);
  const aliasScore = (offer.aliases || []).reduce((best, alias) => {
    const normalizedAlias = normalize(alias);
    if (!normalizedAlias) return best;
    return Math.max(best, terms.some((term) => term === normalizedAlias) ? 40 : terms.some((term) => term.includes(normalizedAlias) || normalizedAlias.includes(term)) ? 18 : 0);
  }, 0);
  if (!aliasScore) return -Infinity;
  if (item.brand && !matchesTextConstraint(item.brand, offer.brand)) return -Infinity;
  const expectedPack = parsePack(item.pack || extractPack(item.query));
  const offerPack = parsePack(offer.pack);
  let packScore = 0;
  if (expectedPack && offerPack) {
    if (expectedPack.unit !== offerPack.unit) return -Infinity;
    const distance = Math.abs(expectedPack.amount - offerPack.amount) / Math.max(expectedPack.amount, offerPack.amount);
    if (distance > 0.6) return -Infinity;
    packScore = 20 - distance * 20;
  }
  const brandScore = item.brand && matchesTextConstraint(item.brand, offer.brand) ? 35 : 0;
  return aliasScore + packScore + brandScore;
}

function findAnalogOffer(retailer, item) {
  const offers = retailer.offerCatalog || retailer.items || [];
  return offers
    .map((entry) => ({ offer: entry.offer || entry, score: offerSearchScore(item, entry.offer || entry) }))
    .filter(({ offer, score }) => isUsableOffer(offer) && Number.isFinite(score))
    .sort((left, right) => right.score - left.score)[0]?.offer || null;
}

function equivalentPrice(offer, item) {
  const expectedPack = parsePack(item.pack || extractPack(item.query));
  const actualPack = parsePack(offer.pack);
  if (!expectedPack || !actualPack || expectedPack.unit !== actualPack.unit || !actualPack.amount) return offer.price;
  return offer.price * expectedPack.amount / actualPack.amount;
}

function formatUnitPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(value);
}

function analogPackLabel(item) {
  return item.pack || extractPack(item.query) || "запрошенную фасовку";
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

function isUsableOffer(offer) {
  return offer?.available !== false && offer?.price != null;
}

function buildQuote(items) {
  return state.snapshot.retailers.map((retailer) => {
    const offerCatalog = retailer.items;
    const matchedItems = items.map((item) => ({ ...item, offer: findOffer(retailer, item) }));
    const found = matchedItems.filter(({ offer }) => isUsableOffer(offer));
    return {
      ...retailer,
      offerCatalog,
      items: matchedItems,
      foundCount: found.length,
      unitCount: found.reduce((sum, item) => sum + item.quantity, 0),
      total: found.reduce((sum, item) => sum + item.offer.price * item.quantity, 0),
      coverage: items.length ? found.length / items.length : 0,
    };
  });
}

function buildComparableQuote(quote, items) {
  const commonItems = items.filter((item) => quote.every((retailer) => {
    const match = retailer.items.find(({ id }) => id === item.id);
    return isUsableOffer(match?.offer);
  }));
  const commonIds = new Set(commonItems.map((item) => item.id));
  const retailers = quote.map((retailer) => {
    const comparableItems = retailer.items.filter(({ id }) => commonIds.has(id));
    return {
      ...retailer,
      comparableItems,
      comparableUnitCount: comparableItems.reduce((sum, item) => sum + item.quantity, 0),
      comparableTotal: comparableItems.reduce((sum, item) => sum + item.offer.price * item.quantity, 0),
    };
  });
  const analogs = items
    .filter((item) => !commonIds.has(item.id))
    .map((item) => {
      const matches = quote.map((retailer) => ({
        retailerId: retailer.id,
        retailerName: retailer.name,
        offer: findAnalogOffer(retailer, item),
      }));
      const availableCount = matches.filter(({ offer }) => isUsableOffer(offer)).length;
      return {
        item,
        matches,
        availableCount,
        comparable: availableCount === quote.length,
      };
    })
    .filter(({ availableCount }) => availableCount > 0);
  return { items: commonItems, retailers, analogs };
}

function renderComparisonScope() {
  const scope = $("#comparison-scope");
  const commonItems = state.comparison?.items || [];
  const analogs = state.comparison?.analogs || [];
  const excludedItems = state.basketItems.filter((item) => !commonItems.some((commonItem) => commonItem.id === item.id));
  if (!commonItems.length) {
    scope.innerHTML = `<strong>Нет общей корзины для сравнения</strong><span>Ни одна позиция не найдена одновременно во всех выбранных сетях. Ниже можно посмотреть найденные аналоги.</span>${renderAnalogGroups(analogs)}`;
    scope.className = "comparison-scope is-empty";
    return;
  }
  scope.className = "comparison-scope";
  scope.innerHTML = `<strong>Сравниваем одинаковую корзину: ${commonItems.length} из ${state.basketItems.length} позиций</strong><span>Итоги ниже рассчитаны только по товарам, которые есть во всех сетях.</span><div class="comparison-scope-items">${commonItems.map((item) => `<span>${escapeHtml(item.query)}</span>`).join("")}</div>${excludedItems.length ? `<div class="comparison-excluded"><strong>Не вошли в сравнение:</strong> ${excludedItems.map((item) => escapeHtml(item.query)).join(" · ")}</div>` : ""}${renderAnalogGroups(analogs)}`;
}

function renderAnalogGroups(analogs) {
  if (!analogs.length) return "";
  return `<div class="comparison-analogs"><strong>Аналоги для исключённых позиций</strong><span>Сравнение приведено к запрошенной фасовке; фактическая упаковка показана рядом.</span>${analogs.map(({ item, matches, availableCount, comparable }) => `<div class="analog-group"><div class="analog-heading"><strong>${escapeHtml(item.query)}</strong><span class="analog-status ${comparable ? "is-comparable" : ""}">${comparable ? `сравнимый аналог для ${escapeHtml(analogPackLabel(item))}` : `аналог найден в ${availableCount} из ${state.snapshot.retailers.length} сетей`}</span></div><div class="analog-offers">${matches.map(({ retailerName, offer }) => offer && isUsableOffer(offer) ? `<div class="analog-offer"><span>${escapeHtml(retailerName)}</span><span>${escapeHtml(offer.pack)} · ${formatUnitPrice(equivalentPrice(offer, item))} за ${escapeHtml(analogPackLabel(item))}</span></div>` : `<div class="analog-offer is-missing"><span>${escapeHtml(retailerName)}</span><span>аналог не найден</span></div>`).join("")}</div></div>`).join("")}</div>`;
}

function renderRetailers() {
  const comparisonQuote = state.comparison?.retailers || [];
  const commonItems = state.comparison?.items || [];
  const best = [...comparisonQuote].sort((a, b) => a.comparableTotal - b.comparableTotal)[0];
  const itemCount = state.basketItems.length;
  $("#recommendation").innerHTML = commonItems.length
    ? `<span><strong>${best.name}</strong> — самая низкая сумма за одинаковую корзину из ${commonItems.length} позиций.</span><span>Доставка и персональные скидки не учтены</span>`
    : `<span><strong>Сравнение невозможно.</strong> Во всех сетях нет ни одной общей позиции.</span><span>Измените список товаров</span>`;

  $("#retailer-grid").innerHTML = comparisonQuote.map((retailer) => {
    const isRecommended = commonItems.length > 0 && retailer.id === best?.id;
    const commonCountLabel = pluralize(commonItems.length, "позиция", "позиции", "позиций");
    const foundItems = retailer.comparableItems;
    const missingItems = state.basketItems.filter((item) => !commonItems.some((commonItem) => commonItem.id === item.id));
    const foundList = foundItems.length
      ? `<ul>${foundItems.map(({ query, offer, quantity }) => `<li><span>${escapeHtml(query)}</span><strong>${formatMoney(offer.price * quantity)}</strong></li>`).join("")}</ul>`
      : `<p class="coverage-empty">Нет общей позиции.</p>`;
    const missingList = missingItems.length
      ? `<ul>${missingItems.map(({ query }) => `<li>${escapeHtml(query)}</li>`).join("")}</ul>`
      : `<p class="coverage-empty">Вся исходная корзина сравнима.</p>`;
    const detailsId = `coverage-details-${retailer.id}`;
    return `<article class="retailer-card ${isRecommended ? "is-recommended" : ""}">
      <div class="retailer-top"><div><h3 class="retailer-name">${retailer.name}</h3><p class="retailer-subtitle">${retailer.subtitle}</p></div><span class="card-status ${commonItems.length ? "" : "warning"}">${commonItems.length ? `${commonItems.length} ${commonCountLabel}` : "нет общих"}</span></div>
      <div class="retailer-total">${commonItems.length ? formatMoney(retailer.comparableTotal) : "—"}<small>${commonItems.length ? "одинаковая корзина" : "нет сравнения"}</small></div>
      <div class="coverage-breakdown"><span class="coverage-found">✓ Общие: ${foundItems.length}</span><span class="coverage-missing">${missingItems.length ? `× Исключено: ${missingItems.length}` : "✓ Вся корзина"}</span></div>
      <div class="card-meta"><span>В магазине найдено: ${retailer.foundCount} из ${itemCount}</span><span>${retailer.comparableUnitCount} шт.</span></div>
      <button class="coverage-toggle" type="button" data-coverage-toggle="${detailsId}" aria-expanded="false">Показать позиции</button>
      <div class="coverage-details hidden" id="${detailsId}">
        <div><strong>Найдено</strong>${foundList}</div>
        <div><strong>Не найдено</strong>${missingList}</div>
      </div>
      <div class="card-actions"><a class="primary-button" href="${retailer.public_url}" target="_blank" rel="noreferrer">Открыть сайт ↗</a><button class="secondary-button" type="button" data-retailer="${retailer.id}">Скопировать список</button></div>
    </article>`;
  }).join("");

  $("#retailer-grid").querySelectorAll("button[data-retailer]").forEach((button) => button.addEventListener("click", () => copyRetailerList(button.dataset.retailer, button)));
  $("#retailer-grid").querySelectorAll("button[data-coverage-toggle]").forEach((button) => button.addEventListener("click", () => {
    const details = $("#" + button.dataset.coverageToggle);
    const expanded = button.getAttribute("aria-expanded") === "true";
    details.classList.toggle("hidden", expanded);
    button.setAttribute("aria-expanded", String(!expanded));
    button.textContent = expanded ? "Показать позиции" : "Скрыть позиции";
  }));
}

function renderItemsTable() {
  const rows = (state.comparison?.items || []).map((item) => {
    const offers = (state.comparison?.retailers || []).map((retailer) => retailer.items.find((match) => match.id === item.id)?.offer);
    const primaryOffer = offers.find(Boolean);
    const availableOffers = offers.filter((offer) => offer?.available !== false && offer?.price != null);
    const status = availableOffers.length === offers.length ? [`все ${offers.length} сети`, ""] : availableOffers.length ? [`${availableOffers.length} из ${offers.length} сетей`, "warning"] : ["не найдено", "danger"];
    const brand = item.brand || primaryOffer?.brand || "—";
    const pack = item.pack || primaryOffer?.pack || "—";
    return `<tr><td><strong>${escapeHtml(item.query)}</strong></td><td>${escapeHtml(brand)}</td><td>${item.quantity}</td><td>${escapeHtml(pack)}</td>${offers.map((offer) => `<td class="price-cell ${offer?.available === false || offer?.price == null ? "unavailable" : ""}">${offer?.available === false ? "нет" : offer?.price != null ? formatMoney(offer.price * item.quantity) : "—"}</td>`).join("")}<td><span class="item-status ${status[1]}">${status[0]}</span></td></tr>`;
  });
  $("#items-table-body").innerHTML = rows.join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

let toastTimer;

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 2800);
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    // Fall back to the legacy copy path below when the browser blocks clipboard access.
  }
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }
  helper.remove();
  return copied;
}

function renderResults() {
  if (!state.basketItems.length) {
    $("#data-status").textContent = "Добавьте хотя бы один товар";
    $("#quick-add-input").focus();
    return;
  }
  state.quote = buildQuote(state.basketItems);
  state.comparison = buildComparableQuote(state.quote, state.basketItems);
  const address = state.snapshot.addresses.find((item) => item.id === state.selectedAddress);
  $("#results-context").textContent = `${address.label} · сравнение одинаковой корзины · цены без персональных скидок`;
  renderComparisonScope();
  renderRetailers();
  renderItemsTable();
  $("#results-section").classList.remove("hidden");
  $("#data-status").textContent = "Расчёт готов по последнему демо-снимку";
  window.scrollTo({ top: $("#results-section").offsetTop - 18, behavior: "smooth" });
}

function listText(retailer) {
  return retailer.comparableItems.filter(({ offer }) => isUsableOffer(offer)).map(({ query, offer, quantity }) => `${quantity > 1 ? `${quantity} × ` : ""}${query} — ${formatItemSpec({ brand: offer.brand, pack: offer.pack })}, ${offer.name}`).join("\n");
}

async function copyRetailerList(retailerId, button) {
  const retailer = state.comparison?.retailers?.find((item) => item.id === retailerId);
  if (!retailer) return;
  const text = listText(retailer);
  if (!text) {
    showToast("В общей корзине нет позиций для списка");
    return;
  }
  const copied = await copyText(text);
  $("#data-status").textContent = copied ? `Список для ${retailer.name} скопирован` : "Не удалось скопировать список";
  showToast(copied ? `Список ${retailer.name} скопирован` : "Не удалось скопировать список");
  if (button) {
    const originalLabel = button.textContent;
    button.textContent = copied ? "Скопировано ✓" : "Повторить копирование";
    window.setTimeout(() => { button.textContent = originalLabel; }, 2200);
  }
}

function addSelectedProduct() {
  const product = state.pendingProduct;
  if (!product) {
    $("#data-status").textContent = "Сначала выберите упаковку из списка";
    selectorInput("pack").focus();
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
      searchTerms: [...(product.aliases || []), ...(product.search_terms || []), product.category_label || ""],
      categoryId: product.category_id || "",
      categoryLabel: product.category_label || "",
      source: product.source || "",
      sourceUrl: product.source_url || "",
      quantity: 1,
    });
  }
  setTextareaFromItems();
  state.pendingCategory = null;
  state.pendingBrand = null;
  state.pendingProduct = null;
  state.suggestions = { product: [], brand: [], pack: [] };
  state.suggestionIndex = { product: -1, brand: -1, pack: -1 };
  selectorInput("product").value = "";
  selectorInput("brand").value = "";
  selectorInput("pack").value = "";
  renderSelectorState();
  clearSuggestions();
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
    state.pendingCategory = null;
    state.pendingBrand = null;
    state.pendingProduct = null;
    state.suggestions = { product: [], brand: [], pack: [] };
    state.suggestionIndex = { product: -1, brand: -1, pack: -1 };
    $("#address-select").innerHTML = state.snapshot.addresses.map((address) => "<option value=\"" + address.id + "\">" + address.label + "</option>").join("");
    $("#summary-location").textContent = state.snapshot.addresses[0].label;
    $("#snapshot-time").textContent = formatSnapshotTime(state.snapshot.generated_at);
    const catalogSource = state.catalog.snapshot_retailer === "perekrestok" ? "каталог Перекрёстка" : "публичный каталог";
    $("#data-status").textContent = catalogSource + " · " + state.catalog.items.length + " карточек · цены демо-снимка";
    $("#basket-input").value = EXAMPLE_BASKET.slice(0, 3).join("\n");
    syncBasketFromTextarea();
    renderSelectorState();

    $("#basket-input").addEventListener("input", syncBasketFromTextarea);
    $("#address-select").addEventListener("change", (event) => {
      state.selectedAddress = event.target.value;
      $("#summary-location").textContent = state.snapshot.addresses.find((address) => address.id === state.selectedAddress).label;
    });
    ["product", "brand", "pack"].forEach((field) => {
      const input = selectorInput(field);
      input.addEventListener("input", (event) => handleSelectorInput(field, event));
      input.addEventListener("keydown", (event) => handleSelectorKeydown(field, event));
      input.addEventListener("focus", () => {
        state.suggestionIndex[field] = -1;
        state.suggestions[field] = selectorOptions(field, input.value);
        renderSelectorSuggestions(field);
      });
    });
    $("#add-item-button").addEventListener("click", addSelectedProduct);
    $(".product-selector").addEventListener("click", (event) => {
      const option = event.target.closest("[data-option-field][data-option-id]");
      if (!option) return;
      event.stopPropagation();
      selectSelectorOption(option.dataset.optionField, option.dataset.optionId);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".product-selector")) clearSuggestions();
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
      if (!state.comparison?.items?.length) {
        $("#data-status").textContent = "Нет общей корзины для копирования";
        return;
      }
      const best = [...(state.comparison?.retailers || [])].sort((a, b) => a.comparableTotal - b.comparableTotal)[0];
      if (best) copyRetailerList(best.id, $("#copy-list-button"));
    });
  } catch (error) {
    $("#data-status").textContent = "Не удалось загрузить каталог: " + error.message;
  }
}
init();
