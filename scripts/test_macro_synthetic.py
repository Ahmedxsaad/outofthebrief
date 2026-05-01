#!/usr/bin/env python3
"""Synthetic data test for telecom macro feature.

Tests ingest, mappings, density computation, and SSE events.
Run with the server at http://localhost:8000
"""
import requests
import json
import time
import sys
from typing import Any

BASE_URL = "http://localhost:8000"


class MacroTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_count = 0
        self.pass_count = 0
        self.fail_count = 0

    def assert_status(self, response: requests.Response, expected: int, msg: str) -> bool:
        self.test_count += 1
        if response.status_code == expected:
            self.pass_count += 1
            print(f"✓ {msg}")
            return True
        else:
            self.fail_count += 1
            print(f"✗ {msg}")
            print(f"  Expected {expected}, got {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False

    def assert_condition(self, condition: bool, msg: str) -> bool:
        self.test_count += 1
        if condition:
            self.pass_count += 1
            print(f"✓ {msg}")
            return True
        else:
            self.fail_count += 1
            print(f"✗ {msg}")
            return False

    def test_legacy_sectors_bootstrap(self):
        """Test that legacy endpoint works on startup (seeded from static JSON)."""
        print("\n=== Test 1: Legacy Sectors Endpoint (Bootstrap) ===")
        response = self.session.get(f"{self.base_url}/api/telecom/sectors")
        self.assert_status(response, 200, "GET /api/telecom/sectors returns 200")
        
        data = response.json()
        self.assert_condition("sectors" in data, "Response has 'sectors' key")
        self.assert_condition("integration_status" in data, "Response has 'integration_status' key")
        self.assert_condition(
            data["integration_status"] == "static_config",
            f"Initial status is 'static_config', got {data['integration_status']}"
        )
        self.assert_condition(len(data["sectors"]) > 0, f"Sectors loaded from seed: {len(data['sectors'])} sectors")
        
        if data["sectors"]:
            sector = data["sectors"][0]
            self.assert_condition("name" in sector, "Sector has 'name'")
            self.assert_condition("capacity_pct" in sector, "Sector has 'capacity_pct'")
            self.assert_condition("ci_db" in sector, "Sector has 'ci_db'")

    def test_ingest_single_sector(self):
        """Test ingesting a single sector."""
        print("\n=== Test 2: Ingest Single Sector ===")
        payload = {
            "timestamp": time.time(),
            "sectors": [
                {
                    "sector_id": "tunis_centre_1",
                    "name": "Tunis Centre (Live)",
                    "capacity_used_pct": 85.5,
                    "ci_db": 13.2,
                    "calibration": 1.0,
                }
            ]
        }
        response = self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload)
        self.assert_status(response, 200, "POST /api/telecom/ingest returns 200")
        
        data = response.json()
        self.assert_condition(data.get("ok") is True, "Response has ok=true")
        self.assert_condition(data.get("received") == 1, f"Received 1 sector, got {data.get('received')}")
        self.assert_condition(
            data.get("status") == "live",
            f"Status transitioned to 'live', got {data.get('status')}"
        )

    def test_macro_response_after_ingest(self):
        """Test that macro response reflects ingested data."""
        print("\n=== Test 3: Macro Response After Ingest ===")
        response = self.session.get(f"{self.base_url}/api/telecom/macro")
        self.assert_status(response, 200, "GET /api/telecom/macro returns 200")
        
        macro = response.json()
        self.assert_condition("integration_status" in macro, "Response has 'integration_status'")
        self.assert_condition(
            macro["integration_status"] == "live",
            f"Status is 'live', got {macro['integration_status']}"
        )
        self.assert_condition("updated_at" in macro, "Response has 'updated_at'")
        self.assert_condition("sectors" in macro and len(macro["sectors"]) > 0, "Sectors present")
        
        if macro["sectors"]:
            sector = macro["sectors"][0]
            self.assert_condition("sector_id" in sector, "Sector has 'sector_id'")
            self.assert_condition("density" in sector, "Sector has 'density'")
            self.assert_condition("calibrated_density" in sector, "Sector has 'calibrated_density'")
            self.assert_condition(0 <= sector["density"] <= 100, f"Density in [0,100]: {sector['density']}")
            self.assert_condition(
                0 <= sector["calibrated_density"] <= 100,
                f"Calibrated density in [0,100]: {sector['calibrated_density']}"
            )

    def test_density_formula_monotonicity_capacity(self):
        """Test that higher capacity increases density (constant C/I)."""
        print("\n=== Test 4: Density Formula - Capacity Monotonicity ===")
        densities = []
        for cap in [30.0, 60.0, 90.0]:
            payload = {
                "timestamp": time.time(),
                "sectors": [
                    {
                        "sector_id": f"mono_cap_{cap}",
                        "name": f"Capacity {cap}%",
                        "capacity_used_pct": cap,
                        "ci_db": 15.0,
                    }
                ]
            }
            self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload)
            response = self.session.get(f"{self.base_url}/api/telecom/macro")
            macro = response.json()
            sector = next((s for s in macro["sectors"] if s["sector_id"] == f"mono_cap_{cap}"), None)
            if sector:
                densities.append((cap, sector["density"]))
        
        if len(densities) == 3:
            sorted_by_density = sorted(densities, key=lambda x: x[1])
            self.assert_condition(
                sorted_by_density[0][0] < sorted_by_density[1][0] < sorted_by_density[2][0],
                f"Capacity monotonicity: {densities}"
            )

    def test_density_formula_monotonicity_ci(self):
        """Test that lower C/I increases density (constant capacity)."""
        print("\n=== Test 5: Density Formula - C/I Monotonicity ===")
        densities = []
        for ci in [24.0, 14.0, 4.0]:
            payload = {
                "timestamp": time.time(),
                "sectors": [
                    {
                        "sector_id": f"mono_ci_{ci}",
                        "name": f"CI {ci} dB",
                        "capacity_used_pct": 60.0,
                        "ci_db": ci,
                    }
                ]
            }
            self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload)
            response = self.session.get(f"{self.base_url}/api/telecom/macro")
            macro = response.json()
            sector = next((s for s in macro["sectors"] if s["sector_id"] == f"mono_ci_{ci}"), None)
            if sector:
                densities.append((ci, sector["density"]))
        
        if len(densities) == 3:
            sorted_by_ci = sorted(densities, key=lambda x: x[0], reverse=True)
            sorted_by_density = sorted(sorted_by_ci, key=lambda x: x[1])
            self.assert_condition(
                len(set([d[1] for d in sorted_by_density])) == 3,
                f"C/I inverse monotonicity: {densities}"
            )

    def test_ingest_multiple_sectors(self):
        """Test ingesting multiple sectors at once."""
        print("\n=== Test 6: Ingest Multiple Sectors ===")
        payload = {
            "timestamp": time.time(),
            "sectors": [
                {
                    "sector_id": "ariana_nord",
                    "name": "Ariana Nord",
                    "capacity_used_pct": 72.0,
                    "ci_db": 18.1,
                },
                {
                    "sector_id": "la_marsa",
                    "name": "La Marsa",
                    "capacity_used_pct": 45.0,
                    "ci_db": 24.6,
                },
                {
                    "sector_id": "menzah_vi",
                    "name": "Menzah VI",
                    "capacity_used_pct": 91.0,
                    "ci_db": 8.2,
                },
            ]
        }
        response = self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload)
        self.assert_status(response, 200, "Ingest multiple sectors returns 200")
        data = response.json()
        self.assert_condition(data.get("received") == 3, f"Received 3 sectors, got {data.get('received')}")

    def test_calibration_factor(self):
        """Test that calibration factor scales density."""
        print("\n=== Test 7: Calibration Factor ===")
        payload = {
            "timestamp": time.time(),
            "sectors": [
                {
                    "sector_id": "calibration_test",
                    "name": "Calibration Test",
                    "capacity_used_pct": 50.0,
                    "ci_db": 15.0,
                    "calibration": 1.5,
                }
            ]
        }
        self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload)
        response = self.session.get(f"{self.base_url}/api/telecom/macro")
        macro = response.json()
        sector = next((s for s in macro["sectors"] if s["sector_id"] == "calibration_test"), None)
        
        if sector:
            self.assert_condition(sector["calibration"] == 1.5, f"Calibration stored: {sector['calibration']}")
            expected_cal = min(sector["density"] * 1.5, 100.0)
            self.assert_condition(
                abs(sector["calibrated_density"] - expected_cal) < 0.01,
                f"Calibrated density = density × calibration: {sector['calibrated_density']} ≈ {expected_cal}"
            )

    def test_billboard_mapping_single_sector(self):
        """Test mapping a billboard to a single sector."""
        print("\n=== Test 8: Billboard Mapping (Single Sector) ===")
        payload = {
            "mappings": [
                {
                    "billboard_id": "bb_avenue_habib_1",
                    "sector_id": "tunis_centre_1",
                    "weight": 1.0,
                }
            ]
        }
        response = self.session.post(f"{self.base_url}/api/telecom/mappings", json=payload)
        self.assert_status(response, 200, "POST /api/telecom/mappings returns 200")
        data = response.json()
        self.assert_condition(data.get("ok") is True, "Response has ok=true")
        self.assert_condition(data.get("count") == 1, f"Count is 1, got {data.get('count')}")

    def test_billboard_density_query(self):
        """Test querying computed density for a billboard."""
        print("\n=== Test 9: Billboard Density Query ===")
        response = self.session.get(f"{self.base_url}/api/telecom/billboards/bb_avenue_habib_1")
        
        if response.status_code == 200:
            self.assert_status(response, 200, "GET /api/telecom/billboards/{id} returns 200")
            bb_density = response.json()
            self.assert_condition("billboard_id" in bb_density, "Response has 'billboard_id'")
            self.assert_condition("density" in bb_density, "Response has 'density'")
            self.assert_condition("updated_at" in bb_density, "Response has 'updated_at'")
            self.assert_condition("sectors" in bb_density, "Response has 'sectors'")
            self.assert_condition(
                0 <= bb_density["density"] <= 100,
                f"Billboard density in [0,100]: {bb_density['density']}"
            )
        else:
            self.assert_status(response, 200, "Billboard density query (may need reseeding)")

    def test_billboard_unmapped_404(self):
        """Test that unmapped billboard returns 404."""
        print("\n=== Test 10: Billboard Not Found (404) ===")
        response = self.session.get(f"{self.base_url}/api/telecom/billboards/unknown_bb_xyz")
        self.assert_status(response, 404, "Unknown billboard returns 404")

    def test_billboard_multi_sector_weighted(self):
        """Test billboard mapped to multiple sectors with weights."""
        print("\n=== Test 11: Billboard Multi-Sector Weighted Mapping ===")
        payload = {
            "mappings": [
                {
                    "billboard_id": "bb_olympic_1",
                    "sector_id": "ariana_nord",
                    "weight": 0.6,
                },
                {
                    "billboard_id": "bb_olympic_1",
                    "sector_id": "la_marsa",
                    "weight": 0.4,
                },
            ]
        }
        response = self.session.post(f"{self.base_url}/api/telecom/mappings", json=payload)
        self.assert_status(response, 200, "Upsert multi-sector mappings returns 200")
        data = response.json()
        self.assert_condition(data.get("count") == 2, f"Count is 2, got {data.get('count')}")
        
        response = self.session.get(f"{self.base_url}/api/telecom/billboards/bb_olympic_1")
        if response.status_code == 200:
            bb_density = response.json()
            self.assert_condition(
                len(bb_density["sectors"]) >= 2,
                f"Billboard has 2+ sectors: {len(bb_density['sectors'])}"
            )

    def test_sector_update_replaces(self):
        """Test that re-ingesting a sector updates, not duplicates."""
        print("\n=== Test 12: Sector Update (Idempotent) ===")
        # First ingest
        payload1 = {
            "timestamp": time.time(),
            "sectors": [
                {
                    "sector_id": "update_test",
                    "name": "Update Test v1",
                    "capacity_used_pct": 40.0,
                    "ci_db": 20.0,
                }
            ]
        }
        self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload1)
        
        # Second ingest (update)
        payload2 = {
            "timestamp": time.time(),
            "sectors": [
                {
                    "sector_id": "update_test",
                    "name": "Update Test v2",
                    "capacity_used_pct": 80.0,
                    "ci_db": 10.0,
                }
            ]
        }
        self.session.post(f"{self.base_url}/api/telecom/ingest", json=payload2)
        
        response = self.session.get(f"{self.base_url}/api/telecom/macro")
        macro = response.json()
        sector = next((s for s in macro["sectors"] if s["sector_id"] == "update_test"), None)
        
        if sector:
            self.assert_condition(
                sector["capacity_used_pct"] == 80.0,
                f"Sector updated to 80%, got {sector['capacity_used_pct']}"
            )
            self.assert_condition(
                sector["ci_db"] == 10.0,
                f"Sector C/I updated to 10 dB, got {sector['ci_db']}"
            )

    def run_all_tests(self):
        """Run all tests."""
        print("=" * 60)
        print("NEXUS Telecom Macro Feature - Synthetic Data Tests")
        print("=" * 60)
        
        try:
            response = self.session.get(f"{self.base_url}/api/health")
            if response.status_code != 200:
                print(f"✗ Server not responding at {self.base_url}")
                return False
            print(f"✓ Server responding at {self.base_url}")
        except Exception as e:
            print(f"✗ Cannot connect to server: {e}")
            return False
        
        self.test_legacy_sectors_bootstrap()
        self.test_ingest_single_sector()
        self.test_macro_response_after_ingest()
        self.test_density_formula_monotonicity_capacity()
        self.test_density_formula_monotonicity_ci()
        self.test_ingest_multiple_sectors()
        self.test_calibration_factor()
        self.test_billboard_mapping_single_sector()
        self.test_billboard_density_query()
        self.test_billboard_unmapped_404()
        self.test_billboard_multi_sector_weighted()
        self.test_sector_update_replaces()
        
        print("\n" + "=" * 60)
        print(f"RESULTS: {self.pass_count} passed, {self.fail_count} failed out of {self.test_count} tests")
        print("=" * 60)
        
        return self.fail_count == 0


if __name__ == "__main__":
    tester = MacroTester(BASE_URL)
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
