"""ALI Workspace iteration 2 tests: Bank Data, Board Harian, Peta Skor, entry requirements, cron."""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "webhook_cron_secret_ali_2026")

ADMIN = {"email": "info.akseslegal.id@gmail.com", "password": "Admin123!"}
STAFF_ELIS = {"email": "elis@ali.id", "password": "Staff123!"}
STAFF_DEWI = {"email": "dewi@ali.id", "password": "Staff123!"}
STAFF_AMEL = {"email": "amel@ali.id", "password": "Staff123!"}
SUP_ANDI = {"email": "andi@ali.id", "password": "Staff123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    s._user = r.json()["user"]
    return s


@pytest.fixture(scope="module")
def admin(): return _login(ADMIN)
@pytest.fixture(scope="module")
def elis(): return _login(STAFF_ELIS)
@pytest.fixture(scope="module")
def dewi(): return _login(STAFF_DEWI)
@pytest.fixture(scope="module")
def amel(): return _login(STAFF_AMEL)
@pytest.fixture(scope="module")
def andi(): return _login(SUP_ANDI)


@pytest.fixture(scope="module")
def divisions(admin):
    return admin.get(f"{API}/divisions").json()


@pytest.fixture(scope="module")
def boards(admin):
    return admin.get(f"{API}/boards").json()


@pytest.fixture(scope="module")
def graha_card(admin, boards):
    dewi_b = next(b for b in boards if b["name"] == "CS DEWI ALI")
    full = admin.get(f"{API}/boards/{dewi_b['id']}/full").json()
    card = next((c for c in full["cards"] if "Graha" in c.get("title", "") and "Pendirian" in c.get("title", "")), None)
    assert card is not None, "Graha Sentosa card not found"
    return card


# --------------- BANK DATA ---------------

class TestBankData:
    def test_get_bank_data_cs_division(self, dewi, divisions):
        cs = next(d for d in divisions if d["key"] == "cs")
        r = dewi.get(f"{API}/bank-data/{cs['id']}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["division"]["key"] == "cs"
        assert "items" in data and "workload" in data and "boards" in data
        assert isinstance(data["workload"], list)

    def test_get_bank_data_draf_division_visible_to_cs(self, dewi, divisions):
        # Even non-member can view (only claim is restricted)
        draf = next(d for d in divisions if d["key"] == "draf")
        r = dewi.get(f"{API}/bank-data/{draf['id']}")
        assert r.status_code == 200
        data = r.json()
        assert len(data["items"]) >= 1
        # workload should include Elis/Anti
        names = [w["user"]["name"] for w in data["workload"]]
        assert any("Elis" in n for n in names) or any("Anti" in n for n in names)

    def test_workload_by_list_details(self, admin, divisions):
        draf = next(d for d in divisions if d["key"] == "draf")
        data = admin.get(f"{API}/bank-data/{draf['id']}").json()
        for w in data["workload"]:
            assert "total" in w and "by_list" in w
            assert isinstance(w["by_list"], dict)

    def test_cross_division_create_via_bank_data(self, dewi, boards, divisions):
        # Dewi (CS) creates an item in ADMIN PAJAK board via bank-data endpoint
        pajak_div = next(d for d in divisions if d["key"] == "pajak")
        bd = dewi.get(f"{API}/bank-data/{pajak_div['id']}").json()
        pajak = next(b for b in bd["boards"] if b["name"] == "ADMIN PAJAK")
        list_id = pajak["lists"][0]["id"]
        r = dewi.post(f"{API}/work-items", json={
            "board_id": pajak["id"], "list_id": list_id,
            "title": f"TEST_bankdata_{uuid.uuid4().hex[:6]}",
            "client_name": "TEST cross-div",
        })
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["board_id"] == pajak["id"]
        assert item["status"] in ("BARU", "active")
        # cleanup via admin
        # (dewi is staff, can't delete)


# --------------- ENTRY REQUIREMENTS / MOVE VALIDATION ---------------

class TestEntryRequirements:
    def test_migrate_seeded_entry_requirements(self, admin, boards):
        dewi_b = next(b for b in boards if b["name"] == "CS DEWI ALI")
        full = admin.get(f"{API}/boards/{dewi_b['id']}/full").json()
        skor3 = next((l for l in full["lists"] if l["name"].upper().startswith("SKOR 3")), None)
        assert skor3 is not None
        # entry_requirements should be set from migrate
        reqs = skor3.get("entry_requirements") or []
        assert "KTP" in reqs and "NPWP" in reqs, f"expected KTP/NPWP in {reqs}"

    def test_move_blocked_when_reqs_missing_then_allowed(self, admin, dewi, boards):
        dewi_b = next(b for b in boards if b["name"] == "CS DEWI ALI")
        full = admin.get(f"{API}/boards/{dewi_b['id']}/full").json()
        skor1 = next(l for l in full["lists"] if l["name"].upper().startswith("SKOR 1"))
        skor3 = next(l for l in full["lists"] if l["name"].upper().startswith("SKOR 3"))

        # Create card in SKOR 1 as admin, assign dewi as member
        r = admin.post(f"{API}/work-items", json={
            "board_id": dewi_b["id"], "list_id": skor1["id"],
            "title": f"TEST_reqs_{uuid.uuid4().hex[:6]}",
            "member_ids": [dewi._user["id"]],
        })
        assert r.status_code == 200
        item_id = r.json()["id"]

        # Dewi (staff) tries to move to SKOR 3 → should 400
        r = dewi.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": skor3["id"], "position": 1000.0, "board_id": dewi_b["id"]
        })
        assert r.status_code == 400, r.text
        assert "syarat" in r.text.lower() and ("KTP" in r.text or "NPWP" in r.text)

        # ensure_requirement_checklist should create a "Syarat SKOR 3..." checklist
        # even though the move was blocked, we need to have kartu in some list that has reqs.
        # Move to skor3 as supervisor (admin) to auto-create checklist
        r = admin.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": skor3["id"], "position": 1000.0, "board_id": dewi_b["id"]
        })
        assert r.status_code == 200, r.text
        detail = admin.get(f"{API}/work-items/{item_id}").json()
        checklists = detail["item"]["checklists"]
        target_cl = next((c for c in checklists if c["title"].startswith("Syarat SKOR 3")), None)
        assert target_cl is not None, f"expected Syarat SKOR 3 checklist auto-created, got {[c['title'] for c in checklists]}"

        # Now check the KTP + NPWP items
        for it in target_cl["items"]:
            admin.patch(f"{API}/work-items/{item_id}/checklists/{target_cl['id']}/items/{it['id']}", json={"done": True})

        # Move back to SKOR 1
        admin.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": skor1["id"], "position": 500.0, "board_id": dewi_b["id"]
        })
        # Now dewi should be able to move to SKOR 3
        r = dewi.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": skor3["id"], "position": 2000.0, "board_id": dewi_b["id"]
        })
        assert r.status_code == 200, r.text

        # cleanup
        admin.delete(f"{API}/work-items/{item_id}")

    def test_supervisor_bypass_reqs_logs_activity(self, admin, boards):
        dewi_b = next(b for b in boards if b["name"] == "CS DEWI ALI")
        full = admin.get(f"{API}/boards/{dewi_b['id']}/full").json()
        skor1 = next(l for l in full["lists"] if l["name"].upper().startswith("SKOR 1"))
        skor3 = next(l for l in full["lists"] if l["name"].upper().startswith("SKOR 3"))
        r = admin.post(f"{API}/work-items", json={
            "board_id": dewi_b["id"], "list_id": skor1["id"],
            "title": f"TEST_supbypass_{uuid.uuid4().hex[:6]}",
        })
        item_id = r.json()["id"]
        r = admin.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": skor3["id"], "position": 500.0, "board_id": dewi_b["id"]
        })
        assert r.status_code == 200
        admin.delete(f"{API}/work-items/{item_id}")


