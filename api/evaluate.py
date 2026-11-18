"""Run the fixed synthetic benchmark with python evaluate.py."""
import json
from statistics import median
from time import perf_counter

from main import Line, inspect

CASES = {
    "clean": lambda n: ("AF-102", n + 1, "CASE", "96.00", False),
    "missing unit": lambda n: ("AF-102", n + 1, "", "96.00", True),
    "pricing": lambda n: ("AF-102", n + 1, "CASE", "95.00", True),
    "stock": lambda n: ("AF-102", n + 41, "CASE", "96.00", True),
    "mapping": lambda n: (f"UNKNOWN-{n}", n + 1, "EACH", "8.00", True),
}

if __name__ == "__main__":
    false_alerts = missed = 0
    times = []
    for factory in CASES.values():
        for index in range(8):
            part, quantity, unit, price, expected = factory(index)
            start = perf_counter()
            actual = bool(inspect([Line(part=part, quantity=quantity, unit=unit, price=price)], {})[0]["exceptions"])
            times.append((perf_counter() - start) * 1000)
            false_alerts += actual and not expected
            missed += expected and not actual
    print(json.dumps({"synthetic_cases": len(times), "false_alerts": false_alerts,
                      "missed_exceptions": missed, "median_rules_latency_ms": round(median(times), 4)},
                     indent=2))
    raise SystemExit(bool(false_alerts or missed))
