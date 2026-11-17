#!/usr/bin/env python3
"""Fill a local demo Skelpo CMS with sample content for App Store screenshots.

  python3 appstore/demo/seed.py en   # http://127.0.0.1:3144, English site
  python3 appstore/demo/seed.py de   # http://127.0.0.1:3145, German site

A fictional outdoor-tour company ("Northwind Tours" / "Nordwind Touren"):
a "tour" collection, pages, blog posts, drafts and items in review, ~40
photos (appstore/demo/photos, Unsplash-licensed via picsum.photos) and a
booking form with messages spread over the last two weeks. Re-running wipes
the site's content, media and messages first. See appstore/demo/README.md.
"""
import datetime, json, os, subprocess, sys, uuid, urllib.request

LANG = sys.argv[1] if len(sys.argv) > 1 else "en"
PORT = {"en": 3144, "de": 3145}[LANG]
DB = f"skelpo_demo_{LANG}"
BASE = f"http://127.0.0.1:{PORT}/api/v1"
EMAIL = {"en": "emma@demo.skelpo.com", "de": "lena@demo.skelpo.com"}[LANG]
PASSWORD = "northwind-demo-2026"
PHOTOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "photos")
E = LANG == "en"
token = ""


def sql(q):
    subprocess.run(["mysql", "-h127.0.0.1", "-uroot", DB, "-e", q], check=True)


def call(method, path, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", ctype)
    if token:
        req.add_header("Cookie", f"skelpoSession={token}")
    try:
        with urllib.request.urlopen(req) as r:
            s = r.read()
            return json.loads(s) if s else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path}: {e.code} {e.read().decode()[:600]}")


def upload(photo_id, alt):
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"altText\"\r\n\r\n"
            f"{json.dumps({LANG: alt})}\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{alt.lower().replace(' ', '-')[:40]}.jpg\"\r\n"
            f"Content-Type: image/jpeg\r\n\r\n").encode() + open(os.path.join(PHOTOS, f"{photo_id}.jpg"), "rb").read() + f"\r\n--{b}--\r\n".encode()
    return call("POST", "/media", raw=body, ctype=f"multipart/form-data; boundary={b}")["data"]["id"]


# ---- content ---------------------------------------------------------------

T = lambda en, de: en if E else de

PHOTO_ALT = {
    1011: T("Kayak on a calm fjord", "Kajak auf einem ruhigen Fjord"),
    1015: T("Fjord seen from above", "Fjord von oben"),
    1016: T("Red canyon at sunrise", "Rote Schlucht bei Sonnenaufgang"),
    1018: T("Green coastal hills", "Grüne Hügel an der Küste"),
    1036: T("Snowy mountain ridge", "Verschneiter Bergkamm"),
    1039: T("Waterfall in a mossy valley", "Wasserfall in einem bemoosten Tal"),
    1043: T("Granite valley with pine trees", "Granittal mit Kiefern"),
    1044: T("River running through a forest", "Fluss im Wald"),
    1050: T("Rocky coastline and turquoise sea", "Felsküste und türkisfarbenes Meer"),
    1001: T("Walkers on a quiet beach", "Wanderer an einem ruhigen Strand"),
    1005: T("Guide looking out over the sea", "Guide mit Blick aufs Meer"),
    29: T("Mountain pass in the clouds", "Bergpass in den Wolken"),
    28: T("Stream in a green forest", "Bach in einem grünen Wald"),
    17: T("Path through a summer meadow", "Weg durch eine Sommerwiese"),
    49: T("White village above the sea", "Weißes Dorf über dem Meer"),
    12: T("Beach at low tide", "Strand bei Ebbe"),
    13: T("Pebble beach and pine trees", "Kieselstrand mit Kiefern"),
    16: T("Calm bay in the morning", "Ruhige Bucht am Morgen"),
    1051: T("Wooden jetty on a mountain lake", "Holzsteg an einem Bergsee"),
    1055: T("Golden sand flats at sunset", "Goldene Sandbank im Abendlicht"),
    1057: T("Cliff above the ocean", "Klippe über dem Ozean"),
    129: T("Two people on a bench by the lake", "Zwei Menschen auf einer Bank am See"),
    142: T("Avenue leading to a castle", "Allee zu einem Schloss"),
    154: T("Hazy beach in the evening", "Diesiger Strand am Abend"),
    63: T("Coffee on a red table", "Kaffee auf einem roten Tisch"),
    1060: T("Barista pouring filter coffee", "Barista beim Aufgießen von Filterkaffee"),
    30: T("Enamel mug with coffee", "Emaillebecher mit Kaffee"),
    110: T("Sunset over open fields", "Sonnenuntergang über Feldern"),
    112: T("Wheat field in the wind", "Weizenfeld im Wind"),
    1040: T("Castle on a forested hill", "Burg auf einem bewaldeten Hügel"),
    1052: T("Sea stacks on a black-sand beach", "Felsnadeln an einem schwarzen Strand"),
    1019: T("Storm clouds over the sea", "Gewitterwolken über dem Meer"),
    1037: T("Autumn forest at sunrise", "Herbstwald bei Sonnenaufgang"),
    1047: T("Old town alley", "Gasse in der Altstadt"),
    10: T("Forest above a lake", "Wald über einem See"),
    11: T("Morning mist in the valley", "Morgennebel im Tal"),
    14: T("Rocky shore", "Felsiges Ufer"),
    15: T("Waterfall over rocks", "Wasserfall über Felsen"),
    1080: T("Fresh strawberries", "Frische Erdbeeren"),
    75: T("Grapes on the vine", "Weintrauben am Rebstock"),
}

