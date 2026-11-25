#!/usr/bin/env python3
"""App Store Connect helper for Skelpo CMS Admin.

Reads the API key from ~/.perry/config.toml ([apple] key_id, issuer_id,
p8_key_path) so no secrets live in this repo.

  asc.py status            bundle ID, App Store profile, app record, builds
  asc.py setup             register the bundle ID + mint the App Store profile
  asc.py next-build        print the next free build number for VERSION
  asc.py metadata          push appstore/metadata.json (listing text in every
                           locale, categories, age rating, copyright, review notes)
  asc.py screenshots DIR   replace the screenshots from DIR/<locale>/<display>/*.png
                           (display = APP_IPHONE_67, APP_DESKTOP etc., files in upload order)
  asc.py setup-mac         mint the Mac App Store profile

ASC_PLATFORM=MAC_OS makes metadata/screenshots/next-build act on the macOS
version (default IOS). The macOS review details copy the contact and demo
account from the iOS version.
"""
import glob, hashlib, json, os, sys, time, tomllib, urllib.request, urllib.parse, base64
import jwt

BUNDLE_ID = "com.skelpo.cmsadmin"
APP_NAME = "Skelpo CMS"
PROFILE_PATH = os.path.expanduser("~/.perry/com_skelpo_cmsadmin_appstore.mobileprovision")
MAC_PROFILE_PATH = os.path.expanduser("~/.perry/com_skelpo_cmsadmin_macos.provisionprofile")
PLATFORM = os.environ.get("ASC_PLATFORM", "IOS")
API = "https://api.appstoreconnect.apple.com"

cfg = tomllib.load(open(os.path.expanduser("~/.perry/config.toml"), "rb"))["apple"]

def token():
    now = int(time.time())
    return jwt.encode({"iss": cfg["issuer_id"], "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
                      open(os.path.expanduser(cfg["p8_key_path"])).read(), algorithm="ES256",
                      headers={"kid": cfg["key_id"], "typ": "JWT"})

def call(method, path, params=None, body=None):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            # Apple's API has stretches of HTTP 5xx; wait and retry those.
            if e.code >= 500 and attempt < 5:
                time.sleep(10 * (attempt + 1))
                req.headers["Authorization"] = "Bearer " + token()
                continue
            sys.exit(f"{method} {path}: HTTP {e.code}\n{e.read().decode()[:2000]}")

def bundle():
    d = call("GET", "/v1/bundleIds", {"filter[identifier]": BUNDLE_ID})["data"]
    return next((b for b in d if b["attributes"]["identifier"] == BUNDLE_ID), None)

def profiles(bid, ptype="IOS_APP_STORE"):
    d = call("GET", f"/v1/bundleIds/{bid}/profiles")["data"]
    return [p for p in d if p["attributes"]["profileType"] == ptype and p["attributes"]["profileState"] == "ACTIVE"]

def setup_mac():
    b = bundle()
    ps = profiles(b["id"], "MAC_APP_STORE")
    if ps:
        prof = call("GET", f'/v1/profiles/{ps[0]["id"]}')["data"]
    else:
        certs = [c for c in call("GET", "/v1/certificates", {"limit": 200})["data"]
                 if c["attributes"]["certificateType"] in ("DISTRIBUTION", "MAC_APP_DISTRIBUTION")]
        if not certs:
            sys.exit("no Mac App Distribution certificate on the team")
        prof = call("POST", "/v1/profiles", body={"data": {"type": "profiles",
            "attributes": {"name": "Skelpo CMS Admin Mac App Store", "profileType": "MAC_APP_STORE"},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": b["id"]}},
                              "certificates": {"data": [{"type": "certificates", "id": c["id"]} for c in certs]}}}})["data"]
        print("created Mac App Store profile", prof["attributes"]["name"])
    open(MAC_PROFILE_PATH, "wb").write(base64.b64decode(prof["attributes"]["profileContent"]))
    print("profile saved to", MAC_PROFILE_PATH)

def app():
    d = call("GET", "/v1/apps", {"filter[bundleId]": BUNDLE_ID})["data"]
    return d[0] if d else None

def status():
    b = bundle()
    print("bundle ID:  ", b["id"] if b else "MISSING")
    if b:
        ps = profiles(b["id"])
        print("App Store profile:", ", ".join(p["attributes"]["name"] + " exp " + p["attributes"]["expirationDate"][:10] for p in ps) or "MISSING")
    a = app()
    print("app record: ", f'{a["attributes"]["name"]} (id {a["id"]})' if a else "MISSING (create it at appstoreconnect.apple.com)")
    if a:
        builds = call("GET", "/v1/builds", {"filter[app]": a["id"], "sort": "-uploadedDate", "limit": 5,
                                             "include": "preReleaseVersion"})
        vers = {v["id"]: v["attributes"]["version"] for v in builds.get("included", [])}
        for x in builds["data"]:
            pv = x["relationships"]["preReleaseVersion"]["data"]
            print(f'  build {vers.get(pv["id"] if pv else "", "?")} ({x["attributes"]["version"]}) '
                  f'{x["attributes"]["processingState"]} {x["attributes"]["uploadedDate"][:16]}')

