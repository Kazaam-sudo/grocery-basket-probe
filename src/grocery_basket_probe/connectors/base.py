from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol

from grocery_basket_probe.domain.models import AddressContext, ConnectorHealth, SourceOffer


class RetailerConnector(Protocol):
    """Stable boundary between application code and a retailer-specific source.

    Implementations must be read-only and must reject any flow that needs login,
    CAPTCHA bypass, mobile-app credentials, aggressive retrying, or rate-limit evasion.
    """

    code: str

    async def health_check(self) -> ConnectorHealth: ...

    async def set_address_context(self, test_address_id: str) -> AddressContext: ...

    async def search(
        self, query: str, context: AddressContext, *, limit: int = 20
    ) -> list[SourceOffer]: ...

    async def get_product(
        self, source_product_id: str, context: AddressContext
    ) -> SourceOffer | None: ...

    async def iter_catalog(
        self, context: AddressContext, category_id: str | None = None
    ) -> AsyncIterator[SourceOffer]: ...
