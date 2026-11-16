#!/usr/bin/env python3
"""App Store Connect helper for Skelpo CMS Admin.

Reads the API key from ~/.perry/config.toml ([apple] key_id, issuer_id,
p8_key_path) so no secrets live in this repo.

  asc.py status            bundle ID, App Store profile, app record, builds
  asc.py setup             register the bundle ID + mint the App Store profile
  asc.py next-build        print the next free build number for VERSION
"""
import json, os, sys, time, tomllib, urllib.request, urllib.parse, base64
import jwt

BUNDLE_ID = "com.skelpo.cmsadmin"
APP_NAME = "Skelpo CMS"
PROFILE_PATH = os.path.expanduser("~/.perry/com_skelpo_cmsadmin_appstore.mobileprovision")
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
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path}: HTTP {e.code}\n{e.read().decode()[:2000]}")

def bundle():
    d = call("GET", "/v1/bundleIds", {"filter[identifier]": BUNDLE_ID})["data"]
    return next((b for b in d if b["attributes"]["identifier"] == BUNDLE_ID), None)

def profiles(bid):
    d = call("GET", f"/v1/bundleIds/{bid}/profiles")["data"]
    return [p for p in d if p["attributes"]["profileType"] == "IOS_APP_STORE" and p["attributes"]["profileState"] == "ACTIVE"]

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

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    {"status": status, "setup": setup}.get(cmd, lambda: next_build(sys.argv[2]))()