DIFF = T(["Easy", "Moderate", "Challenging"], ["Leicht", "Mittel", "Anspruchsvoll"])
SEASONS = T(["Spring", "Summer", "Autumn", "Winter"], ["Frühling", "Sommer", "Herbst", "Winter"])

TOUR_TYPE = {
    "slug": "tour", "labelSingular": "Tour", "labelPlural": T("Tours", "Touren"),
    "isRoutable": True, "urlPattern": T("/tours/:slug", "/touren/:slug"), "icon": "map-pin", "sortOrder": 5,
    "fieldsSchema": {"version": 1, "fields": [
        {"name": "heroImage", "type": "image", "label": T("Cover photo", "Titelbild"), "required": True},
        {"name": "summary", "type": "textarea", "label": T("Summary", "Kurzbeschreibung"), "required": True,
         "validation": {"maxLength": 280}},
        {"name": "body", "type": "richtext", "label": T("Description", "Beschreibung"), "required": True},
        {"name": "duration", "type": "text", "label": T("Duration", "Dauer")},
        {"name": "price", "type": "number", "label": T("Price from (EUR)", "Preis ab (EUR)")},
        {"name": "difficulty", "type": "select", "label": T("Difficulty", "Schwierigkeit"), "required": True,
         "validation": {"options": DIFF}},
        {"name": "seasons", "type": "multiselect", "label": T("Seasons", "Saison"), "validation": {"options": SEASONS}},
        {"name": "gallery", "type": "gallery", "label": T("Gallery", "Galerie")},
        {"name": "bookable", "type": "boolean", "label": T("Open for bookings", "Buchbar")},
    ]},
}

