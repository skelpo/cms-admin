# Demo sites for App Store screenshots

Two local Skelpo CMS instances with neutral sample content: a fictional
outdoor-tour company, "Northwind Tours" (English) and "Nordwind Touren"
(German). They are separate instances because content-type labels in Skelpo
CMS are not per language.

| | English | German |
|---|---|---|
| CMS | http://127.0.0.1:3144 | http://127.0.0.1:3145 |
| Database | `skelpo_demo_en` | `skelpo_demo_de` |
| Admin | emma@demo.skelpo.com | lena@demo.skelpo.com |
| Password | `northwind-demo-2026` | `northwind-demo-2026` |

Local only. The App Review demo is a separate instance, below.

## Run

```bash
cd ../skelpo-cms
node --env-file=../skelpo-cms-admin/appstore/demo/en.env --import tsx src/server.ts &
node --env-file=../skelpo-cms-admin/appstore/demo/de.env --import tsx src/server.ts &
```

## Set up from scratch

```bash
mysql -h127.0.0.1 -uroot -e "CREATE DATABASE skelpo_demo_en; CREATE DATABASE skelpo_demo_de"
cd ../skelpo-cms
node --env-file=../skelpo-cms-admin/appstore/demo/en.env --import tsx src/cli/main.ts migrate
node --env-file=../skelpo-cms-admin/appstore/demo/en.env --import tsx src/cli/main.ts user create emma@demo.skelpo.com "Emma Walker" --role admin
# same for de.env with lena@demo.skelpo.com "Lena Brandt"; start both servers, then:
cd ../skelpo-cms-admin
python3 appstore/demo/seed.py en
python3 appstore/demo/seed.py de
```

`seed.py` wipes the site's content, media and messages and fills them again,
so rerun it right before taking screenshots: "2 h ago", "Yesterday" and the
inbox grouping are relative to now.

Photos: `photos/` holds Unsplash-licensed images from picsum.photos (free
for commercial use, no attribution required). They are gitignored, so
download them again with the IDs listed in `seed.py` (`PHOTO_ALT`):
`curl -L -o photos/<id>.jpg https://picsum.photos/id/<id>/1600/1067`.

## Screenshots

`scripts/screenshots.sh` signs in to these sites on the "Shots iPhone 6.9"
simulator. The `SKELPO_DEV_HOST` dev hook shows `127.0.0.1` as
`demo.skelpo.com`. Upload with `python3 scripts/asc.py screenshots appstore/screenshots`.

## demo.skelpo.com (App Review)

The demo account for App Review is a separate Skelpo CMS instance at
https://demo.skelpo.com with the same Northwind content, filled by
`seed.py` (it takes `SEED_BASE`, `SEED_PASSWORD`, `SEED_SQL` and
`SEED_RESET_UPLOADS` to target a remote site; see its docstring). Email is
switched off there, so invites send nothing. Its server setup is not part
of this repo.
