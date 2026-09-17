import calendar
from datetime import timedelta

FREQUENCY_DELAYS = {
    "hourly": timedelta(hours=1),
    "weekly": timedelta(weeks=1),
}


def next_digest_at(window_start, frequency):
    """Return the end of the next digest window."""

    if frequency == "monthly":
        year = window_start.year + (1 if window_start.month == 12 else 0)
        month = 1 if window_start.month == 12 else window_start.month + 1
        day = min(window_start.day, calendar.monthrange(year, month)[1])
        return window_start.replace(year=year, month=month, day=day)

    try:
        return window_start + FREQUENCY_DELAYS[frequency]
    except KeyError as err:
        raise ValueError(f"Unknown notification frequency: {frequency}") from err
