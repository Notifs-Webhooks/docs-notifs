"""HTTP client for the Tchap Notifier service."""

from django.conf import settings

import requests


class NotifierError(RuntimeError):
    """Base error raised when Notifier cannot fulfill a request."""


class NotifierUnavailableError(NotifierError):
    """Notifier could not be reached or returned a server error."""


class NotifierSubscriptionRequiredError(NotifierError):
    """The Tchap recipient no longer has a usable subscription."""


class NotifierClient:
    """Call Notifier without exposing its bearer token to the browser."""

    def __init__(self):
        if not settings.NOTIFIER_API_URL or not settings.NOTIFIER_API_TOKEN:
            raise NotifierUnavailableError("Tchap Notifier is not configured")

        self.base_url = settings.NOTIFIER_API_URL.rstrip("/")
        self.recipient = settings.NOTIFIER_RECIPIENT
        self.timeout = settings.NOTIFIER_REQUEST_TIMEOUT
        self.headers = {
            "Authorization": f"Bearer {settings.NOTIFIER_API_TOKEN}",
            "Content-Type": "application/json",
        }

    def _request(self, method, path, *, expected_statuses, **kwargs):
        try:
            response = requests.request(
                method,
                f"{self.base_url}{path}",
                headers=self.headers,
                timeout=self.timeout,
                **kwargs,
            )
        except requests.RequestException as err:
            raise NotifierUnavailableError("Tchap Notifier is unreachable") from err

        if response.status_code not in expected_statuses:
            if response.status_code == 409:
                raise NotifierSubscriptionRequiredError(
                    "The Tchap subscription is no longer active"
                )
            raise NotifierUnavailableError(
                f"Tchap Notifier returned HTTP {response.status_code}"
            )

        if response.status_code in {204, 404}:
            return None
        return response.json()

    def subscribe(self):
        """Create or reuse the configured recipient's conversation."""

        return self._request(
            "POST",
            "/v1/subscriptions",
            expected_statuses={202},
            json={"recipient": self.recipient},
        )

    def get_subscription(self):
        """Return the current Matrix subscription, or ``None`` if unknown."""

        return self._request(
            "GET",
            "/v1/subscriptions",
            expected_statuses={200, 404},
            params={"recipient": self.recipient},
        )

    def unsubscribe(self):
        """Revoke the configured recipient's global conversation."""

        return self._request(
            "DELETE",
            "/v1/subscriptions",
            expected_statuses={200, 404},
            params={"recipient": self.recipient},
        )

    def send_document_digest(self, payload):
        """Queue one document digest for delivery by Notifier."""

        return self._request(
            "POST",
            "/v1/notifications",
            expected_statuses={202},
            json={"recipient": self.recipient, **payload},
        )
