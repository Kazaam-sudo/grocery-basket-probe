# Минимальная модель данных

| Таблица | Назначение | Основные поля | Связи, ограничения и индексы |
|---|---|---|---|
| `retailers` | Справочник сетей | `id`, `code`, `name`, `enabled` | `code` unique; индекс `enabled` |
| `test_addresses` | Разрешённые тестовые контексты | `id`, `label`, `address_fingerprint`, `is_active` | `address_fingerprint` unique; не хранить полный адрес в основной БД |
| `stores` | Публично доступные магазины/зоны | `id`, `retailer_id`, `source_store_id`, `source_zone_id`, `test_address_id` | unique `(retailer_id, source_store_id, source_zone_id, test_address_id)`; индексы retailer/address |
| `source_products` | Относительно стабильные карточки источника | `id`, `retailer_id`, `source_product_id`, `source_name`, `source_url` | unique `(retailer_id, source_product_id)`; индекс по `source_name` |
| `normalized_products` | Локальное нормализованное представление | `id`, `canonical_name`, `brand`, `quantity_value`, `quantity_unit` | пока 0..1 к `source_products`; позднее input matching |
| `offers` | Продукт в зоне/магазине | `id`, `source_product_id`, `store_id`, `availability_state`, `last_seen_at` | unique `(source_product_id, store_id)`; индексы store/availability |
| `price_observations` | Неизменные факты о цене | `id`, `offer_id`, `regular_price`, `promotional_price`, `observed_price`, `price_type`, `observed_at`, `run_id` | индекс `(offer_id, observed_at DESC)`; запрет на update цены задним числом |
| `connector_runs` | Аудит запуска | `id`, `retailer_id`, `test_address_id`, `status`, `started_at`, `finished_at`, `connector_version`, `request_count` | индексы retailer/status/started_at; один active run на retailer/address |
| `connector_errors` | Ошибки без персональных данных | `id`, `run_id`, `source_product_id`, `error_code`, `safe_detail`, `occurred_at` | индекс `(run_id, occurred_at)` |
| `test_basket_items` | Утверждённый тестовый набор | `id`, `query`, `expected_brand`, `expected_quantity`, `is_acceptance_item` | unique normalized query; индекс `is_acceptance_item` |
| `basket_quotes` | Снимок расчёта корзины для пользователя/демо | `id`, `address_context_id`, `created_at`, `freshness_cutoff`, `status` | индекс `(address_context_id, created_at DESC)`; не хранить полный адрес |
| `basket_quote_items` | Позиция корзины и результат сопоставления | `id`, `quote_id`, `input_query`, `normalized_product_id`, `match_class`, `requested_quantity`, `selected_offer_id`, `line_total`, `reason` | unique `(quote_id, input_query)`; индексы quote/match_class |
| `retailer_handoffs` | Подготовленный переход к выбранной сети | `id`, `quote_id`, `retailer_id`, `public_url`, `copy_text`, `created_at` | индекс `(quote_id, retailer_id)`; только публичные URL, без cookies и токенов |

`price_observations` не должно иметь уникального ограничения на предложение и время, которое случайно склеит разные повторные измерения. Для защиты от двойного запуска применяется idempotency key на уровне `connector_runs`.

## Правила расчёта

- `line_total` считается только для найденного предложения и подтверждённого
  количества;
- неизвестные цена, наличие, доставка или сбор сохраняются как `unknown`, а не
  как ноль;
- `match_class` принимает только `exact`, `equivalent`, `substitute` или
  `unknown`;
- `basket_quotes` — исторические снимки: изменение каталога создаёт новый quote,
  но не переписывает прошлый результат;
- `retailer_handoffs` не является заказом и не содержит платёжных или
  авторизационных данных.
