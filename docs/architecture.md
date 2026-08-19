# Архитектура рекомендательной корзины

## Решение

Модульный монолит на Python 3.12:

```text
Web UI / FastAPI
        ↓
Basket quote service
        ↓
Product matching + price policy
        ↓
Retailer offers / price observations
        ↓
PostgreSQL

Quote result → handoff builder → public retailer URL + prepared list
```

Сервис рассчитывает рекомендацию, но не является заказчиком и не управляет
корзиной ритейлера.

## Слои

```text
src/grocery_basket_probe/
  api/                 # quote, export, handoff
  application/         # ingestion, quote, freshness, handoff
  connectors/          # изолированные адаптеры сетей
    base.py
    pyaterochka/
    magnit/
    lenta/
  domain/
    basket.py          # BasketItem, BasketQuote, RetailerTotal
    offers.py          # SourceOffer, PriceObservation
    matching.py        # exact/equivalent/substitute/unknown
    handoff.py         # public URL и подготовленный список
  infrastructure/      # SQLAlchemy, Alembic, HTTP client, settings
```

## Два независимых контура

### Ingestion

Получает разрешённые публичные предложения, нормализует факты и сохраняет
наблюдения. Интеграция с сетью не вызывается синхронно из пользовательского
запроса.

### Recommendation

Работает по сохранённым наблюдениям и кэшу. Считает subtotal, покрытие, fees,
свежесть и предупреждения. Если данных нет, возвращает `unknown`, а не догадку.

## Retailer connector

Каждый коннектор реализует общий интерфейс:

- `health_check()`;
- `set_address_context()`;
- `search()`;
- `get_product()`;
- `iter_catalog()` с явным лимитом;
- `normalize()`;
- `build_handoff()`.

Коннектор обязан:

1. использовать только разрешённый публичный или партнёрский путь;
2. возвращать URL и `fetched_at`;
3. сохранять `availability=unknown`, если поле не подтверждено;
4. прекращать работу при CAPTCHA, login wall, 403/429 или закрытом токене;
5. не создавать корзину, заказ или платежную операцию.

## Handoff

Handoff — отдельный доменный слой, а не часть connector scraping:

```json
{
  "retailer": "pyaterochka",
  "public_url": "https://…",
  "items": [
    {"name": "Молоко 2,5%", "pack": "930 мл", "quantity": 2, "url": "…"}
  ],
  "copy_text": "Молоко 2,5% 930 мл — 2 шт."
}
```

В MVP `public_url` может вести на каталог или поиск. Предзаполненная корзина
допустима только после документированного официального API и отдельного review.

## Адресный контекст

`AddressContext` хранит внутренний `test_address_id`, hash адреса и публичный
`store_id`/`zone_id`, если источник его даёт. Полный адрес не попадает в логи,
fixtures или экспорт.

Цена всегда индексируется по:

```text
retailer + store_or_zone + address_context + source_product + observed_at
```

## Мониторинг качества

- доля найденных позиций;
- exact/equivalent/substitute/unknown;
- возраст последнего наблюдения;
- покрытие по сети;
- расхождение повторных цен;
- число ошибок и blocked-run;
- время восстановления корзины после handoff.
