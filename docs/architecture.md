# Архитектура и контракт retailer connector

## Решение

Модульный монолит на Python 3.12:

```text
FastAPI (локальный API / экспорт)
        ↓
Application services (runs, export, rate policy)
        ↓
Domain (SourceOffer, AddressContext, policies)
        ↓
Retailer connector interface
        ↓
PostgreSQL / разрешённый публичный источник
```

Коннектор не знает SQLAlchemy-модели и не выбирает бизнес-правила. Сервис run не знает HTML, cookies или структуру ритейлера. Это позволит добавить `magnit` и `pyaterochka` новыми адаптерами, не переписывая хранение и экспорт.

## Репозиторий

```text
src/grocery_basket_probe/
  api/                 # FastAPI и сериализация ответа
  application/         # use cases: run, export, rate policy
  connectors/
    base.py             # общий Protocol
    perekrestok/        # появляется только после Go source investigation
    magnit/             # будущий адаптер
    pyaterochka/        # будущий адаптер
  domain/               # неизменные модели и правила
  infrastructure/       # SQLAlchemy, migrations, HTTP client, settings
tests/
  unit/
  integration/
  fixtures/
docs/
```

## Контракт

`RetailerConnector` определён в [`src/grocery_basket_probe/connectors/base.py`](../src/grocery_basket_probe/connectors/base.py). Он требует:

- `health_check()` — только безопасная доступность;
- `set_address_context()` — вернуть публичный ID зоны/магазина или отказаться;
- `search()` — поиск с ограничением результата;
- `get_product()` — подробности одного публичного предложения;
- `iter_catalog()` — ограниченный обход одобренной категории, не бесконечное сканирование.

Любая реализация должна соблюдать policy:

1. Не использовать login, SMS, cookies авторизованного пользователя или мобильные токены.
2. Не решать и не обходить CAPTCHA.
3. Не ретраить 403/429 и не ротировать IP/идентификаторы.
4. Использовать явный лимит и кеш.
5. Отдавать `SourceOffer` с URL и временем; не подменять отсутствующие поля выдуманными значениями.
6. Завершаться `blocked`, а не деградировать в небезопасный обход.

## Адресный контекст

`AddressContext` использует `test_address_id`, хеш полного адреса и, если источник даёт их публично, ID зоны/магазина. Полный адрес допустим только в секретном локальном вводе во время investigation и не должен находиться в исходниках, логах, fixture или export.
