"""ALI Workspace iteration 3 tests: send/mirror, takeover, watch, release-reason,
comment edit/react, checklist advanced, link attachments, calendar, board copy/unarchive,
list copy/archive/move, custom fields, cover, start_date, template SKOR."""
import os
import time
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "info.akseslegal.id@gmail.com", "password": "Admin123!"}
ELIS = {"email": "elis@ali.id", "password": "Staff123!"}
DEWI = {"email": "dewi@ali.id", "password": "Staff123!"}
AMEL = {"email": "amel@ali.id", "password": "Staff123!"}
ANDI = {"email": "andi@ali.id", "password": "Staff123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    s._user = r.json()["user"]
    return s


@pytest.fixture(scope="module")
def admin(): return _login(ADMIN)
@pytest.fixture(scope="module")
def elis(): return _login(ELIS)
@pytest.fixture(scope="module")
def dewi(): return _login(DEWI)
@pytest.fixture(scope="module")
def amel(): return _login(AMEL)
@pytest.fixture(scope="module")
def andi(): return _login(ANDI)


@pytest.fixture(scope="module")
def divisions(admin):
    return admin.get(f"{API}/divisions").json()

@pytest.fixture(scope="module")
def boards(admin):
    return admin.get(f"{API}/boards").json()


def _div_by_key(divisions, key):
    return next(d for d in divisions if d.get("key") == key)


def _board_by_name(boards, name):
    return next(b for b in boards if b["name"] == name)


def _first_list(admin, board_id):
    full = admin.get(f"{API}/boards/{board_id}/full").json()
    return full["lists"][0]


def _create_item(session, board_id, list_id, title, **kwargs):
    body = {"board_id": board_id, "list_id": list_id, "title": title}
    body.update(kwargs)
    r = session.post(f"{API}/work-items", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- BANK DATA v3 ----------

class TestBankData:
    def test_bank_data_shape(self, admin, divisions):
        draf = _div_by_key(divisions, "draf")
        r = admin.get(f"{API}/bank-data/{draf['id']}")
        assert r.status_code == 200
        data = r.json()
        assert "division" in data and "boards" in data and "items" in data and "workload" in data
        assert data["division"]["id"] == draf["id"]

    def test_menunggu_vs_diambil(self, admin, dewi, divisions, boards):
        """Create item without members = menunggu; claim → diambil."""
        cs_div = _div_by_key(divisions, "cs")
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(dewi, dewi_board["id"], lst["id"], f"TEST_iter3_menunggu_{int(time.time())}")
        assert item["distribution_status"] in ("MENUNGGU_DIAMBIL", "menunggu")
        # bank data shows this in items
        bd = dewi.get(f"{API}/bank-data/{cs_div['id']}").json()
        found = next((i for i in bd["items"] if i["id"] == item["id"]), None)
        assert found and found["distribution_status"] in ("MENUNGGU_DIAMBIL", "menunggu")
        # claim
        r = dewi.post(f"{API}/work-items/{item['id']}/claim")
        assert r.status_code == 200
        detail = dewi.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert detail["distribution_status"] in ("DIAMBIL", "diambil")
        assert dewi._user["id"] in detail["member_ids"]
        # cleanup
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- TAKEOVER ----------

class TestTakeover:
    def test_admin_takeover_replaces_pic(self, admin, elis, divisions, boards):
        draf_board = _board_by_name(boards, "ADMIN DRAF INPUT")
        lst = _first_list(admin, draf_board["id"])
        item = _create_item(elis, draf_board["id"], lst["id"], f"TEST_takeover_{int(time.time())}", member_ids=[elis._user["id"]])
        r = admin.post(f"{API}/work-items/{item['id']}/takeover")
        assert r.status_code == 200, r.text
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert detail["member_ids"] == [admin._user["id"]]
        admin.delete(f"{API}/work-items/{item['id']}")

    def test_staff_cannot_takeover(self, admin, elis, dewi, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_takeover2_{int(time.time())}", member_ids=[dewi._user["id"]])
        r = elis.post(f"{API}/work-items/{item['id']}/takeover")
        assert r.status_code == 403, r.text
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- WATCH ----------

class TestWatch:
    def test_watch_toggle_and_notify_on_comment(self, admin, dewi, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_watch_{int(time.time())}")
        # dewi watches
        r = dewi.post(f"{API}/work-items/{item['id']}/watch", json={"on": True})
        assert r.status_code == 200
        assert dewi._user["id"] in r.json()["watcher_ids"]
        # admin comments → dewi (watcher) should be notified
        admin.post(f"{API}/work-items/{item['id']}/comments", json={"text": "hello watcher"})
        time.sleep(0.5)
        notifs = dewi.get(f"{API}/notifications/mine").json()["items"]
        assert any(n.get("work_item_id") == item["id"] and n.get("type") == "comment" for n in notifs)
        # toggle off
        r = dewi.post(f"{API}/work-items/{item['id']}/watch", json={"on": False})
        assert dewi._user["id"] not in r.json()["watcher_ids"]
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- RELEASE WITH REASON ----------

class TestRelease:
    def test_release_with_reason_notifies_creator(self, admin, elis, boards):
        # admin creates card assigned to elis; elis releases with reason
        draf_board = _board_by_name(boards, "ADMIN DRAF INPUT")
        lst = _first_list(admin, draf_board["id"])
        item = _create_item(admin, draf_board["id"], lst["id"], f"TEST_release_{int(time.time())}", member_ids=[elis._user["id"]])
        r = elis.post(f"{API}/work-items/{item['id']}/release", json={"reason": "Salah ambil"})
        assert r.status_code == 200, r.text
        assert elis._user["id"] not in r.json()["member_ids"]
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert detail["distribution_status"] in ("MENUNGGU_DIAMBIL", "menunggu", "DILEPASKAN", "dilepaskan")
        # admin (creator) should have a 'released' notification with reason text
        time.sleep(0.5)
        notifs = admin.get(f"{API}/notifications/mine").json()["items"]
        rel = next((n for n in notifs if n.get("work_item_id") == item["id"] and n.get("type") == "released"), None)
        assert rel is not None
        assert "Salah ambil" in (rel.get("body") or "") or "Salah ambil" in (rel.get("message") or "") or "Salah ambil" in str(rel)
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- SEND / MIRROR ----------

class TestSend:
    def test_send_to_division_creates_mirror_and_bankdata_entry(self, admin, dewi, divisions, boards):
        perizinan = _div_by_key(divisions, "perizinan")
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(dewi, dewi_board["id"], lst["id"], f"TEST_send_{int(time.time())}")
        r = dewi.post(f"{API}/work-items/{item['id']}/send", json={
            "division_id": perizinan["id"], "note": "Mohon lanjut proses perizinan",
        })
        assert r.status_code == 200, r.text
        detail = dewi.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert perizinan["id"] in detail["division_ids"]
        # target board mirror
        target_board = next(b for b in boards if b.get("division_id") == perizinan["id"])
        assert target_board["id"] in detail["mirror_board_ids"]
        # bank data of perizinan contains the item
        bd = admin.get(f"{API}/bank-data/{perizinan['id']}").json()
        assert any(i["id"] == item["id"] for i in bd["items"])
        # andi (supervisor perizinan) has notification
        andi_s = _login(ANDI)
        time.sleep(0.5)
        notifs = andi_s.get(f"{API}/notifications/mine").json()["items"]
        assert any(n.get("work_item_id") == item["id"] and n.get("type") == "bank_data" for n in notifs)
        admin.delete(f"{API}/work-items/{item['id']}")

    def test_send_direct_to_user(self, admin, dewi, amel, divisions, boards):
        pajak = _div_by_key(divisions, "pajak")
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(dewi, dewi_board["id"], lst["id"], f"TEST_send_user_{int(time.time())}")
        r = dewi.post(f"{API}/work-items/{item['id']}/send", json={
            "division_id": pajak["id"], "member_ids": [amel._user["id"]],
        })
        assert r.status_code == 200
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert amel._user["id"] in detail["member_ids"]
        assert detail["distribution_status"] in ("DIAMBIL", "diambil", "DIRECT_ASSIGNED")
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- COMMENT EDIT & REACT ----------

class TestComments:
    @pytest.fixture(scope="class")
    def card_with_comment(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_cmt_{int(time.time())}")
        c = admin.post(f"{API}/work-items/{item['id']}/comments", json={"text": "original"}).json()
        yield item, c
        admin.delete(f"{API}/work-items/{item['id']}")

    def test_edit_own_comment(self, admin, card_with_comment):
        item, c = card_with_comment
        r = admin.patch(f"{API}/comments/{c['id']}", json={"text": "edited text"})
        assert r.status_code == 200
        assert r.json()["text"] == "edited text"
        assert r.json()["edited_at"] is not None

    def test_edit_other_forbidden(self, dewi, card_with_comment):
        item, c = card_with_comment
        r = dewi.patch(f"{API}/comments/{c['id']}", json={"text": "hack"})
        assert r.status_code == 403

    def test_reaction_toggle_and_notify(self, admin, dewi, card_with_comment):
        item, c = card_with_comment
        r = dewi.post(f"{API}/comments/{c['id']}/react", json={"emoji": "👍"})
        assert r.status_code == 200
        assert dewi._user["id"] in r.json()["reactions"]["👍"]
        # admin (comment author) should get notification
        time.sleep(0.5)
        notifs = admin.get(f"{API}/notifications/mine").json()["items"]
        assert any(n.get("work_item_id") == item["id"] and n.get("type") == "reaction" for n in notifs)
        # toggle off
        r = dewi.post(f"{API}/comments/{c['id']}/react", json={"emoji": "👍"})
        assert dewi._user["id"] not in r.json()["reactions"]["👍"]

    def test_reaction_invalid_emoji(self, dewi, card_with_comment):
        item, c = card_with_comment
        r = dewi.post(f"{API}/comments/{c['id']}/react", json={"emoji": "🔥"})
        assert r.status_code == 400


# ---------- CHECKLIST ADVANCED ----------

class TestChecklistAdvanced:
    @pytest.fixture(scope="class")
    def cl_ctx(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_cl_{int(time.time())}")
        cl = admin.post(f"{API}/work-items/{item['id']}/checklists", json={"title": "Init"}).json()["checklists"][0]
        i1 = admin.post(f"{API}/work-items/{item['id']}/checklists/{cl['id']}/items", json={"text": "A"}).json()["checklists"][0]["items"][0]
        i2 = admin.post(f"{API}/work-items/{item['id']}/checklists/{cl['id']}/items", json={"text": "B"}).json()["checklists"][0]["items"][1]
        yield item, cl, i1, i2
        admin.delete(f"{API}/work-items/{item['id']}")

    def test_rename(self, admin, cl_ctx):
        item, cl, *_ = cl_ctx
        r = admin.patch(f"{API}/work-items/{item['id']}/checklists/{cl['id']}", json={"title": "Renamed"})
        assert r.status_code == 200
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert any(c["title"] == "Renamed" for c in detail["checklists"])

    def test_assignee_and_due(self, admin, dewi, cl_ctx):
        item, cl, i1, _ = cl_ctx
        r = admin.patch(f"{API}/work-items/{item['id']}/checklists/{cl['id']}/items/{i1['id']}",
                        json={"assignee_id": dewi._user["id"], "due_date": "2026-02-01"})
        assert r.status_code == 200
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        it = next(x for c in detail["checklists"] for x in c["items"] if x["id"] == i1["id"])
        assert it.get("assignee_id") == dewi._user["id"]
        assert it.get("due_date") == "2026-02-01"

    def test_reorder(self, admin, cl_ctx):
        item, cl, i1, i2 = cl_ctx
        r = admin.post(f"{API}/work-items/{item['id']}/checklists/{cl['id']}/reorder",
                       json={"ordered_ids": [i2["id"], i1["id"]]})
        assert r.status_code == 200
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        c = next(c for c in detail["checklists"] if c["id"] == cl["id"])
        assert c["items"][0]["id"] == i2["id"]

    def test_convert_item_to_card(self, admin, cl_ctx):
        item, cl, _, i2 = cl_ctx
        r = admin.post(f"{API}/work-items/{item['id']}/checklists/{cl['id']}/items/{i2['id']}/convert")
        assert r.status_code == 200, r.text
        new_card = r.json()
        assert new_card["list_id"] == item["list_id"]
        assert new_card["title"] == "B"
        # item marked done
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        it = next((x for c in detail["checklists"] for x in c["items"] if x["id"] == i2["id"]), None)
        assert it and it["done"] is True
        admin.delete(f"{API}/work-items/{new_card['id']}")


# ---------- CUSTOM FIELDS / COVER / START DATE ----------

class TestCardV3Extras:
    def test_custom_fields_and_cover_and_start(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_extras_{int(time.time())}")
        r = admin.patch(f"{API}/work-items/{item['id']}", json={
            "custom_fields": [{"name": "No. HP", "value": "0812xxx"}],
            "cover_color": "#f87171",
            "start_date": "2026-01-15",
        })
        assert r.status_code == 200
        detail = admin.get(f"{API}/work-items/{item['id']}").json()["item"]
        assert detail["cover_color"] == "#f87171"
        assert detail["start_date"] == "2026-01-15"
        assert detail["custom_fields"][0]["name"] == "No. HP"
        # clear cover
        admin.patch(f"{API}/work-items/{item['id']}", json={"cover_color": ""})
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- LINK ATTACHMENT ----------

class TestLinkAttachment:
    def test_add_link_valid_and_invalid(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_link_{int(time.time())}")
        r = admin.post(f"{API}/work-items/{item['id']}/attachments/link",
                       json={"url": "https://example.com/x", "name": "Contoh"})
        assert r.status_code == 200
        assert r.json()["content_type"] == "link"
        # invalid
        r2 = admin.post(f"{API}/work-items/{item['id']}/attachments/link",
                        json={"url": "notaurl", "name": "bad"})
        assert r2.status_code == 400
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- CALENDAR ----------

class TestCalendar:
    def test_calendar_month_returns_due_cards(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        lst = _first_list(admin, dewi_board["id"])
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        due = datetime.now(timezone.utc).strftime("%Y-%m-15")
        item = _create_item(admin, dewi_board["id"], lst["id"], f"TEST_cal_{int(time.time())}", due_date=due)
        r = admin.get(f"{API}/calendar", params={"month": month})
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert item["id"] in ids
        admin.delete(f"{API}/work-items/{item['id']}")


# ---------- BOARD COPY / UNARCHIVE / TEMPLATE ----------

class TestBoardAdmin:
    def test_template_skor_creates_lists(self, admin, divisions):
        cs = _div_by_key(divisions, "cs")
        r = admin.post(f"{API}/boards", json={
            "name": f"TEST_tpl_{int(time.time())}", "division_id": cs["id"], "template": "skor",
        })
        assert r.status_code == 200
        bid = r.json()["id"]
        full = admin.get(f"{API}/boards/{bid}/full").json()
        names = [l["name"] for l in full["lists"]]
        assert any("SKOR 1-2" in n for n in names)
        assert any("SKOR 6" in n for n in names)
        # cleanup: archive
        admin.delete(f"{API}/boards/{bid}")

    def test_copy_board_with_cards(self, admin, boards):
        src = _board_by_name(boards, "CS DEWI ALI")
        r = admin.post(f"{API}/boards/{src['id']}/copy", json={
            "name": f"TEST_copy_{int(time.time())}", "with_cards": True,
        })
        assert r.status_code == 200
        new_id = r.json()["id"]
        full = admin.get(f"{API}/boards/{new_id}/full").json()
        assert len(full["lists"]) > 0
        admin.delete(f"{API}/boards/{new_id}")

    def test_archive_and_unarchive(self, admin, divisions):
        r = admin.post(f"{API}/boards", json={"name": f"TEST_arch_{int(time.time())}"})
        bid = r.json()["id"]
        admin.delete(f"{API}/boards/{bid}")
        arch = admin.get(f"{API}/boards-archived").json()
        assert any(b["id"] == bid for b in arch)
        r = admin.post(f"{API}/boards/{bid}/unarchive")
        assert r.status_code == 200
        # cleanup
        admin.delete(f"{API}/boards/{bid}")

    def test_boards_archived_forbidden_for_staff(self, elis):
        r = elis.get(f"{API}/boards-archived")
        assert r.status_code == 403


# ---------- LIST OPS ----------

class TestListOps:
    def test_list_copy_with_cards_and_archive_all(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        # create a fresh list on dewi board with a card
        r = admin.post(f"{API}/boards/{dewi_board['id']}/lists", json={"name": f"TEST_L_{int(time.time())}"})
        lst = r.json()
        _create_item(admin, dewi_board["id"], lst["id"], "TEST_listcard_A")
        # copy
        r = admin.post(f"{API}/lists/{lst['id']}/copy")
        assert r.status_code == 200
        new_lst = r.json()
        assert "(salinan)" in new_lst["name"]
        # archive all cards in original list
        r = admin.post(f"{API}/lists/{lst['id']}/archive-all-cards")
        assert r.status_code == 200
        assert r.json()["archived"] >= 1
        # archive both lists via delete
        admin.delete(f"{API}/lists/{lst['id']}")
        admin.delete(f"{API}/lists/{new_lst['id']}")

    def test_move_list_requires_supervisor(self, admin, elis, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        other = _board_by_name(boards, "CS DEDES ALI")
        r = admin.post(f"{API}/boards/{dewi_board['id']}/lists", json={"name": f"TEST_move_{int(time.time())}"})
        lst = r.json()
        # staff forbidden
        r2 = elis.post(f"{API}/lists/{lst['id']}/move", json={"board_id": other["id"]})
        assert r2.status_code == 403
        # admin ok
        r3 = admin.post(f"{API}/lists/{lst['id']}/move", json={"board_id": other["id"]})
        assert r3.status_code == 200
        # verify moved
        full = admin.get(f"{API}/boards/{other['id']}/full").json()
        assert any(l["id"] == lst["id"] for l in full["lists"])
        admin.delete(f"{API}/lists/{lst['id']}")

    def test_list_archived_flag(self, admin, boards):
        dewi_board = _board_by_name(boards, "CS DEWI ALI")
        r = admin.post(f"{API}/boards/{dewi_board['id']}/lists", json={"name": f"TEST_arc_{int(time.time())}"})
        lst = r.json()
        r2 = admin.patch(f"{API}/lists/{lst['id']}", json={"archived": True})
        assert r2.status_code == 200
        assert r2.json().get("archived") is True
        admin.delete(f"{API}/lists/{lst['id']}")
