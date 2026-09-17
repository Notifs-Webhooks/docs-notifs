"""Tasks dedicated to notifications."""

import logging

from django.conf import settings
from django.utils import timezone

from core import models
from core.services.notifier import (
    NotifierClient,
    NotifierSubscriptionRequiredError,
    NotifierUnavailableError,
)
from core.utils.notification_frequency import next_digest_at

from impress.celery_app import app

logger = logging.getLogger(__name__)


@app.task
def process_document_version(
    document_id,
    version_id,
    saved_at,
    contributor_user_ids,
):
    """Log a saved version; periodic digest delivery reads persisted versions."""

    try:
        document = models.Document.objects.get(id=document_id)
    except models.Document.DoesNotExist:
        logger.warning(
            "Unable to process notification: document %s does not exist",
            document_id,
        )
        return

    logger.info(
        "Document version ready for a future digest "
        "document_id=%s title=%s version_id=%s saved_at=%s contributors=%s",
        document.id,
        document.title,
        version_id,
        saved_at,
        contributor_user_ids,
    )


def _user_display_name(user):
    return user.full_name or user.short_name or user.email or str(user.id)


def _dispatch_setting_digest(setting, now, *, force=False):
    """Dispatch one due window and advance it only after a conclusive check."""

    window_start = setting.last_checked_at or setting.created_at
    window_end = now if force else next_digest_at(window_start, setting.frequency)
    if window_end > now:
        return "not_due"

    versions = list(
        models.DocumentVersion.objects.filter(
            document=setting.document,
            created_at__gt=window_start,
            created_at__lte=window_end,
        ).prefetch_related("contributors")
    )

    if not versions:
        models.NotificationSetting.objects.filter(pk=setting.pk).update(
            last_checked_at=window_end,
        )
        return "empty"

    contributors = {
        _user_display_name(contributor)
        for version in versions
        for contributor in version.contributors.all()
    }
    actor_name = (", ".join(sorted(contributors)) or "Unknown contributor")[:200]
    document_base_url = (settings.LOGIN_REDIRECT_URL or "").rstrip("/")
    document_url = (
        f"{document_base_url}/docs/{setting.document_id}" if document_base_url else None
    )

    payload = {
        "idempotency_key": f"digest:{setting.id}:{window_end.isoformat()}",
        "actor_name": actor_name,
        "document_id": str(setting.document_id),
        "document_title": setting.document.title or "Untitled document",
        "document_url": document_url,
        "change_type": "updated",
        "change_count": len(versions),
        "period_start": window_start.isoformat(),
        "period_end": window_end.isoformat(),
        "occurred_at": window_end.isoformat(),
    }

    try:
        NotifierClient().send_document_digest(payload)
    except NotifierSubscriptionRequiredError:
        models.NotificationSetting.objects.filter(pk=setting.pk).update(enabled=False)
        logger.warning(
            "Disabled document digest after the Tchap subscription was revoked: %s",
            setting.pk,
        )
        return "disabled"
    except NotifierUnavailableError:
        logger.warning(
            "Tchap Notifier is unavailable; digest window %s will be retried",
            window_end,
            exc_info=True,
        )
        return "unavailable"

    models.NotificationSetting.objects.filter(pk=setting.pk).update(
        last_checked_at=window_end,
        last_sent_at=timezone.now(),
    )
    return "sent"


@app.task
def dispatch_due_notification_digests(force=False):
    """Check enabled settings and optionally close their current window now."""

    now = timezone.now()
    results = {
        "sent": 0,
        "empty": 0,
        "not_due": 0,
        "disabled": 0,
        "unavailable": 0,
    }
    settings_to_check = models.NotificationSetting.objects.filter(
        enabled=True,
    ).select_related("document")

    for setting in settings_to_check.iterator():
        result = _dispatch_setting_digest(setting, now, force=force)
        results[result] += 1

    logger.info("Document digest scan completed: force=%s results=%s", force, results)
    return results
