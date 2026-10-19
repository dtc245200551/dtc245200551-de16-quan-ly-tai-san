#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_pass="$(cat /run/secrets/db_app_password)" \
  --set=migrate_pass="$(cat /run/secrets/db_migrate_password)" \
  --set=exporter_pass="$(cat /run/secrets/db_exporter_password)" <<'SQL'
CREATE ROLE asset_app LOGIN PASSWORD :'app_pass';
CREATE ROLE asset_migrate LOGIN PASSWORD :'migrate_pass';
CREATE ROLE asset_exporter LOGIN PASSWORD :'exporter_pass';
GRANT CONNECT ON DATABASE assets TO asset_app,asset_migrate,asset_exporter;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO asset_app,asset_exporter;
GRANT USAGE,CREATE ON SCHEMA public TO asset_migrate;
GRANT pg_monitor TO asset_exporter;
SQL
