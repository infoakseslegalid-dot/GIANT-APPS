"""ALI Workspace backend integration tests."""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "info.akseslegal.id@gmail.com", "password": "Admin123!"}
STAFF_ELIS = {"email": "elis@ali.id", "password": "Staff123!"}
STAFF_DEWI = {"email": "dewi@ali.id", "password": "Staff123!"}
SUP_ANDI = {"email": "andi@ali.id", "password": "Staff123!"}


def login(session, creds):
    r = session.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return data


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    login(s, ADMIN)
    return s


@pytest.fixture(scope="session")
def elis_session():
    s = requests.Session()
    login(s, STAFF_ELIS)
    return s


@pytest.fixture(scope="session")
def dewi_session():
    s = requests.Session()
    login(s, STAFF_DEWI)
    return s


@pytest.fixture(scope="session")
def andi_session():
    s = requests.Session()
    login(s, SUP_ANDI)
    return s


# ---------- AUTH ----------

class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_login_success(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == ADMIN["email"]
        assert d["user"]["role"] == "super_admin"
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        # httpOnly cookie
        assert "access_token" in s.cookies.get_dict()

    def test_login_invalid_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"}, timeout=10)
        assert r.status_code == 401
        assert "salah" in r.text.lower() or "invalid" in r.text.lower()

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_bearer(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]


# ---------- BOARDS / SEED ----------

class TestBoards:
    def test_list_boards_admin(self, admin_session):
        r = admin_session.get(f"{API}/boards", timeout=15)
        assert r.status_code == 200
        boards = r.json()
        names = [b["name"] for b in boards]
        expected = ["CS DEDES ALI", "CS DEVI ALI", "CS DEWI ALI", "CS JULIA ALI",
                    "ADMIN DRAF INPUT", "ADMIN PAJAK", "ADMIN PERIZINAN", "DESAIN & KONTEN"]
        for n in expected:
            assert n in names, f"missing seed board: {n}"

    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_active", "unassigned", "in_progress", "overdue", "submitted", "by_division", "by_user"):
            assert k in d

    def test_board_full(self, admin_session):
        boards = admin_session.get(f"{API}/boards").json()
        b = next(x for x in boards if x["name"] == "ADMIN DRAF INPUT")
        r = admin_session.get(f"{API}/boards/{b['id']}/full", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["board"]["id"] == b["id"]
        assert len(d["lists"]) > 0
        assert len(d["cards"]) > 0
        # Check "_id" excluded
        for c in d["cards"]:
            assert "_id" not in c


# ---------- WORK ITEM CRUD + MOVE ----------

@pytest.fixture(scope="session")
def draf_board(admin_session):
    boards = admin_session.get(f"{API}/boards").json()
    b = next(x for x in boards if x["name"] == "ADMIN DRAF INPUT")
    full = admin_session.get(f"{API}/boards/{b['id']}/full").json()
    return full


@pytest.fixture(scope="session")
def dewi_board(admin_session):
    boards = admin_session.get(f"{API}/boards").json()
    b = next(x for x in boards if x["name"] == "CS DEWI ALI")
    full = admin_session.get(f"{API}/boards/{b['id']}/full").json()
    return full


class TestWorkItemFlow:
    def test_create_update_move_delete(self, admin_session, draf_board):
        board_id = draf_board["board"]["id"]
        lists = draf_board["lists"]
        list_a = lists[0]["id"]
        list_b = lists[1]["id"] if len(lists) > 1 else lists[0]["id"]

        # CREATE
        body = {"board_id": board_id, "list_id": list_a, "title": f"TEST_item_{uuid.uuid4().hex[:6]}",
                "client_name": "TEST Client", "priority": "medium"}
        r = admin_session.post(f"{API}/work-items", json=body, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        assert "_id" not in item
        assert item["title"] == body["title"]
        item_id = item["id"]

        # GET detail
        r = admin_session.get(f"{API}/work-items/{item_id}")
        assert r.status_code == 200
        assert r.json()["item"]["title"] == body["title"]

        # UPDATE
        r = admin_session.patch(f"{API}/work-items/{item_id}", json={"title": "TEST_updated", "priority": "high"})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_updated"

        # MOVE
        r = admin_session.post(f"{API}/work-items/{item_id}/move",
                               json={"list_id": list_b, "position": 500.0, "board_id": board_id})
        assert r.status_code == 200

        # verify persisted
        d = admin_session.get(f"{API}/work-items/{item_id}").json()
        assert d["item"]["list_id"] == list_b

        # DELETE
        r = admin_session.delete(f"{API}/work-items/{item_id}")
        assert r.status_code == 200
        r = admin_session.get(f"{API}/work-items/{item_id}")
        assert r.status_code == 404

    def test_claim_flow(self, admin_session, elis_session, draf_board):
        # create card without PIC in draf board
        board_id = draf_board["board"]["id"]
        list_id = draf_board["lists"][0]["id"]
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": list_id,
            "title": f"TEST_claim_{uuid.uuid4().hex[:6]}", "member_ids": []
        })
        item_id = r.json()["id"]

        # elis claims
        r = elis_session.post(f"{API}/work-items/{item_id}/claim")
        assert r.status_code == 200, r.text
        assert len(r.json()["member_ids"]) == 1

        # cannot claim twice
        r = elis_session.post(f"{API}/work-items/{item_id}/claim")
        assert r.status_code == 400

        # my-work shows it
        my = elis_session.get(f"{API}/my-work").json()
        assert any(i["id"] == item_id for i in my)

        # cleanup
        admin_session.delete(f"{API}/work-items/{item_id}")

    def test_approval_flow(self, admin_session, elis_session, draf_board):
        board_id = draf_board["board"]["id"]
        list_id = draf_board["lists"][0]["id"]
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": list_id,
            "title": f"TEST_approval_{uuid.uuid4().hex[:6]}",
            "needs_approval": True,
        })
        item_id = r.json()["id"]

        # elis claims + submits
        elis_session.post(f"{API}/work-items/{item_id}/claim")
        r = elis_session.post(f"{API}/work-items/{item_id}/submit")
        assert r.status_code == 200
        assert r.json()["status"] in ("MENUNGGU", "submitted")

        # staff cannot approve
        r = elis_session.post(f"{API}/work-items/{item_id}/approve")
        assert r.status_code == 403

        # admin approves
        r = admin_session.post(f"{API}/work-items/{item_id}/approve")
        assert r.status_code == 200
        assert r.json()["status"] in ("SELESAI", "done")

        admin_session.delete(f"{API}/work-items/{item_id}")

    def test_mirror_flow(self, admin_session, dewi_board):
        # find a card in CS DEWI ALI and mirror to ADMIN PERIZINAN
        boards = admin_session.get(f"{API}/boards").json()
        perizinan = next(x for x in boards if x["name"] == "ADMIN PERIZINAN")
        source_card = None
        for c in dewi_board["cards"]:
            if perizinan["id"] not in (c.get("mirror_board_ids") or []) and c.get("board_id") == dewi_board["board"]["id"]:
                source_card = c
                break
        assert source_card, "No source card to mirror"

        r = admin_session.post(f"{API}/work-items/{source_card['id']}/mirror",
                               json={"board_id": perizinan["id"]})
        assert r.status_code == 200, r.text
        assert perizinan["id"] in r.json()["mirror_board_ids"]

        # verify card appears in perizinan board_full
        full = admin_session.get(f"{API}/boards/{perizinan['id']}/full").json()
        assert any(c["id"] == source_card["id"] for c in full["cards"])

        # unmirror
        r = admin_session.post(f"{API}/work-items/{source_card['id']}/unmirror",
                               json={"board_id": perizinan["id"]})
        assert r.status_code == 200
        assert perizinan["id"] not in r.json()["mirror_board_ids"]

    def test_archive_unarchive(self, admin_session, draf_board):
        board_id = draf_board["board"]["id"]
        list_id = draf_board["lists"][0]["id"]
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": list_id,
            "title": f"TEST_archive_{uuid.uuid4().hex[:6]}"
        })
        item_id = r.json()["id"]

        r = admin_session.post(f"{API}/work-items/{item_id}/archive")
        assert r.status_code == 200
        arch = admin_session.get(f"{API}/boards/{board_id}/archived").json()
        assert any(c["id"] == item_id for c in arch)

        r = admin_session.post(f"{API}/work-items/{item_id}/unarchive")
        assert r.status_code == 200
        admin_session.delete(f"{API}/work-items/{item_id}")


