#!/usr/bin/env python3
"""Check if current time (America/New_York) is within 2 minutes of a publish slot. Exit 0 and print in_window=true/false."""

import os
import sys
from datetime import datetime

from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
# 5 targets per US trading day (seconds since midnight)
TARGETS = [
    9 * 3600 + 30 * 60,           # 09:30:00
    10 * 3600 + 52 * 60 + 30,     # 10:52:30
    12 * 3600 + 15 * 60,          # 12:15:00
    13 * 3600 + 37 * 60 + 30,     # 13:37:30
    15 * 3600 + 0 * 60,           # 15:00:00
]
WINDOW_SEC = 120  # 2 minutes before/after


def main() -> int:
    now = datetime.now(NY).time()
    secs = now.hour * 3600 + now.minute * 60 + now.second
    for t in TARGETS:
        if abs(secs - t) <= WINDOW_SEC:
            print("in_window=true")
            return 0
    print("in_window=false")
    return 0


if __name__ == "__main__":
    sys.exit(main())
