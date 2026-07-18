from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "compute"


def test_rules_mode_is_not_authoritative() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/agent/rules-mode")

    assert response.status_code == 200
    assert response.json()["mode"] == "rules"
    assert response.json()["authoritative_calculation"] is False
