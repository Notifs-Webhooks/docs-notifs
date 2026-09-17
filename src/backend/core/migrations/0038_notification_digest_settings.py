from django.db import migrations, models


def migrate_legacy_frequencies(apps, schema_editor):
    """Map prototype frequencies to the supported digest frequencies."""

    notification_setting = apps.get_model("core", "NotificationSetting")
    notification_setting.objects.filter(frequency__in=["immediate", "daily"]).update(
        frequency="hourly"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0037_merge_20260916_1819"),
    ]

    operations = [
        migrations.RunPython(
            migrate_legacy_frequencies,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddField(
            model_name="notificationsetting",
            name="last_checked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RemoveField(
            model_name="notificationsetting",
            name="tchap_destination",
        ),
        migrations.AlterField(
            model_name="notificationsetting",
            name="frequency",
            field=models.CharField(
                choices=[
                    ("hourly", "Hourly"),
                    ("weekly", "Weekly"),
                    ("monthly", "Monthly"),
                ],
                default="hourly",
                max_length=20,
            ),
        ),
    ]
