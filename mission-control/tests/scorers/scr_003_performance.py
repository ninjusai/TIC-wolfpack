"""
SCR-mission-control-003 - Performance Timer

Type: algorithmic
Applies to: EVL-CASE-mission-control-018, 025, 026, 027

Check: Measure elapsed time from trigger event (click, file change) to
completion event. Use performance timestamps.

Pass condition:
- Project switch: <= 2000ms
- File watcher update: <= 5000ms
- Manual reload: <= 3000ms
- List 20 projects: <= 3000ms
"""

import time
from contextlib import contextmanager
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Generator, Optional


class PerformanceThreshold(Enum):
    """Performance thresholds defined in EVL-mission-control-001."""

    PROJECT_SWITCH = 2000  # ms - EVL-CASE-018, 027
    FILE_WATCHER = 5000  # ms - EVL-CASE-025
    MANUAL_RELOAD = 3000  # ms - EVL-CASE-026
    PROJECT_LIST_LOAD = 3000  # ms - EVL-CASE-027
    DB_TABLE_LOAD = 2000  # ms - EVL-CASE-027


@dataclass
class PerformanceResult:
    """Result of a performance measurement."""

    passed: bool
    elapsed_ms: float
    threshold_ms: int
    threshold_type: PerformanceThreshold
    message: str = ""

    @property
    def is_warning(self) -> bool:
        """Check if result is in warning range (1x-1.5x threshold)."""
        return self.threshold_ms < self.elapsed_ms <= self.threshold_ms * 1.5

    @property
    def margin_ms(self) -> float:
        """How much time remains before threshold (negative = over)."""
        return self.threshold_ms - self.elapsed_ms

    @property
    def percentage_of_threshold(self) -> float:
        """Elapsed time as percentage of threshold."""
        if self.threshold_ms == 0:
            return 0.0
        return (self.elapsed_ms / self.threshold_ms) * 100