# (photo, title, summary, duration, price, difficulty idx, seasons, status, edited hours ago)
TOURS = [
    (1011, T("Fjord Kayak Weekend", "Kajak-Wochenende im Fjord"),
     T("Two days of paddling between steep green walls, with a night in a lakeside cabin.",
       "Zwei Tage paddeln zwischen steilen grünen Felswänden, mit einer Nacht in der Hütte am Wasser."),
     T("2 days", "2 Tage"), 390, 1, [1, 2], "published", 3),
    (1050, T("Turquoise Coast Trail", "Küstenpfad Türkis"),
     T("A five-day walk along cliffs and hidden coves, luggage carried for you.",
       "Fünf Tage entlang von Klippen und versteckten Buchten, das Gepäck reist voraus."),
     T("5 days", "5 Tage"), 890, 1, [0, 1, 2], "published", 26),
    (1036, T("Winter Ridge Snowshoe Trek", "Schneeschuh-Tour am Winterkamm"),
     T("Quiet snowfields, a warm mountain hut and the clearest night sky of the year.",
       "Stille Schneefelder, eine warme Berghütte und der klarste Sternenhimmel des Jahres."),
     T("3 days", "3 Tage"), 540, 2, [3], "published", 50),
    (1039, T("Waterfall Valley Hike", "Wasserfall-Wanderung im Tal"),
     T("An easy day walk to three waterfalls, with lunch by the river.",
       "Eine leichte Tageswanderung zu drei Wasserfällen, mit Mittagessen am Fluss."),
     T("1 day", "1 Tag"), 89, 0, [0, 1, 2], "published", 74),
    (1043, T("Granite Valley Camp", "Camp im Granittal"),
     T("Base camp under the pines, with a different summit every day.",
       "Basislager unter Kiefern und jeden Tag ein anderer Gipfel."),
     T("4 days", "4 Tage"), 620, 2, [1], "published", 120),
    (1016, T("Red Canyon Sunrise Walk", "Sonnenaufgang in der roten Schlucht"),
     T("Start in the dark, reach the rim as the rocks start to glow.",
       "Start im Dunkeln, oben am Rand, wenn die Felsen zu leuchten beginnen."),
     T("Half a day", "Halber Tag"), 59, 0, [0, 2], "published", 170),
    (1001, T("Dune Coast Walk", "Dünenwanderung an der Küste"),
     T("Wide beaches, dune paths and fish soup in a harbour village.",
       "Weite Strände, Dünenwege und Fischsuppe in einem Hafendorf."),
     T("2 days", "2 Tage"), 240, 0, [0, 1], "published", 220),
    (1044, T("Riverside Forest Trail", "Waldpfad am Fluss"),
     T("Old forest, a river to follow and a wood-fired sauna at the end.",
       "Alter Wald, ein Fluss als Wegweiser und am Ende eine holzbefeuerte Sauna."),
     T("3 days", "3 Tage"), 410, 1, [1, 2], "published", 300),
    (49, T("Island Hopping Week", "Inselhüpfen für eine Woche"),
     T("Seven islands, six ferries and a lot of time to swim.",
       "Sieben Inseln, sechs Fähren und viel Zeit zum Schwimmen."),
     T("7 days", "7 Tage"), 1290, 0, [1], "draft", 2),
    (1019, T("Northern Lights Cabin Trip", "Polarlicht-Hüttentour"),
     T("Four nights far from any city light, with a guide who knows where to look.",
       "Vier Nächte fernab jeder Stadt, mit einem Guide, der weiß, wohin man schauen muss."),
     T("4 days", "4 Tage"), 980, 1, [3], "review", 5),
]

TOUR_BODY = T(
    """## What to expect

Our small groups of up to **eight people** set off early, while the light is soft and the trails are quiet. A local guide leads every day, knows the shortcuts and the best places for lunch.

### Included

- Guide for the whole trip
- All nights in cabins or small guesthouses
- Breakfast and packed lunches
- Kayaks, paddles and dry bags

### Good to know

You don't need experience, but you should enjoy being outside for **5–6 hours a day**. We send a packing list two weeks before you leave.

> "The most peaceful weekend I've had in years." — Sarah, May trip
""",
    """## Was dich erwartet

In kleinen Gruppen mit höchstens **acht Personen** starten wir früh, wenn das Licht weich ist und die Wege still sind. Ein Guide aus der Region begleitet dich jeden Tag und kennt die besten Plätze für die Mittagspause.

### Inklusive

- Guide für die ganze Tour
- Alle Nächte in Hütten oder kleinen Pensionen
- Frühstück und Lunchpakete
- Kajaks, Paddel und wasserdichte Packsäcke

### Gut zu wissen

Erfahrung brauchst du keine, aber du solltest gern **5–6 Stunden am Tag** draußen sein. Die Packliste schicken wir dir zwei Wochen vor der Abreise.

> „Das ruhigste Wochenende seit Jahren.“ — Sarah, Tour im Mai
""")

