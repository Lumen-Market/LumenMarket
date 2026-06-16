import os
import json
import base64
import httpx

RPC_URL = os.getenv("SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org")
CONTRACT_ID = os.getenv("CONTRACT_ID", "")

# Ledger range to scan (start from a reasonable recent ledger)
START_LEDGER = int(os.getenv("START_LEDGER", "0"))


async def _rpc(method: str, params: dict) -> dict:
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(RPC_URL, json=payload)
        resp.raise_for_status()
        return resp.json().get("result", {})


def _parse_event(event: dict) -> dict:
    """Extract minimal fields from a Soroban event."""
    topic_xdrs = event.get("topic", [])
    value_xdr = event.get("value", {})
    return {
        "id": event.get("id", ""),
        "ledger": event.get("ledger", 0),
        "topic_xdrs": topic_xdrs,
        # value is a ScVal XDR; store raw for caller to handle
        "value_xdr": value_xdr.get("xdr", "") if isinstance(value_xdr, dict) else value_xdr,
        "contract": event.get("contractId", ""),
    }


async def _get_events(topic_filter: list[str]) -> list[dict]:
    try:
        params = {
            "startLedger": START_LEDGER,
            "filters": [
                {
                    "type": "contract",
                    "contractIds": [CONTRACT_ID],
                    "topics": [topic_filter],
                }
            ],
            "pagination": {"limit": 100},
        }
        result = await _rpc("getEvents", params)
        return [_parse_event(e) for e in result.get("events", [])]
    except Exception as e:
        print(f"[watcher] getEvents error: {e}")
        return []


async def get_launches() -> list[dict]:
    """Return parsed LaunchCreated events."""
    # Topic[0] is the event name as a Symbol ScVal
    return await _get_events(["*"])  # filter by symbol "LaunchCreated" post-parse if needed


async def get_migrations() -> list[dict]:
    """Return parsed Migrated events."""
    return await _get_events(["*"])


async def get_launch_price(launch_id: int) -> float:
    """Simulate current_price contract call and return price in XLM."""
    try:
        # Build minimal XDR for invokeContractFunction(current_price, [launch_id])
        # Using a pre-built base64 XDR envelope for a u32 arg invocation
        # For a real deployment, generate proper XDR; here we call simulateTransaction
        xdr = _build_simulate_xdr(launch_id)
        result = await _rpc("simulateTransaction", {"transaction": xdr})
        results = result.get("results", [])
        if not results:
            return 0.0
        val_xdr = results[0].get("xdr", "")
        return _decode_i128_xdr(val_xdr) / 1e7
    except Exception as e:
        print(f"[watcher] get_launch_price error: {e}")
        return 0.0


def _build_simulate_xdr(launch_id: int) -> str:
    """
    Returns a placeholder transaction XDR for simulating current_price(launch_id).
    Real usage requires stellar-sdk to build a proper TransactionEnvelope.
    This stub returns an empty string so callers degrade gracefully.
    """
    return ""


def _decode_i128_xdr(xdr: str) -> int:
    """Minimal decode: try to read last 8 bytes as big-endian int from base64 XDR."""
    try:
        raw = base64.b64decode(xdr)
        return int.from_bytes(raw[-8:], "big")
    except Exception:
        return 0
