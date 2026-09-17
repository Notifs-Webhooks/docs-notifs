"""Celery tasks for the core application."""

from core.tasks.notifications import (
    dispatch_due_notification_digests,
    process_document_version,
)

__all__ = ["dispatch_due_notification_digests", "process_document_version"]
