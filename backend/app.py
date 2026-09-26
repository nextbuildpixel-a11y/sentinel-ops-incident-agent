import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from diagnostic import diagnose_incident

app = FastAPI(
    title="SentinelOps Incident Agent API",
    description="Automated root-cause analysis, remediation, and audit trail service for platform incidents",
    version="1.0.0"
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
SCENARIOS_DIR = BASE_DIR / "scenarios"
AUDIT_LOG_FILE = BASE_DIR / "remediation_audit_trail.log"

# In-memory system state tracking
system_state = {
    "status": "HEALTHY",
    "active_incidents": [],
    "remediated_incidents": [],
    "last_updated": datetime.now(timezone.utc).isoformat(),
}


class DiagnoseRequest(BaseModel):
    incident_id: Optional[str] = None
    scenario: Optional[str] = None


class RemediateRequest(BaseModel):
    incident_id: Optional[str] = None
    scenario: Optional[str] = None
    approved: bool
    operator: Optional[str] = "sre-lead"


def load_all_scenarios() -> Dict[str, Dict[str, Any]]:
    """Loads all incident scenario files, indexed by incident_id and scenario stem."""
    scenarios: Dict[str, Dict[str, Any]] = {}
    if not SCENARIOS_DIR.exists():
        return scenarios

    for file_path in SCENARIOS_DIR.glob("*.json"):
        if file_path.name == "ground_truth.json":
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "incident_id" in data:
                    scenarios[data["incident_id"]] = data
                    scenarios[file_path.stem] = data
        except Exception:
            continue
    return scenarios


def log_remediation_audit(
    incident_id: str,
    operator: str,
    action: str,
    remediation_cmd: str,
    rollback_cmd: str,
    health_status: str
) -> Dict[str, Any]:
    """Appends an immutable JSON-line audit record to remediation_audit_trail.log."""
    timestamp = datetime.now(timezone.utc).isoformat()
    record = {
        "timestamp_utc": timestamp,
        "incident_id": incident_id,
        "operator": operator,
        "action": action,
        "remediation_command": remediation_cmd,
        "rollback_command": rollback_cmd,
        "health_status": health_status
    }
    with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return record


@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    """Returns current system health status."""
    return {
        "status": system_state["status"],
        "service": "sentinel-ops-incident-agent",
        "last_updated": system_state["last_updated"],
        "remediated_incidents": system_state["remediated_incidents"]
    }


@app.get("/api/incidents")
def list_incidents() -> List[Dict[str, Any]]:
    """Lists all available incident scenarios."""
    scenarios = load_all_scenarios()
    return list(scenarios.values())


@app.post("/api/diagnose")
def run_diagnosis(payload: DiagnoseRequest) -> Dict[str, Any]:
    """Diagnoses an incident given its ID or scenario name."""
    scenarios = load_all_scenarios()
    target_key = payload.incident_id or payload.scenario or "INC-8092"
    incident_data = scenarios.get(target_key)

    if not incident_data:
        raise HTTPException(
            status_code=404,
            detail=f"Incident or scenario '{target_key}' not found."
        )

    resolved_id = incident_data.get("incident_id", target_key)
    diagnosis = diagnose_incident(incident_data)

    return {
        "status": "success",
        "incident_id": resolved_id,
        "diagnosis": diagnosis,
        "raw_telemetry": incident_data
    }


@app.post("/api/remediate")
def remediate_incident(payload: RemediateRequest) -> Dict[str, Any]:
    """
    Applies remediation decision (approved or rejected), logs to audit trail,
    and updates system state.
    """
    scenarios = load_all_scenarios()
    target_key = payload.incident_id or payload.scenario or "INC-8092"
    incident_data = scenarios.get(target_key)
    resolved_id = incident_data.get("incident_id", target_key) if incident_data else target_key

    # Obtain recommended remediation details from diagnostic engine if available
    remediation_cmd = "N/A"
    rollback_cmd = "N/A"
    if incident_data:
        diag = diagnose_incident(incident_data)
        remediation_cmd = diag.get("remediation_action", "N/A")
        rollback_cmd = diag.get("rollback_command", "N/A")

    operator_name = payload.operator or "sre-lead"

    if not payload.approved:
        log_remediation_audit(
            incident_id=resolved_id,
            operator=operator_name,
            action="REJECTED",
            remediation_cmd=remediation_cmd,
            rollback_cmd=rollback_cmd,
            health_status="500 ERROR"
        )
        return {
            "status": "APPROVAL_REQUIRED",
            "incident_id": resolved_id,
            "approved": False,
            "health_status": "500 ERROR",
            "message": "Remediation action was rejected or denied by operator."
        }

    # Record approved execution
    timestamp = datetime.now(timezone.utc).isoformat()
    system_state["status"] = "HEALTHY"
    system_state["last_updated"] = timestamp
    system_state["remediated_incidents"].append({
        "incident_id": resolved_id,
        "timestamp": timestamp,
        "status": "HEALTHY",
        "rollback_command": rollback_cmd
    })

    audit_entry = log_remediation_audit(
        incident_id=resolved_id,
        operator=operator_name,
        action="APPROVED_EXECUTING",
        remediation_cmd=remediation_cmd,
        rollback_cmd=rollback_cmd,
        health_status="200 OK"
    )

    return {
        "status": "HEALTHY",
        "incident_id": resolved_id,
        "approved": True,
        "health_status": "200 OK",
        "audit_entry": audit_entry,
        "message": f"Remediation action for {resolved_id} executed successfully. System state is HEALTHY.",
        "timestamp": timestamp
    }


@app.get("/api/audit-trail")
def get_audit_trail() -> List[Dict[str, Any]]:
    """Returns the chronological list of historical audit trail records."""
    entries: List[Dict[str, Any]] = []
    if AUDIT_LOG_FILE.exists():
        with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped:
                    try:
                        entries.append(json.loads(stripped))
                    except Exception:
                        continue
    return entries


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
