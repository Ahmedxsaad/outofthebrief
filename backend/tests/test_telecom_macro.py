"""Tests for telecom macro feature.

Validates density formula, ingest/mapping endpoints, and status transitions.
"""
import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import TelecomSectorTelemetry, TelecomIngestRequest, BillboardSectorMapping, BillboardMappingUpsertRequest
from app.services.telecom_macro import TelecomMacroService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def macro_service():
    return TelecomMacroService()


class TestDensityFormula:
    """Validate macro density computation formula."""

    def test_zero_capacity_zero_ci_low_density(self, macro_service):
        """Low capacity and good C/I should produce low density."""
        macro_service.ingest(
            [TelecomSectorTelemetry(
                sector_id="test_a",
                name="Test Sector A",
                capacity_used_pct=10.0,
                ci_db=25.0,
            )],
            timestamp=time.time(),
        )
        macro = macro_service.get_macro_response()
        assert len(macro.sectors) == 1
        sector = macro.sectors[0]
        assert sector.density < 30, f"Expected density < 30 for low capacity, got {sector.density}"
        assert 0 <= sector.density <= 100

    def test_high_capacity_low_ci_high_density(self, macro_service):
        """High capacity and poor C/I should produce high density."""
        macro_service.ingest(
            [TelecomSectorTelemetry(
                sector_id="test_b",
                name="Test Sector B",
                capacity_used_pct=95.0,
                ci_db=5.0,
            )],
            timestamp=time.time(),
        )
        macro = macro_service.get_macro_response()
        sector = macro.sectors[0]
        assert sector.density > 70, f"Expected density > 70 for high capacity+poor C/I, got {sector.density}"

    def test_monotonicity_capacity(self, macro_service):
        """Higher capacity should produce higher density (C/I constant)."""
        densities = []
        for cap in [20.0, 50.0, 80.0]:
            svc = TelecomMacroService()
            svc.ingest(
                [TelecomSectorTelemetry(
                    sector_id=f"test_{cap}",
                    name=f"Test {cap}",
                    capacity_used_pct=cap,
                    ci_db=15.0,
                )],
                timestamp=time.time(),
            )
            densities.append(svc.get_macro_response().sectors[0].density)
        assert densities[0] < densities[1] < densities[2], \
            f"Densities should increase with capacity: {densities}"

    def test_monotonicity_ci(self, macro_service):
        """Lower C/I (worse) should produce higher density (capacity constant)."""
        densities = []
        for ci in [25.0, 15.0, 5.0]:
            svc = TelecomMacroService()
            svc.ingest(
                [TelecomSectorTelemetry(
                    sector_id=f"test_ci_{ci}",
                    name=f"Test CI {ci}",
                    capacity_used_pct=60.0,
                    ci_db=ci,
                )],
                timestamp=time.time(),
            )
            densities.append(svc.get_macro_response().sectors[0].density)
        assert densities[0] < densities[1] < densities[2], \
            f"Densities should increase as C/I decreases: {densities}"

    def test_calibration_factor(self, macro_service):
        """Calibration factor should scale density output."""
        macro_service.ingest(
            [TelecomSectorTelemetry(
                sector_id="test_cal",
                name="Test Cal",
                capacity_used_pct=50.0,
                ci_db=15.0,
                calibration=2.0,
            )],
            timestamp=time.time(),
        )
        sector = macro_service.get_macro_response().sectors[0]
        assert sector.calibration == 2.0
        assert sector.calibrated_density == min(sector.density * 2.0, 100.0), \
            "Calibrated density should be original * factor, clamped to 100"

    def test_density_clamping(self, macro_service):
        """Density output should be clamped to [0, 100]."""
        macro_service.ingest(
            [TelecomSectorTelemetry(
                sector_id="test_clamp",
                name="Test Clamp",
                capacity_used_pct=100.0,
                ci_db=0.0,
            )],
            timestamp=time.time(),
        )
        sector = macro_service.get_macro_response().sectors[0]
        assert 0 <= sector.density <= 100
        assert 0 <= sector.calibrated_density <= 100


class TestIngestEndpoint:
    """Test telecom data ingest endpoint."""

    def test_ingest_single_sector(self, client):
        """POST /api/telecom/ingest should accept and store sector telemetry."""
        payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="sector_1",
                    name="Sector 1",
                    capacity_used_pct=75.0,
                    ci_db=12.0,
                )
            ]
        )
        response = client.post("/api/telecom/ingest", json=payload.model_dump())
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["received"] == 1
        assert data["status"] in ["live", "static_config"]

    def test_ingest_multiple_sectors(self, client):
        """POST /api/telecom/ingest should handle multiple sectors."""
        payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id=f"sector_{i}",
                    name=f"Sector {i}",
                    capacity_used_pct=50.0 + i * 5,
                    ci_db=15.0 - i,
                )
                for i in range(1, 5)
            ]
        )
        response = client.post("/api/telecom/ingest", json=payload.model_dump())
        assert response.status_code == 200
        assert response.json()["received"] == 4

    def test_ingest_sets_live_status(self, client):
        """After ingest, integration_status should transition to 'live'."""
        payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="live_test",
                    name="Live Test",
                    capacity_used_pct=50.0,
                    ci_db=15.0,
                )
            ]
        )
        client.post("/api/telecom/ingest", json=payload.model_dump())
        response = client.get("/api/telecom/macro")
        assert response.status_code == 200
        macro = response.json()
        assert macro["integration_status"] == "live"

    def test_ingest_updates_existing_sector(self, client):
        """Ingesting the same sector_id twice should update, not duplicate."""
        payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="update_test",
                    name="Update Test",
                    capacity_used_pct=50.0,
                    ci_db=15.0,
                )
            ]
        )
        client.post("/api/telecom/ingest", json=payload.model_dump())
        payload2 = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="update_test",
                    name="Update Test v2",
                    capacity_used_pct=80.0,
                    ci_db=10.0,
                )
            ]
        )
        client.post("/api/telecom/ingest", json=payload2.model_dump())
        response = client.get("/api/telecom/macro")
        macro = response.json()
        sector = next((s for s in macro["sectors"] if s["sector_id"] == "update_test"), None)
        assert sector is not None
        assert sector["capacity_used_pct"] == 80.0