PAGES = [
    (1018, "home", T("Home", "Startseite"), T("Small-group hiking and kayak tours along the northern coast, led by local guides.",
        "Wander- und Kajaktouren in kleinen Gruppen entlang der Nordküste, geführt von Guides aus der Region."), "published", 30),
    (1005, T("about", "ueber-uns"), T("About us", "Über uns"), T("We are a team of six guides who grew up between the fjords and the sea.",
        "Wir sind sechs Guides, aufgewachsen zwischen Fjorden und Meer."), "published", 96),
    (1060, T("contact", "kontakt"), T("Contact", "Kontakt"), T("Questions about a tour? Write to us or drop by our office in the harbour.",
        "Fragen zu einer Tour? Schreib uns oder komm in unserem Büro am Hafen vorbei."), "published", 240),
    (None, "faq", "FAQ", T("Answers to the questions we hear most: fitness, gear, weather and cancellations.",
        "Antworten auf die häufigsten Fragen: Kondition, Ausrüstung, Wetter und Stornierung."), "published", 400),
    (129, T("group-trips", "gruppenreisen"), T("Group & company trips", "Gruppen- und Firmenreisen"), T("Private tours for teams, families and friends.",
        "Private Touren für Teams, Familien und Freundeskreise."), "draft", 20),
]

POSTS = [
    (12, T("five-quiet-beaches-for-autumn", "fuenf-ruhige-straende-im-herbst"), T("Five quiet beaches for autumn", "Fünf ruhige Strände für den Herbst"), "published", 60),
    (1037, T("packing-list-first-multi-day-hike", "packliste-erste-mehrtagestour"), T("Packing list for your first multi-day hike", "Packliste für deine erste Mehrtagestour"), "published", 200),
    (1057, T("meet-our-guides", "unsere-guides"), T("Meet our guides", "Das sind unsere Guides"), "draft", 8),
    (110, T("why-we-travel-slow", "warum-wir-langsam-reisen"), T("Why we travel slow", "Warum wir langsam reisen"), "review", 30),
]

FORMS = [
    ("booking", T("Booking request", "Buchungsanfrage")),
    ("contact", T("Contact", "Kontakt")),
]

