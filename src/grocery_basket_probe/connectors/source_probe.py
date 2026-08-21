"""Low-frequency, read-only probes for retailer source gates.

The probe answers only whether a public URL is reachable.  A reachable page is
not treated as a catalog integration until its product fields and address
context have been verified separately.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Self

import httpx
from pydantic import BaseModel, HttpUrl


class ProbeStatus(StrEnum):
    AVAILABLE = "available"
    BLOCKED = "blocked"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"


class SourceProbeResult(BaseModel):
    source: str
    requested_url: HttpUrl
    response_url: HttpUrl | None = None
    status: ProbeStatus
    http_status: int | None = None
    content_type: str | None = None
    checked_at: datetime
    detail: str


class PublicSourceProbe:
    """Perform a single low-frequency GET with no authentication or retries."""

    _challenge_markers = (
        "captcha",
        "access-check",
        "challenge",
        "verify you are human",
        "проверка безопасности",
    )

    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        *,
        timeout_seconds: float = 15.0,
        user_agent: str = "grocery-basket-probe/source-gate (+read-only)",
    ) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=timeout_seconds,
            follow_redirects=True,
            headers={
                "Accept": "text/html,application/json;q=0.9,*/*;q=0.1",
                "User-Agent": user_agent,
            },
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def probe(self, source: str, url: str) -> SourceProbeResult:
        """Probe ``url`` once and classify only the observable response."""

        checked_at = datetime.now(UTC)
        try:
            response = await self._client.get(url)
        except httpx.TimeoutException:
            return SourceProbeResult(
                source=source,
                requested_url=url,
                status=ProbeStatus.UNAVAILABLE,
                checked_at=checked_at,
                detail="request timed out; no retry was attempted",
            )
        except httpx.HTTPError as exc:
            return SourceProbeResult(
                source=source,
                requested_url=url,
                status=ProbeStatus.UNKNOWN,
                checked_at=checked_at,
                detail=f"HTTP client error: {type(exc).__name__}",
            )

        response_url = str(response.url)
        content_type = response.headers.get("content-type")
        status = self._classify(response)
        detail = self._detail(response, status)
        return SourceProbeResult(
            source=source,
            requested_url=url,
            response_url=response_url,
            status=status,
            http_status=response.status_code,
            content_type=content_type,
            checked_at=checked_at,
            detail=detail,
        )

    def _classify(self, response: httpx.Response) -> ProbeStatus:
        if response.status_code in {401, 403, 429}:
            return ProbeStatus.BLOCKED
        if response.status_code >= 500 or response.status_code in {408, 425}:
            return ProbeStatus.UNAVAILABLE
        if response.status_code < 200 or response.status_code >= 300:
            return ProbeStatus.UNKNOWN

        response_path = response.url.path.lower()
        body_prefix = response.text[:4096].lower()
        if any(
            marker in response_path or marker in body_prefix
            for marker in self._challenge_markers
        ):
            return ProbeStatus.BLOCKED
        return ProbeStatus.AVAILABLE

    @staticmethod
    def _detail(response: httpx.Response, status: ProbeStatus) -> str:
        if status is ProbeStatus.AVAILABLE:
            content_type = response.headers.get("content-type", "unknown content type")
            return (
                f"public response reachable ({content_type}); product extraction and "
                "address binding are not yet verified"
            )
        if status is ProbeStatus.BLOCKED:
            return "access control, challenge, or rate limit observed; no bypass attempted"
        if status is ProbeStatus.UNAVAILABLE:
            return "source returned a transient/server error; no retry was attempted"
        return f"source returned HTTP {response.status_code}"
