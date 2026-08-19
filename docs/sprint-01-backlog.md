# Backlog первого двухнедельного спринта

> Этот backlog относится к первоначальной технической проверке адресного
> каталога. После product decision активный план находится в
> [Sprint 2: рекомендательная корзина](sprint-02-recommendation-mvp.md).

Каждая задача — отдельный небольшой коммит. До задачи 5 не создаётся сетевой коннектор.

| № | Задача | Результат и acceptance | Не делать | Зависимости |
|---:|---|---|---|---|
| 1 | Инициализировать репозиторий | `README`, Python 3.12, Ruff/MyPy/Pytest, Docker Compose; `ruff check .`, `mypy .`, `pytest` проходят | Не ставить Playwright и не писать scraper | — |
| 2 | Утвердить PRD и модель данных | PRD, data model, decision record; scope и stop criteria явно зафиксированы | Не добавлять UI/оплату/matching | 1 |
| 3 | Создать domain/connector contract | `SourceOffer`, `AddressContext`, `RetailerConnector` и unit test | Не реализовывать HTTP-вызовы к сети | 1–2 |
| 4 | Провести source investigation | Заполненный `docs/source-investigation/perekrestok.md`, ссылки и Go/Pivot/Stop | Не использовать скрытые токены, аккаунты, CAPTCHA bypass | 2 |
| 5 | Review gate | Человек подтверждает `Go` и выбранный публичный путь | Не продолжать при Pivot/Stop | 4 |
| 6 | Инфраструктура БД | SQLAlchemy/Alembic, таблицы из модели, migrations и integration tests | Не хранить полный адрес/авторизационные данные | 3, 5 |
| 7 | Read-only Perekrestok connector | Маленький адаптер для одобренного пути с limiter, cache, safe errors | Не сканировать весь каталог и не обходить блокировки | 5–6 |
| 8 | Runner и persistence | 100 SKU, три address contexts, observations/errors/run audit | Не делать бесконечные ретраи | 6–7 |
| 9 | Acceptance export | 20 SKU, CSV/JSON, повторный запуск создаёт новые observations; частичная ошибка изолирована | Не делать клиентский UI | 8 |

## План по дням

| Дни | План |
|---|---|
| 1–2 | Задачи 1–3 |
| 3–4 | Задача 4: ручная техническая разведка и юридическая сверка условий |
| 5 | Задача 5: Go/Pivot/Stop review |
| 6–8 | Задача 6 |
| 9–11 | Задача 7 |
| 12–13 | Задача 8 |
| 14 | Задача 9 и решение по спринту |

## Команды проверки после инициализации среды

```bash
python -m pytest
ruff check .
mypy .
docker compose up -d postgres
```

Live-проверки источника не входят в CI и не должны запускаться тестами.