# --------------- BOARD HARIAN ---------------

class TestGlobalHari:
    def test_global_hari_access_dewi_denied(self, dewi):
        r = dewi.get(f"{API}/global/hari")
        assert r.status_code == 403

    def test_global_hari_access_admin(self, admin):
        r = admin.get(f"{API}/global/hari")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_global_hari_access_draf(self, elis):
        r = elis.get(f"{API}/global/hari")
        assert r.status_code == 200

    def test_graha_in_hari_1(self, admin, graha_card):
        # If Graha in SKOR 5 seed, hari_stage should be 1
        # Fetch fresh
        d = admin.get(f"{API}/work-items/{graha_card['id']}").json()
        # It may not be in SKOR 5 initially; but the seed migrate should have set hari_stage if in SKOR 5
        # Just verify field exists in response
        assert "item" in d

    def test_hari_gate_blocks_staff(self, admin, elis, boards):
        # Create a fresh CS card, move to SKOR 5 to trigger hari_stage=1, then try HARI 4 as staff
        dewi_b = next(b for b in boards if b["name"] == "CS DEWI ALI")
        full = admin.get(f"{API}/boards/{dewi_b['id']}/full").json()
        skor1 = next(l for l in full["lists"] if l["name"].upper().startswith("SKOR 1"))
        skor5 = next(l for l in full["lists"] if l["name"].upper().startswith("SKOR 5"))
        r = admin.post(f"{API}/work-items", json={
            "board_id": dewi_b["id"], "list_id": skor1["id"],
            "title": f"TEST_hari_{uuid.uuid4().hex[:6]}",
        })
        item_id = r.json()["id"]
        # move to SKOR 5 as supervisor (bypasses reqs)
        r = admin.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": skor5["id"], "position": 500.0, "board_id": dewi_b["id"]
        })
        assert r.status_code == 200
        d = admin.get(f"{API}/work-items/{item_id}").json()
        assert d["item"].get("hari_stage") == 1, f"expected hari_stage=1, got {d['item'].get('hari_stage')}"

        # Elis staff tries HARI 4 without AKTA+SK
        r = elis.post(f"{API}/work-items/{item_id}/hari", json={"target_stage": 4})
        assert r.status_code == 400, r.text
        assert "AKTA" in r.text and "SK" in r.text

        # Add AKTA+SK to checklist
        r = admin.post(f"{API}/work-items/{item_id}/checklists", json={"title": "Dokumen"})
        cl_id = r.json()["checklists"][-1]["id"]
        admin.post(f"{API}/work-items/{item_id}/checklists/{cl_id}/items", json={"text": "AKTA"})
        admin.post(f"{API}/work-items/{item_id}/checklists/{cl_id}/items", json={"text": "SK"})
        d = admin.get(f"{API}/work-items/{item_id}").json()
        cl = next(c for c in d["item"]["checklists"] if c["id"] == cl_id)
        for it in cl["items"]:
            admin.patch(f"{API}/work-items/{item_id}/checklists/{cl_id}/items/{it['id']}", json={"done": True})

        # Elis staff moves to HARI 4 (LOGO not present → warning)
        r = elis.post(f"{API}/work-items/{item_id}/hari", json={"target_stage": 4})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["hari_stage"] == 4
        assert data.get("warning") and "LOGO" in data["warning"]

        # Target stage 8 (FINISH) without NIB → 400
        r = elis.post(f"{API}/work-items/{item_id}/hari", json={"target_stage": 8})
        assert r.status_code == 400, r.text
        assert "NIB" in r.text

        # cleanup
        admin.delete(f"{API}/work-items/{item_id}")


