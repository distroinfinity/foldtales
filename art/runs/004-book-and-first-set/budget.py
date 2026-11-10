"""Keeps run 004 inside its cap on a shared account. The tool only knows the balance, so this works from list prices."""
import re
from pathlib import Path

ONE_K = {"1024:1024", "1184:896", "896:1184", "1376:768", "768:1376", "1296:864", "864:1296"}
TWO_K = {"2048:2048", "2304:1728", "1728:2304", "2720:1530", "1530:2720", "2496:1664", "1664:2496"}


def price(ratio):
    if ratio in ONE_K:
        return 5
    if ratio in TWO_K:
        return 9
    raise ValueError(f"no list price for ratio {ratio}")


def pending_jobs(plan, run_dir):
    """Every job the tool would run: anything without an output file."""
    return [job for job in plan["jobs"] if not Path(run_dir, f"{job['id']}.png").exists()]


def queue_cost(jobs):
    return sum(price(job["ratio"]) for job in jobs)


def safe_cap(spent, total=120, largest=9):
    """The value for capCredits, since the tool can start one more job at the limit."""
    return total - spent - largest


def assert_queue_fits(jobs, spent, total=120):
    cost = queue_cost(jobs)
    if cost > total - spent:
        raise ValueError(f"queue costs {cost} but only {total - spent} of {total} remains")


def attempted_cost(log_text, plan):
    """List price of every job a log shows as attempted, charged or not."""
    prices = {job["id"]: price(job["ratio"]) for job in plan["jobs"]}
    return sum(prices[m.group(2)] for m in re.finditer(r"^(done|FAILED) ([^:\s]+):", log_text, re.M))


def reconcile(listed, observed_delta):
    return {"listed": listed, "observed": observed_delta, "unexplained": observed_delta - listed}
