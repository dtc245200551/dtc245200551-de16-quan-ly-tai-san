CREATE TABLE IF NOT EXISTS admins (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username varchar(40) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  auth_version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (
  sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
CREATE TABLE IF NOT EXISTS categories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS locations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS assets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(40) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  serial varchar(100) UNIQUE,
  category_id integer NOT NULL REFERENCES categories(id),
  location_id integer NOT NULL REFERENCES locations(id),
  purchased_on date,
  value_vnd numeric(14,0) NOT NULL DEFAULT 0 CHECK (value_vnd >= 0),
  status varchar(20) NOT NULL DEFAULT 'available' CHECK(status IN ('available','in_use','maintenance','retired')),
  notes varchar(2000) NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_filters_idx ON assets(status,category_id,location_id);
CREATE TABLE IF NOT EXISTS maintenance (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id integer NOT NULL REFERENCES assets(id),
  title varchar(160) NOT NULL,
  scheduled_on date NOT NULL,
  provider varchar(160) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
  previous_status varchar(20) CHECK(previous_status IN ('available','in_use')),
  cost_vnd numeric(14,0) NOT NULL DEFAULT 0 CHECK(cost_vnd >= 0),
  result varchar(2000) NOT NULL DEFAULT '',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='in_progress') = (started_at IS NOT NULL AND finished_at IS NULL)),
  CHECK (status NOT IN ('in_progress','completed') OR previous_status IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_maintenance_per_asset ON maintenance(asset_id) WHERE status='in_progress';
CREATE INDEX IF NOT EXISTS maintenance_due_idx ON maintenance(status,scheduled_on);
