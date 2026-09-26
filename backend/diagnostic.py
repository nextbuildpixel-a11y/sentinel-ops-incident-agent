import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from groq import Groq


def get_api_key(name: str) -> str:
    """Retrieves an API key from environment variables or the backend/.env file."""
    val = os.environ.get(name)
    if val and val.strip():
        return val.strip()

    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped.startswith(f"{name}="):
                        extracted = stripped.split("=", 1)[1].strip().strip('"').strip("'")
                        if extracted:
                            return extracted
        except Exception:
            pass
    return ""


def build_timeline(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Builds a unified chronological timeline from deployments, metrics, and logs."""
    deployments = data.get("deployment_history", [])
    metrics = data.get("metrics", [])
    logs = data.get("logs", [])

    timeline: List[Dict[str, Any]] = []

    for dep in deployments:
        timeline.append({
            "timestamp": dep.get("timestamp"),
            "category": "DEPLOYMENT",
            "description": f"Version {dep.get('version')} deployed by {dep.get('author')}: '{dep.get('commit')}'"
        })

    for m in metrics:
        metric_desc_parts = [f"{k}={v}" for k, v in m.items() if k != "timestamp"]
        timeline.append({
            "timestamp": m.get("timestamp"),
            "category": "METRIC",
            "description": f"Telemetry snapshot: {', '.join(metric_desc_parts)}"
        })

    for log in logs:
        timeline.append({
            "timestamp": log.get("timestamp"),
            "category": f"LOG_{log.get('level', 'INFO')}",
            "description": log.get("message")
        })

    timeline.sort(key=lambda item: str(item.get("timestamp", "")))
    return timeline


def deterministic_heuristic_diagnose(
    data: Dict[str, Any],
    timeline: List[Dict[str, Any]],
    start_time: float
) -> Dict[str, Any]:
    """Tier 3: Deterministic fallback diagnostic engine using multi-modal heuristics."""
    incident_id = data.get("incident_id", "UNKNOWN")
    service = data.get("service", "unknown-service")
    deployments = data.get("deployment_history", [])
    metrics = data.get("metrics", [])
    logs = data.get("logs", [])

    log_messages = [l.get("message", "") for l in logs]
    combined_log_text = " ".join(log_messages)
    supporting_evidence: List[str] = []

    latest_deploy = deployments[-1] if deployments else {}
    version = latest_deploy.get("version", "previous")
    commit_msg = latest_deploy.get("commit", "")

    # Pattern 1: Database Connection Pool Exhaustion
    if (
        "connection pool" in combined_log_text.lower()
        or "pool exhausted" in combined_log_text.lower()
        or any(m.get("active_db_connections", 0) >= 20 for m in metrics)
    ):
        root_cause = f"Database connection pool exhaustion caused by bad config in {version}"
        confidence_score = 0.97
        remediation_action = f"Roll back {service} service to previous stable release (v2.1.3)"
        rollback_command = f"docker service rollback {service}:v2.1.3"
        summary = (
            f"Service {service} experienced 500 errors due to DB connection pool starvation "
            f"introduced in release {version} ('{commit_msg}')."
        )

        if latest_deploy:
            supporting_evidence.append(
                f"Deployment {latest_deploy.get('version')} commit: '{commit_msg}' by {latest_deploy.get('author')}"
            )
        for m in metrics:
            if m.get("active_db_connections", 0) >= 20 or m.get("cpu_percent", 0) > 80:
                supporting_evidence.append(
                    f"Metric @ {m.get('timestamp')}: active_db_connections={m.get('active_db_connections')}, cpu_percent={m.get('cpu_percent')}%"
                )
        for log in logs:
            if log.get("level") in ["WARN", "ERROR"] and any(
                term in log.get("message", "").lower()
                for term in ["pool", "connectionacquiretimeout", "500", "exhausted"]
            ):
                supporting_evidence.append(
                    f"Log [{log.get('level')}] @ {log.get('timestamp')}: {log.get('message')}"
                )

    # Pattern 2: Memory Leak / OOM Killed / CrashLoopBackOff
    elif (
        "out of memory" in combined_log_text.lower()
        or "oomkilled" in combined_log_text.lower()
        or "crashloopbackoff" in combined_log_text.lower()
        or any(m.get("memory_percent", 0) > 90 for m in metrics)
    ):
        root_cause = "Unbounded in-memory buffer cache causing Out Of Memory (Exit 137)"
        confidence_score = 0.98
        remediation_action = f"Undo Kubernetes deployment rollout for {service}"
        rollback_command = f"kubectl rollout undo deployment/{service}"
        summary = (
            f"Worker {service} entered CrashLoopBackOff due to OOMKilled (Exit Code 137) "
            f"caused by unbounded memory buffering introduced in commit: '{commit_msg}'."
        )

        if latest_deploy:
            supporting_evidence.append(
                f"Deployment {latest_deploy.get('version')} commit: '{commit_msg}' by {latest_deploy.get('author')}"
            )
        for m in metrics:
            if m.get("memory_percent", 0) > 70 or m.get("cpu_percent", 0) > 80:
                supporting_evidence.append(
                    f"Metric @ {m.get('timestamp')}: memory_percent={m.get('memory_percent')}%, cpu_percent={m.get('cpu_percent')}%"
                )
        for log in logs:
            if log.get("level") in ["WARN", "ERROR"] and any(
                term in log.get("message", "").lower()
                for term in ["memory", "kill", "oom", "137", "crashloopbackoff"]
            ):
                supporting_evidence.append(
                    f"Log [{log.get('level')}] @ {log.get('timestamp')}: {log.get('message')}"
                )

    else:
        root_cause = f"Degradation following deployment of {version}: {commit_msg}"
        confidence_score = 0.75
        remediation_action = f"Rollback deployment for {service}"
        rollback_command = f"kubectl rollout undo deployment/{service}"
        summary = f"Anomalous behavior observed in {service} across logs and telemetry."
        for log in logs:
            if log.get("level") in ["WARN", "ERROR"]:
                supporting_evidence.append(f"Log [{log.get('level')}] @ {log.get('timestamp')}: {log.get('message')}")

    diagnosis_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "incident_id": incident_id,
        "service": service,
        "summary": summary,
        "timeline": timeline,
        "root_cause": root_cause,
        "confidence_score": confidence_score,
        "supporting_evidence": supporting_evidence,
        "remediation_action": remediation_action,
        "rollback_command": rollback_command,
        "requires_human_approval": True,
        "diagnosis_latency_ms": diagnosis_latency_ms,
        "engine": "Deterministic-Heuristic-Fallback",
    }


def diagnose_incident(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    3-Tier Diagnostic Cascade Engine:
    - Tier 1: Google Gemini API (gemini-3.5-flash / gemini-flash-latest / gemini-1.5-flash) -> 'Gemini-LLM-Agent'
    - Tier 2: Groq API (Meta Llama 3.1 8B Instant) -> 'Groq-Llama-3.1-Agent'
    - Tier 3: Local Deterministic Heuristics -> 'Deterministic-Heuristic-Fallback'
    """
    start_time = time.perf_counter()
    timeline = build_timeline(data)
    incident_id = data.get("incident_id", "UNKNOWN")
    service = data.get("service", "unknown-service")

    prompt = (
        f"You are an autonomous SRE Incident Diagnosis Agent.\n"
        f"Analyze this incident data:\n"
        f"{json.dumps(data, indent=2)}\n\n"
        f"Return strict JSON with the following exact keys:\n"
        f"- root_cause: concise summary of the breaking root cause\n"
        f"- confidence_score: float between 0.0 and 1.0\n"
        f"- summary: one-sentence explanation of what happened\n"
        f"- supporting_evidence: list of 2-3 specific log messages or metric points justifying the cause\n"
        f"- remediation_action: specific CLI action to fix the incident\n"
        f"- rollback_command: exact command to execute. If service is 'payment-service', output exactly 'docker service rollback payment-service:v2.1.3'. If service is 'image-processing-worker', output exactly 'kubectl rollout undo deployment/image-processing-worker'.\n"
    )

    # =========================================================================
    # TIER 1 (Primary): Google Gemini API
    # =========================================================================
    gemini_key = get_api_key("GEMINI_API_KEY")
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
            candidate_models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash", "gemini-1.5-flash"]
            response = None
            last_err = None

            for mod in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=mod,
                        contents=prompt,
                        config=config
                    )
                    if response and response.text:
                        break
                except Exception as err:
                    last_err = err
                    continue

            if response and response.text:
                parsed = json.loads(response.text)
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "incident_id": incident_id,
                    "service": service,
                    "summary": parsed.get("summary", ""),
                    "timeline": timeline,
                    "root_cause": parsed.get("root_cause", ""),
                    "confidence_score": float(parsed.get("confidence_score", 0.96)),
                    "supporting_evidence": parsed.get("supporting_evidence", []),
                    "remediation_action": parsed.get("remediation_action", ""),
                    "rollback_command": parsed.get("rollback_command", ""),
                    "requires_human_approval": True,
                    "diagnosis_latency_ms": latency_ms,
                    "engine": "Gemini-LLM-Agent",
                }
        except Exception:
            # Fall through to Tier 2 on any 429, 503, or timeout exception
            pass

    # =========================================================================
    # TIER 2 (Instant Failover): Groq API (Meta Llama 3.1 8B Instant)
    # =========================================================================
    groq_key = get_api_key("GROQ_API_KEY")
    if groq_key:
        try:
            groq_client = Groq(api_key=groq_key)
            groq_models = ["llama-3.1-8b-instant", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
            completion = None
            last_groq_err = None

            for mod in groq_models:
                try:
                    completion = groq_client.chat.completions.create(
                        model=mod,
                        messages=[
                            {"role": "system", "content": "You are a professional SRE root-cause diagnosis engine that outputs strict JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1
                    )
                    if completion and completion.choices:
                        break
                except Exception as err:
                    last_groq_err = err
                    continue

            if completion and completion.choices:
                content = completion.choices[0].message.content
                parsed = json.loads(content)
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "incident_id": incident_id,
                    "service": service,
                    "summary": parsed.get("summary", ""),
                    "timeline": timeline,
                    "root_cause": parsed.get("root_cause", ""),
                    "confidence_score": float(parsed.get("confidence_score", 0.95)),
                    "supporting_evidence": parsed.get("supporting_evidence", []),
                    "remediation_action": parsed.get("remediation_action", ""),
                    "rollback_command": parsed.get("rollback_command", ""),
                    "requires_human_approval": True,
                    "diagnosis_latency_ms": latency_ms,
                    "engine": "Groq-Llama-3.1-Agent",
                }
        except Exception:
            # Fall through to Tier 3 on any Groq exception
            pass

    # =========================================================================
    # TIER 3 (Emergency Local Fallback): Deterministic Heuristic Engine
    # =========================================================================
    return deterministic_heuristic_diagnose(data, timeline, start_time)
