# Grocery Basket Probe

Технический прототип рекомендательного сервиса: пользователь указывает адрес и
список продуктов, а приложение сравнивает стоимость полной корзины в Пятёрочке,
Магните и Ленте и помогает перейти к выбранной сети.

Приложение **не оформляет заказ**, не принимает оплату и не обещает автоматически
переносить корзину. На первом этапе handoff — это публичная ссылка и подготовленный
список, который можно скопировать в приложение выбранной сети.

## Текущие границы MVP

- Москва и Московская область;
- корзина до 20 позиций;
- сравнение одной полной корзины в одном магазине;
- read-only источники без аккаунтов, SMS, CAPTCHA bypass, мобильных токенов и
  обхода rate limits;
- цена, упаковка, количество, наличие/`unknown`, источник и время проверки;
- exact/equivalent/substitute/unknown matching;
- переход к магазину через публичную ссылку и подготовленный список.

Не входит: оформление заказа, оплата, собственная доставка, импорт корзины,
персональные скидки, карты лояльности и автоматическое распределение корзины
между несколькими магазинами.

## Документы

- [Technical PRD](docs/technical-prd.md)
- [Product decision: рекомендательная корзина](docs/product-decision-recommendation.md)
- [Архитектура и контракт коннектора](docs/architecture.md)
- [Модель данных](docs/data-model.md)
- [Backlog первого спринта](docs/sprint-01-backlog.md)
- [Backlog Sprint 2: рекомендательная корзина](docs/sprint-02-recommendation-mvp.md)
- [Отчёт технической разведки Перекрёстка](docs/source-investigation/perekrestok.md)
- [Отчёт технической разведки Магнита](docs/source-investigation/magnit.md)
- [Бесплатный web app и GitHub Pages](docs/free-hosting.md)
- [Live data gate и статус источников](docs/live-data-gate.md)
- [Готовый промт для следующего coding agent](docs/prompts/01-source-investigation.md)
- [Prompt 02: recommendation MVP](docs/prompts/02-recommendation-mvp.md)

## Web app

Статический прототип находится в `web/`. Пока live data gate не пройден, он работает
без backend-запросов: читает явно помеченный демо-снимок
`web/data/demo-quotes.json`, сравнивает корзину в браузере, формирует список для
выбранной сети. Пользовательский интерфейс не требует скачивания файлов: результат
можно посмотреть на странице и скопировать одним нажатием. GitHub Actions публикует
каталог `web/` в GitHub Pages после изменения `main`.

Локальный просмотр без сборки:

```bash
python3 -m http.server 8080 --directory web
```

Затем открыть `http://localhost:8080`. Для Pages нужно один раз выбрать
`Settings → Pages → Source: GitHub Actions`.

## Статус

Каркас и product decision созданы. Статический web app опубликован как демо.
Интеграция с внешними источниками начнётся только после отдельной source
investigation и прохождения Go/Pivot/Stop gate; текущий статус зафиксирован в
`docs/live-data-gate.md`.
