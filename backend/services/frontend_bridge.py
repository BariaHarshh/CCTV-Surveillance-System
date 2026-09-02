"""
Frontend Bridge Service
Handles HTTP communication between Python ML Backend and Next.js Frontend Internal API.
Includes diagnostic status logging and automatic IPv4 loopback fallback.
"""

import logging
from typing import Optional, Tuple
import httpx

from backend.config import settings
from backend.schemas.detection import DetectionPayload, BridgeResult

logger = logging.getLogger("ml_bridge")
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(levelname)s] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class FrontendBridgeService:
    """Service to forward detection payloads to the Next.js frontend."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 5.0,
    ):
        self.base_url = (base_url or settings.frontend_base_url).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.internal_events_api_key
        self.timeout = timeout

    @property
    def target_url(self) -> str:
        return f"{self.base_url}/api/internal/detection"

    def _get_candidate_urls(self) -> Tuple[str, Optional[str]]:
        """Returns primary target URL and optional 127.0.0.1 fallback URL if localhost."""
        primary = self.target_url
        fallback = None
        if "://localhost:" in primary or "://localhost/" in primary or primary.endswith("://localhost"):
            fallback = primary.replace("://localhost", "://127.0.0.1", 1)
        return primary, fallback

    async def _post_payload(self, client: httpx.AsyncClient, url: str, headers: dict, json_data: dict) -> httpx.Response:
        return await client.post(url, headers=headers, json=json_data)

    async def send_detection(self, payload: DetectionPayload) -> BridgeResult:
        """
        Sends a detection payload to Next.js POST /api/internal/detection.
        Catches connection errors gracefully so ML execution does not crash.
        """
        print(f"[ML-BRIDGE] Sending detection")
        print(f"[ML-BRIDGE] Camera: {payload.cameraId}")
        print(f"[ML-BRIDGE] Module: {payload.moduleType}")
        print(f"[ML-BRIDGE] Confidence: {payload.confidence}")

        headers = {
            "Content-Type": "application/json",
            "x-internal-service-key": self.api_key,
        }

        primary_url, fallback_url = self._get_candidate_urls()
        urls_to_try = [primary_url]
        if fallback_url and fallback_url != primary_url:
            urls_to_try.append(fallback_url)

        last_error = None

        for url in urls_to_try:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await self._post_payload(client, url, headers, payload.model_dump())

                    status_code = response.status_code

                    if response.is_success:
                        print(f"[ML-BRIDGE] Frontend response: {status_code}")
                    elif status_code in (401, 403):
                        print(f"[ML-BRIDGE] Authentication failed (HTTP {status_code}): check INTERNAL_EVENTS_API_KEY")
                    elif status_code == 404:
                        print(f"[ML-BRIDGE] Detection endpoint not found (HTTP 404) at {url}")
                    else:
                        print(f"[ML-BRIDGE] Frontend error HTTP {status_code}: {response.text}")

                    try:
                        response_json = response.json()
                    except Exception:
                        response_json = {"text": response.text}

                    is_success = response.is_success
                    return BridgeResult(
                        success=is_success,
                        statusCode=status_code,
                        data=response_json,
                        error=None if is_success else f"HTTP {status_code}: {response.text}",
                    )

            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                last_error = f"Frontend offline or unreachable at {self.base_url}"
                # If there's a fallback URL (e.g. 127.0.0.1), loop will try it next
                continue
            except httpx.TimeoutException as exc:
                last_error = f"Frontend request timed out at {self.base_url}"
                break
            except httpx.RequestError as exc:
                last_error = f"Frontend request failed ({type(exc).__name__}): {exc}"
                break
            except Exception as exc:
                last_error = f"Unexpected error while sending detection: {exc}"
                break

        print(f"[ML-BRIDGE] {last_error}")
        return BridgeResult(
            success=False,
            statusCode=None,
            data=None,
            error=last_error,
        )


frontend_bridge = FrontendBridgeService()