# ---------- CHECKLIST / COMMENT / ATTACHMENT ----------

class TestCardExtras:
    def test_checklist(self, admin_session, draf_board):
        board_id = draf_board["board"]["id"]
        list_id = draf_board["lists"][0]["id"]
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": list_id, "title": "TEST_checklist"})
        item_id = r.json()["id"]

        r = admin_session.post(f"{API}/work-items/{item_id}/checklists", json={"title": "TODO"})
        assert r.status_code == 200
        cl_id = r.json()["checklists"][0]["id"]

        r = admin_session.post(f"{API}/work-items/{item_id}/checklists/{cl_id}/items", json={"text": "task1"})
        assert r.status_code == 200
        sub_id = r.json()["checklists"][0]["items"][0]["id"]

        r = admin_session.patch(f"{API}/work-items/{item_id}/checklists/{cl_id}/items/{sub_id}", json={"done": True})
        assert r.status_code == 200
        assert r.json()["checklists"][0]["items"][0]["done"] is True

        admin_session.delete(f"{API}/work-items/{item_id}")

    def test_comment_with_mention(self, admin_session, elis_session, draf_board):
        board_id = draf_board["board"]["id"]
        list_id = draf_board["lists"][0]["id"]
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": list_id, "title": "TEST_comment"})
        item_id = r.json()["id"]

        r = admin_session.post(f"{API}/work-items/{item_id}/comments", json={"text": "Hai @Elis lihat ini"})
        assert r.status_code == 200
        c = r.json()
        assert len(c["mentions"]) >= 1

        # elis should get notification
        time.sleep(0.5)
        notif = elis_session.get(f"{API}/notifications/mine").json()
        assert any(n.get("work_item_id") == item_id for n in notif["items"])

        admin_session.delete(f"{API}/work-items/{item_id}")

    def test_attachment_upload(self, admin_session, draf_board):
        board_id = draf_board["board"]["id"]
        list_id = draf_board["lists"][0]["id"]
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": list_id, "title": "TEST_attach"})
        item_id = r.json()["id"]

        files = {"file": ("hello.txt", io.BytesIO(b"hello world"), "text/plain")}
        # need to remove content-type header for multipart
        s2 = requests.Session()
        s2.headers.update({k: v for k, v in admin_session.headers.items() if k.lower() != "content-type"})
        r = s2.post(f"{API}/work-items/{item_id}/attachments", files=files, timeout=30)
        assert r.status_code == 200, r.text
        att = r.json()
        assert att["original_filename"] == "hello.txt"
        assert "_id" not in att

        admin_session.delete(f"{API}/work-items/{item_id}")


