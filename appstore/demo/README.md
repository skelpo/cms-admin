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

The public demo for App Review runs on webserver.skelpo.net, like the
skelpo.com CMS next to it (same release, copied):

| | |
|---|---|
| URL | https://demo.skelpo.com (Let's Encrypt, nginx `sites-available/demo.skelpo.com`) |
| Service | `skelpo-demo.service` → 127.0.0.1:3146, user `skelpo-demo` |
| Files | `/srv/skelpo-demo/{current,releases,shared}`; env in `shared/cms.env` |
| Database | `skelpo_demo` (MySQL user `skelpo_demo`, mysql_native_password) |
| Account | emma@demo.skelpo.com (admin); password only in `shared/admin.json` (root) |

`EMAIL_BACKEND=log`, so invites and password resets send nothing. Reset
the content (e.g. after a review) from here, through a tunnel:

```bash
ssh -f -N -L 13146:127.0.0.1:3146 root@webserver.skelpo.net
SEED_PASSWORD=$(ssh root@webserver.skelpo.net 'cut -d\" -f8 /srv/skelpo-demo/shared/admin.json') \
SEED_BASE=http://127.0.0.1:13146/api/v1 \
SEED_SQL="ssh root@webserver.skelpo.net mysql --defaults-file=/etc/mysql/debian.cnf skelpo_demo" \
SEED_RESET_UPLOADS="ssh root@webserver.skelpo.net 'find /srv/skelpo-demo/shared/uploads -mindepth 1 -delete'" \
python3 appstore/demo/seed.py en
pkill -f 13146:127.0.0.1:3146
```

If the reviewer changes the password, set a new one with
`mysql ... skelpo_demo` or the CMS CLI (`user create` reads the password
twice from stdin; pipe it with a pause between the lines).
