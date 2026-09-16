"""Tasks dedicated to notifications."""

import logging

from core import models
from impress.celery_app import app


logger = logging.getLogger(__name__)


@app.task
def process_document_version(
    document_id,
    version_id,
    saved_at,
    contributor_user_ids,
):
    """Process a saved document version for notifications."""

    try:
        document = models.Document.objects.get(id=document_id)
    except models.Document.DoesNotExist:
        logger.warning(
            "Unable to process notification: document %s does not exist",
            document_id,
        )
        return

    contributors = models.User.objects.filter(id__in=contributor_user_ids)

    contributor_names = [
        user.full_name or user.short_name or str(user.id)
        for user in contributors
    ]

    configurations = models.NotificationSetting.objects.filter(
        document=document,
        enabled=True,
    ).select_related("user")

    logger.info(
        "Processing document version "
        "document_id=%s title=%s version_id=%s saved_at=%s contributors=%s",
        document.id,
        document.title,
        version_id,
        saved_at,
        contributor_names,
    )

    for configuration in configurations:
        logger.info(
            "Notification candidate "
            "user_id=%s frequency=%s last_sent_at=%s destination=%s",
            configuration.user_id,
            configuration.frequency,
            configuration.last_sent_at,
            configuration.tchap_destination,
        )
