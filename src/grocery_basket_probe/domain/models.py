from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import NewType

from pydantic import BaseModel, Field, HttpUrl


RetailerCode = NewType("RetailerCode", str)
SourceProductId = NewType("SourceProductId", str)


class Availability(StrEnum):
    IN_STOCK = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    UNKNOWN = "unknown"


class PriceType(StrEnum):
    REGULAR = "regular"
    PROMOTIONAL = "promotional"
    LOYALTY = "loyalty"
    UNKNOWN = "unknown"


class AddressContext(BaseModel):
    """A non-personal identifier for the source's selected delivery context."""

    test_address_id: str
    source_zone_id: str | None = None
    source_store_id: str | None = None
    address_fingerprint: str = Field(min_length=16, max_length=128)


class SourceOffer(BaseModel):
    """The minimum auditable fact set emitted by every retailer connector."""

    retailer: RetailerCode
    source_product_id: SourceProductId
    name: str
    normalized_name: str | None = None
    brand: str | None = None
    quantity_value: Decimal | None = Field(default=None, gt=0)
    quantity_unit: str | None = None
    regular_price: Decimal | None = Field(default=None, ge=0)
    promotional_price: Decimal | None = Field(default=None, ge=0)
    observed_price: Decimal | None = Field(default=None, ge=0)
    observed_price_type: PriceType = PriceType.UNKNOWN
    availability: Availability = Availability.UNKNOWN
    url: HttpUrl
    source_zone_id: str | None = None
    source_store_id: str | None = None
    fetched_at: datetime


class ConnectorHealth(BaseModel):
    retailer: RetailerCode
    healthy: bool
    checked_at: datetime
    detail: str | None = None
