# SentinelOps Incident Agent

An automated root-cause analysis (RCA) and remediation intelligence engine designed for modern cloud-native systems. SentinelOps continuously correlates multi-modal telemetry—deployment history, git commit metadata, resource utilization curves, and application logs—to isolate production regressions in sub-milliseconds and issue verified infrastructure remediation with human-in-the-loop governance.

---

## 🏗 System Architecture

```text
+------------------------------------------------------------------------------------+
|                         SENTINEL-OPS INCIDENT PLATFORM                             |
+------------------------------------------------------------------------------------+
         |                                 |                                 |
         v                                 v                                 v
  +--------------+                 +---------------+                 +---------------+
  | Git Commits  |                 | Metrics Curve |                 | Container Logs|
  | & Deployments|                 | (CPU/Mem/DB)  |                 | (Errors/OOM)  |
  +--------------+                 +---------------+                 +---------------+
         \                                 |                                 /
          \                                v                                /
           +---------------------> [ Telemetry Ingestion ] <---------------+
                                           |
                                           v
                        +------------------------------------+
                        | Multi-Modal Causal Reasoner        |
                        |  - Temporal Timeline Assembler     |
                        |  - Saturation Curve Correlation    |
                        |  - Causal Attribution Classifier   |
                        |  - Confidence Calibration Engine   |
                        +------------------------------------+
                                           |
                                           v
                         +-----------------------------------+
                         | Remediation Formulator            |
                         |  - Actionable Rollback Command    |
                         |  - Human Approval Gate (Mandatory)|
                         +-----------------------------------+
                                           |
                      +--------------------+--------------------+
                      |                                         |
                      v                                         v
         [ Human-in-the-Loop Gate ]                 [ Immutable Audit Trail ]
              (SRE Approval)                      remediation_audit_trail.log
            /                \
           /                  \
   [ Approved ]           [ Rejected ]
         |                      |
         v                      v
[ Execute Rollback ]    [ Incident Escalation ]
(docker/kubectl undo)   (Audit Status: 500 ERROR)
```

---

## 🚀 Key Features

- **Multi-Modal Telemetry Correlation**: Ingests deployment history, author commit messages, time-series metrics (CPU, Memory, DB connections), and log lines simultaneously.
- **Accurate Causal Isolation**: Distinguishes superficial symptoms (HTTP 500 error spikes, high CPU) from actual root causes (e.g., config changes in `v2.1.4` lowering DB pool limits, uncompressed buffer caching causing OOMKilled 137).
- **Human-in-the-Loop Gating**: Every diagnostic output enforces `requires_human_approval: True`, preventing unsafe autonomous destructive actions.
- **Structured Audit Logging**: Immutably records every operator decision (approval or rejection) with timestamps, operator ID, commands, and health statuses to `backend/remediation_audit_trail.log`.
- **Sub-Millisecond Inference**: Fast, zero-overhead diagnostic evaluation in ~0.03 ms.
- **Production-Ready REST API**: FastAPI backend providing scenario discovery, diagnosis, remediation gating, health probes, and audit trail retrieval.

---

## 📊 Benchmark Evaluation: Agentic vs. Static Rules Baseline

The benchmark runner (`eval.py`) validates diagnostic accuracy, rollback command correctness, latency, and safety gating against verified ground truth scenarios (`scenarios/ground_truth.json`).

```text
+-----------+------------------------+---------------+-------------+--------------+---------------+--------------+----------+
| Incident  | Engine                 | Cause Match   | Fix Match   | Confidence   | Latency       | Human Gate   | Status   |
+-----------+------------------------+---------------+-------------+--------------+---------------+--------------+----------+
| INC-8092  | Agentic (Multi-Modal)  | MATCH (100%)  | MATCH       |        97.0% |       0.03 ms | True         | PASS     |
|           | Static Rules Baseline  | MISMATCH (0%) | MISMATCH    |        55.0% |       0.06 ms | False        | FAIL     |
+-----------+------------------------+---------------+-------------+--------------+---------------+--------------+----------+
| INC-8093  | Agentic (Multi-Modal)  | MATCH (100%)  | MATCH       |        98.0% |       0.02 ms | True         | PASS     |
|           | Static Rules Baseline  | MISMATCH (0%) | MISMATCH    |        60.0% |       0.05 ms | False        | FAIL     |
+-----------+------------------------+---------------+-------------+--------------+---------------+--------------+----------+
```

### Why Agentic Correlation Outperforms Static Rules
1. **Multi-Modal Causal Attribution**:
   - Static regex engines observe superficial symptoms (e.g. `HTTP 500 InternalServerError`) and trigger naive restarts (`systemctl restart payment-service`).
   - SentinelOps correlates the recent git commit (`alex.dev: lower connection pool keepalive and max limit to 20`) with connection saturation curves (`20/20 active connections`), identifying the exact regression version (`v2.1.4`) and targeting the rollback target (`v2.1.3`).
2. **Actionable Remediation**:
   - Static rules issue temporary pod/service restarts that fail immediately when the crash loop recurs.
   - SentinelOps issues production-grade rollback instructions (`docker service rollback`, `kubectl rollout undo`).
3. **Safety Governance**:
   - SentinelOps enforces mandatory SRE approval (`requires_human_approval: True`) and logs decisions to an audit trail.

---

## ⚡ Quickstart

### 1. Setup Environment
```bash
cd sentinel-ops-incident-agent/backend
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Run the Benchmark Evaluation
```bash
python eval.py
```

### 3. Start the FastAPI Service
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
API Documentation will be available at: `http://localhost:8000/docs`.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status, uptime, and remediated incident count |
| `GET` | `/api/incidents` | Lists all active incident scenarios from `scenarios/` |
| `POST` | `/api/diagnose` | Accepts `{"incident_id": "INC-8092"}` and returns RCA diagnosis + telemetry |
| `POST` | `/api/remediate` | Accepts `{"incident_id": "INC-8092", "approved": true, "operator": "alex.sre"}` and updates state |
| `GET` | `/api/audit-trail` | Returns chronological audit log of all approval and rejection actions |

### Sample Audit Trail Record (`remediation_audit_trail.log`)
```json
{
  "timestamp_utc": "2026-09-26T12:03:17.325946+00:00",
  "incident_id": "INC-8092",
  "operator": "alice.sre",
  "action": "APPROVED_EXECUTING",
  "remediation_command": "Roll back payment-service service to previous stable release (v2.1.3)",
  "rollback_command": "docker service rollback payment-service:v2.1.3",
  "health_status": "200 OK"
}
```

---

## 📁 Repository Structure

```text
sentinel-ops-incident-agent/
├── .gitignore                          # Excludes venv, pycache, and logs
├── README.md                           # System documentation and architecture
└── backend/
    ├── app.py                          # FastAPI application & REST endpoints
    ├── diagnostic.py                   # Multi-modal causal diagnostic engine
    ├── eval.py                         # Evaluation runner & baseline comparator
    ├── requirements.txt                # Production dependencies
    ├── remediation_audit_trail.log     # Immutable remediation audit trail
    ├── scenarios/
    │   ├── db_pool_exhausted.json      # Incident INC-8092
    │   ├── memory_leak_oom.json        # Incident INC-8093
    │   └── ground_truth.json           # Ground truth root causes & fixes
    └── venv/                           # Python virtual environment (ignored)
```