def setup():
    b = bundle()
    if not b:
        b = call("POST", "/v1/bundleIds", body={"data": {"type": "bundleIds", "attributes": {
            "identifier": BUNDLE_ID, "name": "Skelpo CMS Admin", "platform": "UNIVERSAL"}}})["data"]
        print("registered bundle ID", BUNDLE_ID)
    ps = profiles(b["id"])
    if ps:
        prof = call("GET", f'/v1/profiles/{ps[0]["id"]}')["data"]
    else:
        certs = [c for c in call("GET", "/v1/certificates", {"limit": 200})["data"]
                 if c["attributes"]["certificateType"] in ("DISTRIBUTION", "IOS_DISTRIBUTION")]
        if not certs:
            sys.exit("no Apple Distribution certificate on the team")
        prof = call("POST", "/v1/profiles", body={"data": {"type": "profiles",
            "attributes": {"name": "Skelpo CMS Admin App Store", "profileType": "IOS_APP_STORE"},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": b["id"]}},
                              "certificates": {"data": [{"type": "certificates", "id": c["id"]} for c in certs]}}}})["data"]
        print("created App Store profile", prof["attributes"]["name"])
    open(PROFILE_PATH, "wb").write(base64.b64decode(prof["attributes"]["profileContent"]))
    print("profile saved to", PROFILE_PATH)

def next_build(version):
    a = app()
    if not a:
        sys.exit("no app record for " + BUNDLE_ID)
    d = call("GET", "/v1/builds", {"filter[app]": a["id"], "sort": "-uploadedDate", "limit": 50})["data"]
    nums = [int(x["attributes"]["version"]) for x in d if x["attributes"]["version"].isdigit()]
    print(max(nums, default=0) + 1)

def ios_version(a, platform=None):
    vs = call("GET", f"/v1/apps/{a['id']}/appStoreVersions", {"filter[platform]": platform or PLATFORM, "limit": 10})["data"]
    editable = [v for v in vs if v["attributes"]["appStoreState"] in
                ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "WAITING_FOR_REVIEW")]
    if not editable:
        sys.exit(f"no editable {platform or PLATFORM} App Store version")
    return editable[0]

def upsert(kind, parent_rel, parent_type, parent_id, existing, locale, attrs):
    """PATCH the localization for `locale` if it exists, else POST it."""
    cur = next((x for x in existing if x["attributes"]["locale"] == locale), None)
    if cur:
        call("PATCH", f"/v1/{kind}/{cur['id']}", body={"data": {"type": kind, "id": cur["id"], "attributes": attrs}})
        return cur["id"]
    d = call("POST", f"/v1/{kind}", body={"data": {"type": kind, "attributes": dict(attrs, locale=locale),
              "relationships": {parent_rel: {"data": {"type": parent_type, "id": parent_id}}}}})["data"]
    return d["id"]

