-- Run once on the Neon "feynman" database.
create table if not exists waitlist (
  email text primary key,
  source text not null default 'site',
  created_at timestamptz not null default now()
);