class TestMappingEndpoint:
    """Test billboard-to-sector mapping endpoint."""

    def test_upsert_mappings(self, client):
        """POST /api/telecom/mappings should store billboard-to-sector mappings."""
        payload = BillboardMappingUpsertRequest(
            mappings=[
                BillboardSectorMapping(
                    billboard_id="billboard_1",
                    sector_id="sector_1",
                    weight=1.0,
                )
            ]
        )
        response = client.post("/api/telecom/mappings", json=payload.model_dump())
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["count"] == 1

    def test_multiple_mappings_per_billboard(self, client):
        """A billboard can map to multiple sectors with weights."""
        payload = BillboardMappingUpsertRequest(
            mappings=[
                BillboardSectorMapping(billboard_id="bb_1", sector_id="sec_1", weight=0.6),
                BillboardSectorMapping(billboard_id="bb_1", sector_id="sec_2", weight=0.4),
            ]
        )
        response = client.post("/api/telecom/mappings", json=payload.model_dump())
        assert response.status_code == 200


class TestBillboardDensity:
    """Test billboard macro density computation."""

    def test_billboard_not_found(self, client):
        """GET /api/telecom/billboards/{id} should 404 if not mapped."""
        response = client.get("/api/telecom/billboards/unknown_billboard")
        assert response.status_code == 404

    def test_billboard_single_sector(self, client):
        """Billboard mapped to one sector should return that sector's density."""
        ingest_payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="bb_test_sec",
                    name="BB Test Sector",
                    capacity_used_pct=70.0,
                    ci_db=12.0,
                )
            ]
        )
        client.post("/api/telecom/ingest", json=ingest_payload.model_dump())

        mapping_payload = BillboardMappingUpsertRequest(
            mappings=[
                BillboardSectorMapping(
                    billboard_id="bb_test",
                    sector_id="bb_test_sec",
                    weight=1.0,
                )
            ]
        )
        client.post("/api/telecom/mappings", json=mapping_payload.model_dump())

        response = client.get("/api/telecom/billboards/bb_test")
        assert response.status_code == 200
        bb_density = response.json()
        assert bb_density["billboard_id"] == "bb_test"
        assert 0 <= bb_density["density"] <= 100

    def test_billboard_weighted_sectors(self, client):
        """Billboard with multiple weighted sectors should compute weighted average."""
        ingest_payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="sec_a",
                    name="Sector A",
                    capacity_used_pct=80.0,
                    ci_db=8.0,
                ),
                TelecomSectorTelemetry(
                    sector_id="sec_b",
                    name="Sector B",
                    capacity_used_pct=20.0,
                    ci_db=25.0,
                ),
            ]
        )
        client.post("/api/telecom/ingest", json=ingest_payload.model_dump())

        mapping_payload = BillboardMappingUpsertRequest(
            mappings=[
                BillboardSectorMapping(billboard_id="bb_multi", sector_id="sec_a", weight=0.7),
                BillboardSectorMapping(billboard_id="bb_multi", sector_id="sec_b", weight=0.3),
            ]
        )
        client.post("/api/telecom/mappings", json=mapping_payload.model_dump())

        response = client.get("/api/telecom/billboards/bb_multi")
        assert response.status_code == 200
        bb_density = response.json()
        assert bb_density["billboard_id"] == "bb_multi"
        assert len(bb_density["sectors"]) == 2


class TestLegacyCompat:
    """Test backward compatibility of legacy /api/telecom/sectors endpoint."""

    def test_legacy_sectors_endpoint_exists(self, client):
        """GET /api/telecom/sectors should still work (legacy contract)."""
        response = client.get("/api/telecom/sectors")
        assert response.status_code == 200
        data = response.json()
        assert "sectors" in data
        assert "integration_status" in data
        assert isinstance(data["sectors"], list)

    def test_legacy_sectors_have_required_fields(self, client):
        """Legacy response sectors must have name, capacity_pct, ci_db."""
        response = client.get("/api/telecom/sectors")
        data = response.json()
        if data["sectors"]:
            sector = data["sectors"][0]
            assert "name" in sector
            assert "capacity_pct" in sector
            assert "ci_db" in sector


class TestMacroResponse:
    """Test full macro response format."""

    def test_macro_response_structure(self, client):
        """GET /api/telecom/macro should return expected response schema."""
        ingest_payload = TelecomIngestRequest(
            sectors=[
                TelecomSectorTelemetry(
                    sector_id="struct_test",
                    name="Struct Test",
                    capacity_used_pct=50.0,
                    ci_db=15.0,
                )
            ]
        )
        client.post("/api/telecom/ingest", json=ingest_payload.model_dump())

        response = client.get("/api/telecom/macro")
        assert response.status_code == 200
        macro = response.json()
        assert "integration_status" in macro
        assert "updated_at" in macro
        assert "sectors" in macro
        assert isinstance(macro["sectors"], list)
        if macro["sectors"]:
            sector = macro["sectors"][0]
            assert "sector_id" in sector
            assert "density" in sector
            assert "calibrated_density" in sector
            assert "calibration" in sector
            assert "updated_at" in sector
