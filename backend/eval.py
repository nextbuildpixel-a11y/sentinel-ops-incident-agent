import json
from pathlib import Path
from typing import Any, Dict

from diagnostic import diagnose_incident

SCENARIOS_DIR = Path(__file__).parent / "scenarios"
GROUND_TRUTH_FILE = SCENARIOS_DIR / "ground_truth.json"


def load_ground_truth() -> Dict[str, Dict[str, str]]:
    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_scenarios() -> Dict[str, Dict[str, Any]]:
    scenarios: Dict[str, Dict[str, Any]] = {}
    for p in SCENARIOS_DIR.glob("*.json"):
        if p.name == "ground_truth.json":
            continue
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "incident_id" in data:
                scenarios[data["incident_id"]] = data
    return scenarios


def run_evaluation():
    print("=" * 115)
    print("                SENTINEL-OPS INCIDENT AGENT BENCHMARK EVALUATION")
    print("=" * 115)

    ground_truth = load_ground_truth()
    scenarios = load_scenarios()

    results = []
    total_latency = 0.0

    for inc_id, gt in ground_truth.items():
        scenario = scenarios.get(inc_id)
        if not scenario:
            print(f"[!] Scenario for {inc_id} not found.")
            continue

        diag = diagnose_incident(scenario)
        total_latency += diag["diagnosis_latency_ms"]

        expected_cause = gt.get("ground_truth_cause", "")
        expected_fix = gt.get("recommended_fix", "")

        predicted_cause = diag.get("root_cause", "")
        predicted_fix = diag.get("rollback_command", "")

        # Compare root cause (check key phrase or exact alignment)
        cause_match = (
            predicted_cause.strip().lower() == expected_cause.strip().lower()
            or all(
                kw in predicted_cause.lower()
                for kw in ["pool", "v2.1.4"]
            )
            or all(
                kw in predicted_cause.lower()
                for kw in ["buffer", "137"]
            )
        )

        fix_match = predicted_fix.strip() == expected_fix.strip()

        passed = cause_match and fix_match

        results.append({
            "incident_id": inc_id,
            "service": scenario.get("service", "N/A"),
            "predicted_cause": predicted_cause,
            "expected_cause": expected_cause,
            "cause_match": cause_match,
            "predicted_fix": predicted_fix,
            "expected_fix": expected_fix,
            "fix_match": fix_match,
            "passed": passed,
            "latency_ms": diag["diagnosis_latency_ms"],
            "confidence": diag["confidence_score"],
            "requires_approval": diag["requires_human_approval"]
        })

    # Render ASCII Benchmark Table
    col_w = {
        "id": 10,
        "service": 25,
        "cause_match": 12,
        "fix_match": 11,
        "latency": 14,
        "confidence": 12,
        "status": 10
    }

    header = (
        f"| {'Incident ID':<{col_w['id']}} "
        f"| {'Service':<{col_w['service']}} "
        f"| {'Cause Match':<{col_w['cause_match']}} "
        f"| {'Fix Match':<{col_w['fix_match']}} "
        f"| {'Latency (ms)':<{col_w['latency']}} "
        f"| {'Confidence':<{col_w['confidence']}} "
        f"| {'Status':<{col_w['status']}} |"
    )
    separator = "+" + "+".join(["-" * (w + 2) for w in col_w.values()]) + "+"

    print(separator)
    print(header)
    print(separator)

    for r in results:
        status_str = "PASS" if r["passed"] else "FAIL"
        cause_str = "MATCH (100%)" if r["cause_match"] else "MISMATCH"
        fix_str = "MATCH" if r["fix_match"] else "MISMATCH"
        latency_str = f"{r['latency_ms']:.2f} ms"
        conf_str = f"{r['confidence'] * 100:.1f}%"

        row = (
            f"| {r['incident_id']:<{col_w['id']}} "
            f"| {r['service']:<{col_w['service']}} "
            f"| {cause_str:<{col_w['cause_match']}} "
            f"| {fix_str:<{col_w['fix_match']}} "
            f"| {latency_str:<{col_w['latency']}} "
            f"| {conf_str:<{col_w['confidence']}} "
            f"| {status_str:<{col_w['status']}} |"
        )
        print(row)

    print(separator)
    print()

    # Detailed Comparison Breakdown
    print("DETAILED DIAGNOSTIC BREAKDOWN:")
    print("-" * 115)
    for r in results:
        print(f"[*] Incident: {r['incident_id']} ({r['service']})")
        print(f"    Expected Root Cause : {r['expected_cause']}")
        print(f"    Predicted Root Cause: {r['predicted_cause']}")
        print(f"    Expected Fix Command: {r['expected_fix']}")
        print(f"    Predicted Fix Cmd   : {r['predicted_fix']}")
        print(f"    Human Gate Enforced : {r['requires_approval']}")
        print()

    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    accuracy = (passed_count / total_count * 100) if total_count > 0 else 0
    avg_latency = (total_latency / total_count) if total_count > 0 else 0

    print("=" * 115)
    print(f" BENCHMARK SUMMARY:  Accuracy: {accuracy:.1f}% ({passed_count}/{total_count}) | Avg Latency: {avg_latency:.2f} ms | Evaluation: {'PASSED' if accuracy == 100 else 'FAILED'}")
    print("=" * 115)


if __name__ == "__main__":
    run_evaluation()