class PerformanceScorer:
    """
    Scorer that measures operation timing against defined thresholds.

    Used for:
    - Project switch timing (EVL-CASE-018, 027)
    - File watcher detection timing (EVL-CASE-025)
    - Manual reload timing (EVL-CASE-026)
    - List loading timing (EVL-CASE-027)
    """

    def __init__(self):
        """Initialize the Performance Scorer."""
        self._start_time: Optional[float] = None
        self._measurements: list = []

    def start_timer(self) -> None:
        """Start the performance timer."""
        self._start_time = time.perf_counter()

    def stop_timer(self) -> float:
        """Stop the timer and return elapsed time in milliseconds."""
        if self._start_time is None:
            raise RuntimeError("Timer was not started")
        elapsed = (time.perf_counter() - self._start_time) * 1000
        self._start_time = None
        return elapsed

    @contextmanager
    def measure(self) -> Generator[None, None, None]:
        """Context manager for timing a block of code."""
        self.start_timer()
        try:
            yield
        finally:
            pass  # Timer will be stopped by check methods

    def time_operation(self, operation: Callable[[], None]) -> float:
        """
        Time a synchronous operation.

        Args:
            operation: Callable to time

        Returns:
            Elapsed time in milliseconds
        """
        self.start_timer()
        operation()
        return self.stop_timer()

    def check_project_switch(self, elapsed_ms: Optional[float] = None) -> PerformanceResult:
        """
        Check if project switch time is within threshold.

        EVL-CASE-018: Project switch within 2 seconds
        EVL-CASE-027: Switch between any two projects within 2 seconds
        """
        if elapsed_ms is None:
            elapsed_ms = self.stop_timer()

        threshold = PerformanceThreshold.PROJECT_SWITCH
        passed = elapsed_ms <= threshold.value

        result = PerformanceResult(
            passed=passed,
            elapsed_ms=elapsed_ms,
            threshold_ms=threshold.value,
            threshold_type=threshold,
            message=f"Project switch: {elapsed_ms:.1f}ms (threshold: {threshold.value}ms)"
        )

        if passed:
            result.message += " - PASS"
        elif result.is_warning:
            result.message += " - WARNING (approaching threshold)"
        else:
            result.message += " - FAIL"

        self._measurements.append(result)
        return result

    def check_file_watcher(self, elapsed_ms: Optional[float] = None) -> PerformanceResult:
        """
        Check if file watcher update time is within threshold.

        EVL-CASE-025: File watcher detects changes within 5 seconds
        """
        if elapsed_ms is None:
            elapsed_ms = self.stop_timer()

        threshold = PerformanceThreshold.FILE_WATCHER
        passed = elapsed_ms <= threshold.value

        result = PerformanceResult(
            passed=passed,
            elapsed_ms=elapsed_ms,
            threshold_ms=threshold.value,
            threshold_type=threshold,
            message=f"File watcher: {elapsed_ms:.1f}ms (threshold: {threshold.value}ms)"
        )

        if passed:
            result.message += " - PASS"
        else:
            result.message += " - FAIL"

        self._measurements.append(result)
        return result

    def check_manual_reload(self, elapsed_ms: Optional[float] = None) -> PerformanceResult:
        """
        Check if manual reload time is within threshold.

        EVL-CASE-026: Manual reload within 3 seconds
        """
        if elapsed_ms is None:
            elapsed_ms = self.stop_timer()

        threshold = PerformanceThreshold.MANUAL_RELOAD
        passed = elapsed_ms <= threshold.value

        result = PerformanceResult(
            passed=passed,
            elapsed_ms=elapsed_ms,
            threshold_ms=threshold.value,
            threshold_type=threshold,
            message=f"Manual reload: {elapsed_ms:.1f}ms (threshold: {threshold.value}ms)"
        )

        if passed:
            result.message += " - PASS"
        else:
            result.message += " - FAIL"

        self._measurements.append(result)
        return result

    def check_project_list_load(self, elapsed_ms: Optional[float] = None) -> PerformanceResult:
        """
        Check if project list loading time is within threshold.

        EVL-CASE-027: List 20 projects within 3 seconds
        """
        if elapsed_ms is None:
            elapsed_ms = self.stop_timer()

        threshold = PerformanceThreshold.PROJECT_LIST_LOAD
        passed = elapsed_ms <= threshold.value

        result = PerformanceResult(
            passed=passed,
            elapsed_ms=elapsed_ms,
            threshold_ms=threshold.value,
            threshold_type=threshold,
            message=f"Project list load: {elapsed_ms:.1f}ms (threshold: {threshold.value}ms)"
        )

        if passed:
            result.message += " - PASS"
        else:
            result.message += " - FAIL"

        self._measurements.append(result)
        return result

    def check_db_table_load(self, elapsed_ms: Optional[float] = None) -> PerformanceResult:
        """
        Check if database table loading time is within threshold.

        EVL-CASE-027: DB table load within 2 seconds
        """
        if elapsed_ms is None:
            elapsed_ms = self.stop_timer()

        threshold = PerformanceThreshold.DB_TABLE_LOAD
        passed = elapsed_ms <= threshold.value

        result = PerformanceResult(
            passed=passed,
            elapsed_ms=elapsed_ms,
            threshold_ms=threshold.value,
            threshold_type=threshold,
            message=f"DB table load: {elapsed_ms:.1f}ms (threshold: {threshold.value}ms)"
        )

        if passed:
            result.message += " - PASS"
        else:
            result.message += " - FAIL"

        self._measurements.append(result)
        return result

    def check_custom_threshold(
        self,
        threshold_ms: int,
        description: str,
        elapsed_ms: Optional[float] = None,
    ) -> PerformanceResult:
        """
        Check against a custom threshold.

        Args:
            threshold_ms: Custom threshold in milliseconds
            description: Description of the operation being timed
            elapsed_ms: Pre-measured elapsed time, or None to stop timer
        """
        if elapsed_ms is None:
            elapsed_ms = self.stop_timer()

        passed = elapsed_ms <= threshold_ms

        result = PerformanceResult(
            passed=passed,
            elapsed_ms=elapsed_ms,
            threshold_ms=threshold_ms,
            threshold_type=PerformanceThreshold.PROJECT_SWITCH,  # Placeholder
            message=f"{description}: {elapsed_ms:.1f}ms (threshold: {threshold_ms}ms)"
        )

        if passed:
            result.message += " - PASS"
        else:
            result.message += " - FAIL"

        self._measurements.append(result)
        return result

    def get_all_measurements(self) -> list:
        """Get all recorded measurements."""
        return self._measurements.copy()

    def clear_measurements(self) -> None:
        """Clear recorded measurements."""
        self._measurements.clear()

    def get_summary(self) -> dict:
        """Get summary of all measurements."""
        if not self._measurements:
            return {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "pass_rate": 0.0,
            }

        passed = sum(1 for m in self._measurements if m.passed)
        total = len(self._measurements)

        return {
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "pass_rate": (passed / total) * 100 if total > 0 else 0.0,
            "avg_elapsed_ms": sum(m.elapsed_ms for m in self._measurements) / total,
            "max_elapsed_ms": max(m.elapsed_ms for m in self._measurements),
            "min_elapsed_ms": min(m.elapsed_ms for m in self._measurements),
        }


# Convenience functions for standalone timing
def measure_time(operation: Callable[[], None]) -> float:
    """
    Measure the execution time of an operation.

    Args:
        operation: Callable to time

    Returns:
        Elapsed time in milliseconds
    """
    start = time.perf_counter()
    operation()
    return (time.perf_counter() - start) * 1000


@contextmanager
def timed_block() -> Generator[Callable[[], float], None, None]:
    """
    Context manager that provides a function to get elapsed time.

    Usage:
        with timed_block() as get_elapsed:
            # ... do work ...
            elapsed_ms = get_elapsed()
    """
    start = time.perf_counter()

    def get_elapsed() -> float:
        return (time.perf_counter() - start) * 1000

    yield get_elapsed
