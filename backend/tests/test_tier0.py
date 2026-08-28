import pytest
import requests
import time

BASE = "http://127.0.0.1:8000"
API = f"{BASE}/api"

SUPER_ADMIN = ("info.akseslegal.id@gmail.com", "Admin123!")
STAFF_CS = ("dewi@ali.id", "Staff123!")
STAFF_DRAF = ("elis@ali.id", "Staff123!")


def login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json().get("token") or r.cookies.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    s._user = r.json()["user"]
    return s


@pytest.fixture(scope="module")
def admin():
    return login(*SUPER_ADMIN)


@pytest.fixture(scope="module")
def dewi():
    return login(*STAFF_CS)


@pytest.fixture(scope="module")
def elis():
    return login(*STAFF_DRAF)


@pytest.fixture(scope="module")
def boards(admin):
    return admin.get(f"{API}/boards").json()


@pytest.fixture(scope="module")
def divisions(admin):
    return admin.get(f"{API}/divisions").json()


class TestTier0Foundations:
    def test_01_client_extraction_and_linking(self, admin, dewi, boards):
        dewi_board = next(b for b in boards if b["name"] == "CS DEWI ALI")
        lists = admin.get(f"{API}/boards/{dewi_board['id']}/full").json()["lists"]
        lst = lists[0]

        client_name = f"PT Tier0 Maju Bersama {int(time.time())}"
        r = dewi.post(f"{API}/work-items", json={
            "board_id": dewi_board["id"],
            "list_id": lst["id"],
            "title": f"Pendirian {client_name}",
            "client_name": client_name,
        })
        assert r.status_code == 200, r.text
        item = r.json()
        assert item.get("client_id") is not None
        assert item.get("status") in ("BARU", "active")
        assert item.get("distribution_status") in ("MENUNGGU_DIAMBIL", "menunggu")

        # Verify client entity in /api/clients
        clients = admin.get(f"{API}/clients").json()
        matching = next((c for c in clients if c["id"] == item["client_id"]), None)
        assert matching is not None
        assert matching["name"] == client_name
        assert matching["business_type"] == "Perusahaan"

        # Verify detail endpoint returns linked client and assignments
        detail_res = dewi.get(f"{API}/work-items/{item['id']}").json()
        assert detail_res["client"] is not None
        assert detail_res["client"]["id"] == item["client_id"]
        assert len(detail_res["assignments"]) >= 1

        admin.delete(f"{API}/work-items/{item['id']}")

    def test_02_work_assignment_lifecycle(self, admin, dewi, elis, boards, divisions):
        cs_board = next(b for b in boards if b["name"] == "CS DEWI ALI")
        lists = admin.get(f"{API}/boards/{cs_board['id']}/full").json()["lists"]
        lst = lists[0]

        # 1. Create work item
        r = dewi.post(f"{API}/work-items", json={
            "board_id": cs_board["id"],
            "list_id": lst["id"],
            "title": f"TEST WorkAssignment Lifecycle {int(time.time())}",
            "client_name": "CV Sukses Mandiri",
        })
        assert r.status_code == 200
        item = r.json()
        item_id = item["id"]

        # Initial assignment check
        assignments = admin.get(f"{API}/work-items/{item_id}/assignments").json()
        assert len(assignments) >= 1
        assert assignments[0]["status"] in ("MENUNGGU_DIAMBIL", "menunggu")
        assert assignments[0]["user_id"] is None

        # 2. Claim item
        claim_res = dewi.post(f"{API}/work-items/{item_id}/claim")
        assert claim_res.status_code == 200
        assignments_after_claim = admin.get(f"{API}/work-items/{item_id}/assignments").json()
        assert any(a["user_id"] == dewi._user["id"] and a["status"] in ("DIAMBIL", "diambil") for a in assignments_after_claim)

        # 3. Release item with reason
        rel_res = dewi.post(f"{API}/work-items/{item_id}/release", json={"reason": "Kapasitas penuh"})
        assert rel_res.status_code == 200
        assignments_after_rel = admin.get(f"{API}/work-items/{item_id}/assignments").json()
        assert any(a["status"] in ("DILEPASKAN", "dilepaskan") and a["unassigned_reason"] == "Kapasitas penuh" for a in assignments_after_rel)

        # 4. Supervisor direct assign to elis
        draf_div = next(d for d in divisions if d.get("key") == "draf")
        assign_res = admin.post(f"{API}/work-items/{item_id}/assign", json={
            "add_user_ids": [elis._user["id"]],
            "add_division_ids": [draf_div["id"]],
        })
        assert assign_res.status_code == 200
        assignments_after_assign = admin.get(f"{API}/work-items/{item_id}/assignments").json()
        assert any(a["user_id"] == elis._user["id"] and a["status"] in ("DIRECT_ASSIGNED", "DIAMBIL") for a in assignments_after_assign)

        # 5. Submit item
        sub_res = elis.post(f"{API}/work-items/{item_id}/submit")
        assert sub_res.status_code == 200
        detail = admin.get(f"{API}/work-items/{item_id}").json()["item"]
        assert detail["status"] in ("SELESAI", "MENUNGGU", "done", "submitted")

        # 6. Reopen item
        reopen_res = admin.post(f"{API}/work-items/{item_id}/reopen")
        assert reopen_res.status_code == 200
        detail_reopen = admin.get(f"{API}/work-items/{item_id}").json()["item"]
        assert detail_reopen["status"] in ("PROSES", "BARU", "active")
        assert detail_reopen["completed_at"] is None

        admin.delete(f"{API}/work-items/{item_id}")
