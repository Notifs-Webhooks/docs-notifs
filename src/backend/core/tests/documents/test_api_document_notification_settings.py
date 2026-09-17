"""Tests for per-document Tchap digest settings."""

import pytest
import responses
from rest_framework import status
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


@pytest.fixture(name="notifier_settings")
def fixture_notifier_settings(settings):
    settings.NOTIFIER_API_URL = "http://notifier.test"
    settings.NOTIFIER_API_TOKEN = "test-token"
    settings.NOTIFIER_RECIPIENT = "@bob:localhost"
    settings.NOTIFIER_REQUEST_TIMEOUT = 2
    return settings


@pytest.fixture(name="user_document")
def fixture_user_document():
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="reader")
    return user, document


@responses.activate
def test_enabling_digest_subscribes_bob_and_persists_setting(
    notifier_settings,
    user_document,
):
    user, document = user_document
    notifier_call = responses.post(
        "http://notifier.test/v1/subscriptions",
        json={
            "recipient": "@bob:localhost",
            "status": "pending",
            "room_id": "!room:localhost",
        },
        status=202,
    )
    client = APIClient()
    client.force_login(user)

    response = client.put(
        f"/api/v1.0/documents/{document.id}/notification-settings/",
        {"frequency": "weekly"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["subscription_status"] == "pending"
    assert notifier_call.call_count == 1
    assert notifier_call.calls[0].request.headers["Authorization"] == (
        "Bearer test-token"
    )
    assert notifier_call.calls[0].request.body == b'{"recipient": "@bob:localhost"}'
    setting = models.NotificationSetting.objects.get(user=user, document=document)
    assert setting.enabled is True
    assert setting.frequency == "weekly"
    assert setting.last_checked_at is not None


@responses.activate
def test_disabling_last_document_revokes_global_subscription(
    notifier_settings,
    user_document,
):
    user, document = user_document
    models.NotificationSetting.objects.create(
        user=user,
        document=document,
        frequency="hourly",
        enabled=True,
    )
    notifier_call = responses.delete(
        "http://notifier.test/v1/subscriptions",
        json={
            "recipient": "@bob:localhost",
            "status": "revoked",
            "room_id": "!room:localhost",
        },
        status=200,
    )
    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/notification-settings/"
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["enabled"] is False
    assert notifier_call.call_count == 1
    assert models.NotificationSetting.objects.get().enabled is False


@responses.activate
def test_disabling_one_document_keeps_shared_subscription(
    notifier_settings,
    user_document,
):
    user, document = user_document
    models.NotificationSetting.objects.create(
        user=user,
        document=document,
        frequency="hourly",
        enabled=True,
    )
    models.NotificationSetting.objects.create(
        user=factories.UserFactory(),
        document=factories.DocumentFactory(),
        frequency="weekly",
        enabled=True,
    )
    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/notification-settings/"
    )

    assert response.status_code == status.HTTP_200_OK
    assert len(responses.calls) == 0
    assert models.NotificationSetting.objects.filter(enabled=True).count() == 1


@responses.activate
def test_instant_frequency_is_rejected(notifier_settings, user_document):
    user, document = user_document
    client = APIClient()
    client.force_login(user)

    response = client.put(
        f"/api/v1.0/documents/{document.id}/notification-settings/",
        {"frequency": "immediate"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert len(responses.calls) == 0
