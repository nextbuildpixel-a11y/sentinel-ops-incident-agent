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
    description="Automated root-cause analysis and remediation service for platform incidents",
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

SCENARIOS_DIR = Path(__file__).parent / "scenarios"

# In-memory system state tracking
system_state = {
    "status": "HEALTHY",
    "active_incidents": [],
    "remediated_incidents": [],
    "last_updated": datetime.now(timezone.utc).isoformat(),
}


class DiagnoseRequest(BaseModel):
    incident_id: str


class RemediateRequest(BaseModel):
    incident_id: str
    approved: bool


def load_all_scenarios() -> Dict[str, Dict[str, Any]]:
    """Loads all incident scenario files, indexed by incident_id."""
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
        except Exception:
            continue
    return scenarios


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
    """Diagnoses an incident given its ID."""
    scenarios = load_all_scenarios()
    incident_data = scenarios.get(payload.incident_id)

    if not incident_data:
        raise HTTPException(
            status_code=404,
            detail=f"Incident with ID '{payload.incident_id}' not found in scenarios."
        )

    diagnosis = diagnose_incident(incident_data)

    return {
        "status": "success",
        "incident_id": payload.incident_id,
        "diagnosis": diagnosis,
        "raw_telemetry": incident_data
    }


@app.post("/api/remediate")
def remediate_incident(payload: RemediateRequest) -> Dict[str, Any]:
    """Applies remediation when approved and sets system state to HEALTHY."""
    if not payload.approved:
        return {
            "status": "APPROVAL_REQUIRED",
            "incident_id": payload.incident_id,
            "approved": False,
            "message": "Remediation action was rejected or requires explicit approval."
        }

    # Update system state to HEALTHY
    timestamp = datetime.now(timezone.utc).isoformat()
    system_state["status"] = "HEALTHY"
    system_state["last_updated"] = timestamp
    system_state["remediated_incidents"].append({
        "incident_id": payload.incident_id,
        "timestamp": timestamp,
        "status": "HEALTHY"
    })

    return {
        "status": "HEALTHY",
        "incident_id": payload.incident_id,
        "approved": True,
        "message": f"Remediation action for {payload.incident_id} executed successfully. System state is HEALTHY.",
        "timestamp": timestamp
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
