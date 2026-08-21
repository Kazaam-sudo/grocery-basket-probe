import httpx
import pytest

from grocery_basket_probe.connectors.source_probe import ProbeStatus, PublicSourceProbe


@pytest.mark.asyncio
async def test_probe_marks_public_response_available_without_claiming_catalog() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert "authorization" not in request.headers
        return httpx.Response(200, headers={"content-type": "application/json"}, json={"ok": True})

    transport = httpx.MockTransport(handler)
    async with PublicSourceProbe(httpx.AsyncClient(transport=transport)) as probe:
        result = await probe.probe("example", "https://example.test/catalog")

    assert result.status is ProbeStatus.AVAILABLE
    assert result.http_status == 200
    assert result.detail.endswith("address binding are not yet verified")


@pytest.mark.asyncio
async def test_probe_stops_on_forbidden_response() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(403))
    async with PublicSourceProbe(httpx.AsyncClient(transport=transport)) as probe:
        result = await probe.probe("retailer", "https://retailer.test/catalog")

    assert result.status is ProbeStatus.BLOCKED
    assert "no bypass" in result.detail


@pytest.mark.asyncio
async def test_probe_marks_challenge_page_blocked() -> None:
    response = httpx.Response(
        200,
        request=httpx.Request("GET", "https://retailer.test/access-check"),
        text="access-check",
    )
    transport = httpx.MockTransport(lambda _: response)
    async with PublicSourceProbe(httpx.AsyncClient(transport=transport)) as probe:
        result = await probe.probe("retailer", "https://retailer.test/catalog")

    assert result.status is ProbeStatus.BLOCKED