# (form, minutes ago, data, spam)
MESSAGES = T([
    ("booking", 25, {"name": "Sophie Turner", "email": "sophie.turner@example.com", "tour": "Fjord Kayak Weekend",
                     "message": "Hi! Do you still have two places on the June 14 kayak weekend? We're both beginners but fit."}, 0),
    ("contact", 140, {"name": "Daniel Moore", "email": "dmoore@example.com",
                      "message": "Can we bring our dog on the Dune Coast Walk? She's calm and used to long walks."}, 0),
    ("booking", 330, {"name": "Aiko Tanaka", "email": "aiko.t@example.com", "tour": "Turquoise Coast Trail",
                      "message": "We'd like to book the coast trail for three people in September. Is there a single room option?"}, 0),
    ("contact", 1500, {"name": "Marcus Lee", "email": "marcus.lee@example.com",
                       "message": "Thank you for the waterfall hike on Saturday, the kids loved it. Photos attached in a separate mail!"}, 0),
    ("booking", 2900, {"name": "Olivia Brown", "email": "olivia.brown@example.com", "tour": "Winter Ridge Snowshoe Trek",
                       "message": "Is the snowshoe trek suitable for someone who has never been on snowshoes?"}, 0),
    ("contact", 5200, {"name": "Rafael Costa", "email": "rafael@example.com",
                       "message": "We're planning a team trip for 12 people in October. Could you send us an offer?"}, 0),
    ("booking", 8000, {"name": "Hannah Fischer", "email": "hannah.f@example.com", "tour": "Granite Valley Camp",
                       "message": "Booked for August, just checking: do we need our own sleeping bags?"}, 0),
    ("contact", 400, {"name": "Best Prices", "email": "deals@example.net", "message": "Cheap followers and likes, click now!!!"}, 1),
], [
    ("booking", 25, {"name": "Sophie Wagner", "email": "sophie.wagner@example.com", "tour": "Kajak-Wochenende im Fjord",
                     "message": "Hallo! Habt ihr für das Kajak-Wochenende am 14. Juni noch zwei Plätze? Wir sind Anfänger, aber fit."}, 0),
    ("contact", 140, {"name": "Daniel Krüger", "email": "d.krueger@example.com",
                      "message": "Dürfen wir unseren Hund zur Dünenwanderung mitbringen? Sie ist ruhig und lange Strecken gewohnt."}, 0),
    ("booking", 330, {"name": "Aylin Demir", "email": "aylin.demir@example.com", "tour": "Küstenpfad Türkis",
                      "message": "Wir möchten den Küstenpfad im September für drei Personen buchen. Gibt es auch Einzelzimmer?"}, 0),
    ("contact", 1500, {"name": "Markus Lehmann", "email": "markus.lehmann@example.com",
                       "message": "Danke für die Wasserfall-Wanderung am Samstag, die Kinder waren begeistert!"}, 0),
    ("booking", 2900, {"name": "Julia Becker", "email": "julia.becker@example.com", "tour": "Schneeschuh-Tour am Winterkamm",
                       "message": "Ist die Schneeschuh-Tour auch für jemanden geeignet, der noch nie auf Schneeschuhen stand?"}, 0),
    ("contact", 5200, {"name": "Tobias Schmitt", "email": "tobias@example.com",
                       "message": "Wir planen einen Teamausflug für 12 Personen im Oktober. Könnt ihr uns ein Angebot schicken?"}, 0),
    ("booking", 8000, {"name": "Hannah Fischer", "email": "hannah.f@example.com", "tour": "Camp im Granittal",
                       "message": "Für August gebucht, kurze Frage: Brauchen wir eigene Schlafsäcke?"}, 0),
    ("contact", 400, {"name": "Top Angebote", "email": "deals@example.net", "message": "Billige Follower und Likes, jetzt klicken!!!"}, 1),
])


def seo(text):
    pad = T(" Northwind Tours: small groups, local guides, slow travel.", " Nordwind Touren: kleine Gruppen, Guides aus der Region.")
    more = T(" Book your next trip online.", " Buche deine nächste Tour online.")
    d = text
    if len(d) < 70:
        d += pad
    if len(d) < 70:
        d += more
    return {"metaDescription": d[:158]}


def page_body(intro):
    return intro + "\n\n" + T(
        "## Why travel with us\n\n- Groups of up to **eight**\n- Guides who live here\n- Cabins, not hotels\n\n[See all tours](/tours)",
        "## Warum mit uns\n\n- Gruppen mit höchstens **acht** Personen\n- Guides, die hier leben\n- Hütten statt Hotels\n\n[Alle Touren ansehen](/touren)")


def set_times(cid, hours_ago):
    sql(f"UPDATE content SET updatedAt = NOW() - INTERVAL {int(hours_ago * 60)} MINUTE, "
        f"createdAt = NOW() - INTERVAL {int(hours_ago * 60) + 600} MINUTE, "
        f"publishedAt = IF(publishedAt IS NULL, NULL, NOW() - INTERVAL {int(hours_ago * 60)} MINUTE) WHERE id = {cid}")


def create(type_, slug, title, fields, status, hours, seo_text):
    d = call("POST", "/content", {"type": type_, "slug": slug, "locale": LANG, "title": title, "fields": fields,
                                  "seo": seo(seo_text), "status": "draft"})["data"]
    if status == "published":
        call("POST", f"/content/{d['id']}/publish")
    elif status == "review":
        call("PATCH", f"/content/{d['id']}", {"status": "review"})
    set_times(d["id"], hours)
    return d["id"]


