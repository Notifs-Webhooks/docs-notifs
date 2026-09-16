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

    logger.info(
        "Processing document version "
        "document_id=%s title=%s version_id=%s saved_at=%s contributors=%s",
        document.id,
        document.title,
        version_id,
        saved_at,
        contributor_names,
    )