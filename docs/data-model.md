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

`price_observations` не должно иметь уникального ограничения на предложение и время, которое случайно склеит разные повторные измерения. Для защиты от двойного запуска применяется idempotency key на уровне `connector_runs`.
