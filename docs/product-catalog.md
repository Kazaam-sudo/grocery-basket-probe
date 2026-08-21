# Каталог реальных товаров для выбора

В прототип добавлен небольшой справочник конкретных фасованных товаров. Пользователь вводит часть названия, выбирает карточку из подсказки, после чего в корзину попадают зафиксированные name, brand, pack и, где найден в публичном источнике, gtin.

## Что считается реальным

- название и упаковка взяты из публичной карточки производителя или товара;
- для каждой карточки сохранена ссылка на источник в web/data/product-catalog.json;
- это не текущий каталог Перекрёстка и не источник цены;
- цены и наличие остаются демонстрационными до разрешённого подключения retailer feed.

Источники выборки: [Простоквашино](https://prostokvashino.ru/product/moloko-pasterizovannoe-2-5-930-ml/), [Агуша](https://agulife.ru/), [Makfa](https://www.makfa.ru/catalog/makaronnaya-produktsiya/klassicheskie-makaronnye-izdeliya/), [Jardin](https://jardincoffee.ru/coffee/dessert_cup/), [Экомилк](https://ecomilk.ru/catalog/ecomilk/butter/maslo_sliva/), [Мистраль](https://m.integration.vs.market.yandex.net/card/ris-mistral-kuban-900-g/5715033340), [Zewa](https://zewa-russia.ru/products_category/tualetnaya_bumaga/bolshie-upakovki-tualetnaya-bumaga/), [Роскар](https://www.roskar.ru/nasha-produkciya), [Святой Источник](https://svyatoyistochnik.com/products/), [Добрый](https://dobry.ru/catalog/juice/apple/).

## Ограничения

Справочник намеренно небольшой и статичный, чтобы GitHub Pages не зависел от внешнего API автодополнения. Добавление новых товаров должно проходить через проверку источника и не должно создавать видимость актуальной цены или наличия.