# ---------- RBAC / SEARCH / AUTOMATION ----------

class TestRBAC:
    def test_staff_cannot_all_work(self, elis_session):
        r = elis_session.get(f"{API}/work-items")
        assert r.status_code == 403

    def test_admin_all_work(self, admin_session):
        r = admin_session.get(f"{API}/work-items")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search(self, admin_session):
        r = admin_session.get(f"{API}/search", params={"q": "Graha"})
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "boards" in d


class TestAutomation:
    def test_automation_rule_move_adds_label(self, admin_session, draf_board):
        board_id = draf_board["board"]["id"]
        lists = draf_board["lists"]
        target_list = lists[1]["id"]
        labels = draf_board["cards"] and admin_session.get(f"{API}/boards/{board_id}/full").json()["labels"]
        assert labels, "no labels seeded"
        label_id = labels[0]["id"]

        # create rule
        r = admin_session.post(f"{API}/boards/{board_id}/automation", json={
            "trigger": "card_moved", "trigger_list_id": target_list,
            "action": "add_label", "action_value": label_id
        })
        assert r.status_code == 200
        rule_id = r.json()["id"]

        # create card in list 0, move to list 1
        r = admin_session.post(f"{API}/work-items", json={
            "board_id": board_id, "list_id": lists[0]["id"], "title": "TEST_auto"})
        item_id = r.json()["id"]

        admin_session.post(f"{API}/work-items/{item_id}/move", json={
            "list_id": target_list, "position": 500.0, "board_id": board_id})

        d = admin_session.get(f"{API}/work-items/{item_id}").json()
        assert label_id in d["item"]["label_ids"], "automation did not add label"

        # cleanup
        admin_session.delete(f"{API}/automation/{rule_id}")
        admin_session.delete(f"{API}/work-items/{item_id}")


class TestNotifications:
    def test_my_notifications(self, admin_session):
        r = admin_session.get(f"{API}/notifications/mine")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "unread" in d


# ---------- ADMIN PANEL ----------

class TestAdminPanel:
    def test_users_list(self, admin_session):
        r = admin_session.get(f"{API}/users")
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 9

    def test_create_and_update_user(self, admin_session):
        email = f"test_{uuid.uuid4().hex[:6]}@ali.id"
        r = admin_session.post(f"{API}/users", json={
            "name": "TEST User", "email": email, "password": "Passw0rd!", "role": "staff"
        })
        assert r.status_code == 200
        uid = r.json()["id"]

        r = admin_session.patch(f"{API}/users/{uid}", json={"role": "viewer"})
        assert r.status_code == 200
        assert r.json()["role"] == "viewer"

    def test_divisions(self, admin_session):
        r = admin_session.get(f"{API}/divisions")
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_activities(self, admin_session):
        r = admin_session.get(f"{API}/activities?limit=10")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestApprovalSeed:
    def test_nusantara_seed_is_submitted(self, admin_session):
        # Find PT Nusantara Jaya card in ADMIN DRAF INPUT
        boards = admin_session.get(f"{API}/boards").json()
        b = next(x for x in boards if x["name"] == "ADMIN DRAF INPUT")
        full = admin_session.get(f"{API}/boards/{b['id']}/full").json()
        card = next((c for c in full["cards"] if "Nusantara" in c.get("title", "")), None)
        assert card is not None, "Seed card 'PT Nusantara Jaya' missing"
        assert card.get("status") in ("MENUNGGU", "submitted"), f"expected submitted/MENUNGGU, got {card.get('status')}"

    def test_graha_mirror_seed(self, admin_session):
        boards = admin_session.get(f"{API}/boards").json()
        dewi = next(x for x in boards if x["name"] == "CS DEWI ALI")
        perizinan = next(x for x in boards if x["name"] == "ADMIN PERIZINAN")
        full = admin_session.get(f"{API}/boards/{dewi['id']}/full").json()
        card = next((c for c in full["cards"] if "Graha" in c.get("title", "")), None)
        assert card is not None
        assert perizinan["id"] in (card.get("mirror_board_ids") or [])
