"""Utilities for formatting notification messages."""

from django.utils import timezone
from django.utils.dateparse import parse_datetime


def format_notification_message(
    document_title,
    contributor_names,
    saved_at,
):
    """Format a document update notification message."""

    if not contributor_names:
        contributors = "an unknown contributor"
    elif len(contributor_names) == 1:
        contributors = contributor_names[0]
    else:
        contributors = ", ".join(contributor_names[:-1])
        contributors += f" and {contributor_names[-1]}"

    saved_datetime = parse_datetime(saved_at)

    if saved_datetime is not None:
        if timezone.is_aware(saved_datetime):
            saved_datetime = timezone.localtime(saved_datetime)

        saved_time = saved_datetime.strftime("%H:%M")
    else:
        saved_time = saved_at

    return (
        f'"{document_title}" was modified '
        f'by {contributors} at {saved_time}.'
    )
