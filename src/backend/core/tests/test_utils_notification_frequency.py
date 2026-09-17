from datetime import datetime, timedelta

import pytest

from core.utils.notification_frequency import next_digest_at

NOW = datetime(2026, 1, 8, 12, 0, 0)


def test_invalid_frequency_raises_value_error():
    with pytest.raises(ValueError, match="Unknown notification frequency: daily"):
        next_digest_at(NOW, "daily")


@pytest.mark.parametrize(
    ("frequency", "expected"),
    [
        ("hourly", NOW + timedelta(hours=1)),
        ("weekly", NOW + timedelta(weeks=1)),
        ("monthly", datetime(2026, 2, 8, 12, 0, 0)),
    ],
)
def test_next_digest_at(frequency, expected):
    assert next_digest_at(NOW, frequency) == expected


def test_monthly_digest_clamps_to_last_day_of_month():
    assert next_digest_at(datetime(2026, 1, 31, 12), "monthly") == datetime(
        2026, 2, 28, 12
    )