def main():
    global token
    # Clean slate (keeps users, roles, built-in types).
    for t in ("formSubmissions", "contentRelations", "contentRevisions", "content", "media", "jobs", "auditLog"):
        sql(f"DELETE FROM `{t}`")
    sql("DELETE FROM contentTypes WHERE slug = 'tour'")
    upl = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"uploads-{LANG}")
    subprocess.run(["rm", "-rf", upl]); os.makedirs(upl, exist_ok=True)

    token = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})["data"]["token"]
    call("PUT", "/settings/site.locales", {"value": [LANG]})
    call("PUT", "/settings/site.defaultLocale", {"value": LANG})
    call("PUT", "/settings/site.title", {"value": T("Northwind Tours", "Nordwind Touren")})
    if not E:
        for slug, one, many in (("page", "Seite", "Seiten"), ("post", "Beitrag", "Beiträge"), ("doc", "Dokument", "Dokumente"),
                                ("errorPage", "Fehlerseite", "Fehlerseiten"), ("form", "Formular", "Formulare")):
            call("PATCH", f"/types/{slug}", {"labelSingular": one, "labelPlural": many})
    call("POST", "/types", TOUR_TYPE)

    media = {}
    # Oldest first, so the photos used by tours/pages are the newest in the library.
    for pid in reversed(list(PHOTO_ALT)):
        media[pid] = upload(pid, PHOTO_ALT[pid])
    print("media:", len(media))

    gallery_pool = [1015, 16, 13, 1051, 14, 15, 10, 11]
    for i, (pid, title, summary, dur, price, diff, seasons, status, hours) in enumerate(TOURS):
        fields = {"heroImage": media[pid], "summary": summary, "body": TOUR_BODY, "duration": dur, "price": price,
                  "difficulty": DIFF[diff], "seasons": [SEASONS[s] for s in seasons],
                  "gallery": [media[g] for g in gallery_pool[i % 4: i % 4 + 3]], "bookable": status == "published"}
        slug = title.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
        slug = "-".join("".join(ch if ch.isalnum() else " " for ch in slug).split())
        create("tour", slug, title, fields, status, hours, summary)
    for pid, slug, title, intro, status, hours in PAGES:
        fields = {"body": page_body(intro)}
        if pid:
            fields["heroImage"] = media[pid]
        create("page", slug, title, fields, status, hours, intro)
    for pid, slug, title, status, hours in POSTS:
        create("post", slug, title, {"excerpt": title, "body": page_body(title), "heroImage": media[pid], "tags": []},
               status, hours, title)
    form_ids = {}
    for slug, title in FORMS:
        fields = {"successMessage": T("Thanks! We'll get back to you within a day.", "Danke! Wir melden uns innerhalb eines Tages."),
                  "fields": [{"name": "name", "label": "Name", "type": "text", "required": True},
                             {"name": "email", "label": "E-Mail", "type": "email", "required": True},
                             {"name": "tour", "label": "Tour", "type": "text"},
                             {"name": "message", "label": T("Message", "Nachricht"), "type": "textarea", "required": True}]}
        form_ids[slug] = create("form", slug, title, fields, "published", 900, title)
    for form, mins, data, spam in MESSAGES:
        payload = json.dumps(data, ensure_ascii=False).replace("\\", "\\\\").replace("'", "\\'")
        sql(f"INSERT INTO formSubmissions (formId, data, ip, userAgent, isSpam, createdAt) VALUES "
            f"({form_ids[form]}, '{payload}', '203.0.113.7', 'Mozilla/5.0', {spam}, NOW() - INTERVAL {mins} MINUTE)")
    sql("DELETE FROM jobs")
    print("seeded", LANG, f"({len(TOURS)} tours, {len(PAGES)} pages, {len(POSTS)} posts, {len(MESSAGES)} messages)")


if __name__ == "__main__":
    main()
