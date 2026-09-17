"""Celery tasks for the core application."""

from core.tasks.notifications import process_document_version

__all__ = ["process_document_version"]