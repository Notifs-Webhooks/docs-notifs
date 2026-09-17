"""Force enabled document digest windows to close now."""

from django.core.management.base import BaseCommand

from core.tasks.notifications import dispatch_due_notification_digests


class Command(BaseCommand):
    """Send non-empty enabled document digests without waiting for their due time."""

    help = (
        "Check every enabled document notification setting immediately and send "
        "a digest only when saved changes exist."
    )

    def handle(self, *args, **options):
        results = dispatch_due_notification_digests(force=True)
        summary = " ".join(f"{key}={value}" for key, value in results.items())
        self.stdout.write(
            self.style.SUCCESS(f"Forced digest check complete: {summary}")
        )
