from fastapi import FastAPI

app = FastAPI(title="Grocery Basket Probe", version="0.1.0")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Liveness endpoint; it does not contact a retailer."""
    return {"status": "ok", "scope": "technical-probe"}
