from datetime import UTC, datetime
from decimal import Decimal

from grocery_basket_probe.domain.models import Availability, PriceType, SourceOffer


def test_source_offer_keeps_auditable_facts() -> None:
    offer = SourceOffer(
        retailer="perekrestok",
        source_product_id="example-1",
        name="Молоко, 1 л",
        quantity_value=Decimal("1"),
        quantity_unit="l",
        observed_price=Decimal("99.90"),
        observed_price_type=PriceType.REGULAR,
        availability=Availability.IN_STOCK,
        url="https://example.invalid/product/example-1",
        fetched_at=datetime.now(UTC),
    )

    assert offer.source_product_id == "example-1"
    assert offer.observed_price == Decimal("99.90")
