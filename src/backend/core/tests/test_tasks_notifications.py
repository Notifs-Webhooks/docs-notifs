"""Tests for scheduled document notification digests."""

import json
from datetime import timedelta

from django.utils import timezone

import pytest
import responses

from core import factories, models
from core.tasks.notifications import dispatch_due_notification_digests

pytestmark = pytest.mark.django_db


@pytest.fixture(name="notifier_settings")
def fixture_notifier_settings(settings):
    settings.NOTIFIER_API_URL = "http://notifier.test"
    settings.NOTIFIER_API_TOKEN = "test-token"
    settings.NOTIFIER_RECIPIENT = "@bob:localhost"
    settings.NOTIFIER_REQUEST_TIMEOUT = 2
    settings.LOGIN_REDIRECT_URL = "http://docs.test"
    return settings


def create_due_digest():
    subscriber = factories.UserFactory()
    contributor = factories.UserFactory(full_name="Alice Editor")
    document = factories.DocumentFactory(title="Project roadmap")
    window_start = timezone.now() - timedelta(hours=2)
    setting = models.NotificationSetting.objects.create(
        user=subscriber,
        document=document,
        enabled=True,
        frequency="hourly",
        last_checked_at=window_start,
    )
    version = models.DocumentVersion.objects.create(
        document=document,
        version_id="version-1",
        etag="etag-1",
    )
    models.DocumentVersion.objects.filter(pk=version.pk).update(
        created_at=window_start + timedelta(minutes=30)
    )
    version.contributors.add(contributor)
    return setting


@responses.activate
def test_due_non_empty_window_sends_one_digest(notifier_settings):
    setting = create_due_digest()
    notifier_call = responses.post(
        "http://notifier.test/v1/notifications",
        json={
            "delivery_id": "delivery-1",
            "idempotency_key": "key",
            "recipient": "@bob:localhost",
            "status": "queued",
        },
        status=202,
    )

    dispatch_due_notification_digests()

    setting.refresh_from_db()
    assert notifier_call.call_count == 1
    payload = json.loads(notifier_call.calls[0].request.body)
    assert payload["recipient"] == "@bob:localhost"
    assert payload["document_title"] == "Project roadmap"
    assert payload["actor_name"] == "Alice Editor"
    assert payload["change_count"] == 1
    assert payload["document_url"].endswith(f"/docs/{setting.document_id}")
    assert setting.last_checked_at is not None
    assert setting.last_sent_at is not None


@responses.activate
def test_empty_window_advances_without_sending(notifier_settings):
    subscriber = factories.UserFactory()
    document = factories.DocumentFactory()
    window_start = timezone.now() - timedelta(hours=2)
    setting = models.NotificationSetting.objects.create(
        user=subscriber,
        document=document,
        enabled=True,
        frequency="hourly",
        last_checked_at=window_start,
    )

    dispatch_due_notification_digests()

    setting.refresh_from_db()
    assert len(responses.calls) == 0
    assert setting.last_checked_at == window_start + timedelta(hours=1)
    assert setting.last_sent_at is None


@responses.activate
def test_failed_delivery_keeps_window_for_retry(notifier_settings):
    setting = create_due_digest()
    responses.post("http://notifier.test/v1/notifications", status=503)

    dispatch_due_notification_digests()

    previous_window = setting.last_checked_at
    setting.refresh_from_db()
    assert setting.last_checked_at == previous_window
    assert setting.last_sent_at is None


@responses.activate
def test_revoked_subscription_disables_document_digest(notifier_settings):
    setting = create_due_digest()
    responses.post("http://notifier.test/v1/notifications", status=409)

    dispatch_due_notification_digests()

    setting.refresh_from_db()
    assert setting.enabled is False


@responses.activate
def test_forced_scan_sends_changes_before_frequency_is_due(notifier_settings):
    setting = create_due_digest()
    recent_window_start = timezone.now() - timedelta(minutes=10)
    models.NotificationSetting.objects.filter(pk=setting.pk).update(
        last_checked_at=recent_window_start
    )
    models.DocumentVersion.objects.filter(document=setting.document).update(
        created_at=recent_window_start + timedelta(minutes=5)
    )
    notifier_call = responses.post(
        "http://notifier.test/v1/notifications",
        json={
            "delivery_id": "delivery-forced",
            "idempotency_key": "forced-key",
            "recipient": "@bob:localhost",
            "status": "queued",
        },
        status=202,
    )

    regular_results = dispatch_due_notification_digests()
    forced_results = dispatch_due_notification_digests(force=True)

    setting.refresh_from_db()
    assert regular_results["not_due"] == 1
    assert forced_results["sent"] == 1
    assert notifier_call.call_count == 1
    assert setting.last_checked_at > recent_window_start
    assert setting.last_sent_at is not None
