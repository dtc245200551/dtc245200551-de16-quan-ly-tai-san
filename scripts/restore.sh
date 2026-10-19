#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
mode=${1:-}
case "$mode" in --verify|--verify-current|--apply) ;; *) echo 'Usage: sh scripts/restore.sh --verify|--verify-current|--apply backup.dump'; exit 2;; esac
[ -n "${2:-}" ] && [ -f "$2" ] || { echo 'Backup file not found.'; exit 2; }
backup=$(realpath -- "$2")
if [ -f "$backup.sha256" ]; then
  (cd "$(dirname -- "$backup")" && sha256sum -c "$(basename -- "$backup").sha256")
fi
pg() { dc exec -T postgres sh -ec 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec "$@"' sh "$@"; }
fingerprint() {
  pg psql -h 127.0.0.1 -U asset_owner -d "$1" -At -v ON_ERROR_STOP=1 -c "SELECT json_build_object('assets',(SELECT count(*) FROM assets),'maintenance',(SELECT count(*) FROM maintenance),'fingerprint',md5(COALESCE((SELECT string_agg(row_to_json(a)::text,'' ORDER BY id) FROM assets a),'')||COALESCE((SELECT string_agg(row_to_json(m)::text,'' ORDER BY id) FROM maintenance m),'')||COALESCE((SELECT string_agg(row_to_json(c)::text,'' ORDER BY id) FROM categories c),'')||COALESCE((SELECT string_agg(row_to_json(l)::text,'' ORDER BY id) FROM locations l),'')))::text"
}
verify_db="hai_restore_verify_$(date +%s)_$$"
cleanup() { pg dropdb -h 127.0.0.1 -U asset_owner --if-exists "$verify_db" >/dev/null; }
trap cleanup EXIT
pg createdb -h 127.0.0.1 -U asset_owner "$verify_db"
pg pg_restore -h 127.0.0.1 -U asset_owner --dbname="$verify_db" --no-owner --no-acl --exit-on-error <"$backup"
restored=$(fingerprint "$verify_db")
current=$(fingerprint assets)
printf 'Restored archive: %s\n' "$restored"
if [ "$restored" = "$current" ]; then
  printf '%s\n' 'PASS: restored business rows match current database exactly.'
elif [ "$mode" = --verify-current ]; then
  echo 'FAIL: restored business rows differ from current database.'; exit 1
else
  echo 'Archive restored successfully. Data differs from current DB, as can occur with an older backup.'
fi
if [ "$mode" = --apply ]; then
  printf '%s\n' 'This replaces the current Hai Asset database. Type PHUC HOI HAI to continue:'
  read -r confirmation
  [ "$confirmation" = 'PHUC HOI HAI' ] || { echo 'Cancelled.'; exit 1; }
  dc stop nginx app
  if pg pg_restore -h 127.0.0.1 -U asset_owner --dbname=assets --clean --if-exists --exit-on-error <"$backup"; then
    dc start app nginx
    echo 'Restore applied. Initial password files are not rewritten; restored accounts keep their backed-up passwords.'
  else
    echo 'Restore failed. App and Nginx remain stopped; inspect the error and restore a valid backup.'; exit 1
  fi
fi