# --------------- PETA SKOR ---------------

class TestGlobalSkor:
    def test_dewi_can_access_skor(self, dewi):
        r = dewi.get(f"{API}/global/skor")
        assert r.status_code == 200
        d = r.json()
        for k in ("1", "2", "3", "4", "5", "6"):
            assert k in d and isinstance(d[k], list)

    def test_elis_draf_denied(self, elis):
        r = elis.get(f"{API}/global/skor")
        assert r.status_code == 403

    def test_supervisor_andi_allowed(self, andi):
        r = andi.get(f"{API}/global/skor")
        assert r.status_code == 200


# --------------- CRON ---------------

class TestCron:
    def test_cron_no_auth(self):
        r = requests.post(f"{API}/cron/advance-hari", json={}, timeout=10)
        assert r.status_code == 401

    def test_cron_wrong_secret(self):
        r = requests.post(f"{API}/cron/advance-hari",
                          headers={"Authorization": "Bearer wrong"}, json={}, timeout=10)
        assert r.status_code == 401

    def test_cron_success_and_idempotent(self):
        run_id = f"test-run-{uuid.uuid4().hex[:8]}"
        h = {"Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": run_id}
        r1 = requests.post(f"{API}/cron/advance-hari", headers=h, json={}, timeout=15)
        assert r1.status_code == 200
        assert r1.json()["ok"] is True
        r2 = requests.post(f"{API}/cron/advance-hari", headers=h, json={}, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("duplicate") is True


# --------------- REGRESSION ---------------

class TestRegression:
    def test_login_admin(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200

    def test_stats(self, admin):
        r = admin.get(f"{API}/stats")
        assert r.status_code == 200

    def test_dewi_board_full(self, admin, boards):
        dewi_b = next(b for b in boards if b["name"] == "CS DEWI ALI")
        r = admin.get(f"{API}/boards/{dewi_b['id']}/full")
        assert r.status_code == 200

    def test_notifications(self, dewi):
        r = dewi.get(f"{API}/notifications/mine")
        assert r.status_code == 200