def metadata():
    m = json.load(open(os.path.join(os.path.dirname(__file__), "..", "appstore", "metadata.json")))
    a = app()
    info = call("GET", f"/v1/apps/{a['id']}/appInfos")["data"]
    info = next(i for i in info if i["attributes"]["state"] != "READY_FOR_DISTRIBUTION")
    v = ios_version(a)
    info_locs = call("GET", f"/v1/appInfos/{info['id']}/appInfoLocalizations")["data"]
    ver_locs = call("GET", f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]
    for loc, t in m["locales"].items():
        if PLATFORM == "MAC_OS":
            t = dict(t, **m.get("macos", {}).get(loc, {}))
        upsert("appInfoLocalizations", "appInfo", "appInfos", info["id"], info_locs, loc,
               {"name": t["name"], "subtitle": t["subtitle"], "privacyPolicyUrl": t["privacyPolicyUrl"]})
        # Adding an app-info locale creates the matching version locale.
        ver_locs = call("GET", f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]
        upsert("appStoreVersionLocalizations", "appStoreVersion", "appStoreVersions", v["id"], ver_locs, loc,
               {k: t[k] for k in ("description", "keywords", "promotionalText", "supportUrl", "marketingUrl")})
        print("listing", loc, "ok")
    call("PATCH", f"/v1/appInfos/{info['id']}", body={"data": {"type": "appInfos", "id": info["id"], "relationships": {
        "primaryCategory": {"data": {"type": "appCategories", "id": m["primaryCategory"]}},
        "secondaryCategory": {"data": {"type": "appCategories", "id": m["secondaryCategory"]}}}}})
    print("categories", m["primaryCategory"], "/", m["secondaryCategory"])
    ar = call("GET", f"/v1/appInfos/{info['id']}/ageRatingDeclaration")["data"]
    call("PATCH", f"/v1/ageRatingDeclarations/{ar['id']}", body={"data": {"type": "ageRatingDeclarations", "id": ar["id"], "attributes": m["ageRating"]}})
    print("age rating ok")
    call("PATCH", f"/v1/appStoreVersions/{v['id']}", body={"data": {"type": "appStoreVersions", "id": v["id"],
         "attributes": {"copyright": m["copyright"]}}})
    rd = call("GET", f"/v1/appStoreVersions/{v['id']}/appStoreReviewDetail").get("data")
    attrs = {"notes": m["reviewNotes"]}
    if PLATFORM != "IOS":
        # Contact + demo account aren't in the repo; take them from the iOS version.
        iv = call("GET", f"/v1/apps/{a['id']}/appStoreVersions", {"filter[platform]": "IOS", "limit": 1})["data"][0]
        ird = call("GET", f"/v1/appStoreVersions/{iv['id']}/appStoreReviewDetail").get("data")
        if ird:
            attrs.update({k: v for k, v in ird["attributes"].items() if k.startswith(("contact", "demoAccount")) and v is not None})
            rd_same = rd and all(rd["attributes"].get(k) == v for k, v in attrs.items())
            if rd_same:
                attrs = None
    if attrs is None or (PLATFORM == "IOS" and rd and rd["attributes"].get("notes") == m["reviewNotes"]):
        pass  # unchanged; a PATCH would also demand the contact fields
    elif rd:
        call("PATCH", f"/v1/appStoreReviewDetails/{rd['id']}", body={"data": {"type": "appStoreReviewDetails", "id": rd["id"], "attributes": attrs}})
    else:
        call("POST", "/v1/appStoreReviewDetails", body={"data": {"type": "appStoreReviewDetails", "attributes": attrs,
             "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": v["id"]}}}}})
    print("copyright + review notes ok (needs the review contact set first; demo account not in metadata.json)")

def upload_screenshot(set_id, path):
    data = open(path, "rb").read()
    shot = call("POST", "/v1/appScreenshots", body={"data": {"type": "appScreenshots",
        "attributes": {"fileName": os.path.basename(path), "fileSize": len(data)},
        "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}})["data"]
    for op in shot["attributes"]["uploadOperations"]:
        chunk = data[op["offset"]:op["offset"] + op["length"]]
        req = urllib.request.Request(op["url"], method=op["method"], data=chunk,
                                     headers={h["name"]: h["value"] for h in op["requestHeaders"]})
        urllib.request.urlopen(req).read()
    call("PATCH", f"/v1/appScreenshots/{shot['id']}", body={"data": {"type": "appScreenshots", "id": shot["id"],
         "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})

def screenshots(root):
    a = app()
    v = ios_version(a)
    locs = {x["attributes"]["locale"]: x["id"] for x in
            call("GET", f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]}
    for loc_dir in sorted(glob.glob(os.path.join(root, "*"))):
        loc = os.path.basename(loc_dir)
        if loc not in locs:
            print("skip", loc, "(no listing; run metadata first)")
            continue
        sets = call("GET", f"/v1/appStoreVersionLocalizations/{locs[loc]}/appScreenshotSets")["data"]
        for disp_dir in sorted(glob.glob(os.path.join(loc_dir, "*"))):
            disp = os.path.basename(disp_dir)
            if (disp == "APP_DESKTOP") != (PLATFORM == "MAC_OS"):
                continue  # Mac sets go to the macOS version, the rest to iOS
            files = sorted(glob.glob(os.path.join(disp_dir, "*.png")))
            if not files:
                continue
            cur = next((s for s in sets if s["attributes"]["screenshotDisplayType"] == disp), None)
            if cur:
                for old in call("GET", f"/v1/appScreenshotSets/{cur['id']}/appScreenshots")["data"]:
                    call("DELETE", f"/v1/appScreenshots/{old['id']}")
                sid = cur["id"]
            else:
                sid = call("POST", "/v1/appScreenshotSets", body={"data": {"type": "appScreenshotSets",
                      "attributes": {"screenshotDisplayType": disp},
                      "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": locs[loc]}}}}})["data"]["id"]
            for f in files:
                upload_screenshot(sid, f)
            print(f"{loc} {disp}: {len(files)} screenshots")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "screenshots":
        screenshots(sys.argv[2])
    else:
        {"status": status, "setup": setup, "setup-mac": setup_mac, "metadata": metadata}.get(cmd, lambda: next_build(sys.argv[2]))()
