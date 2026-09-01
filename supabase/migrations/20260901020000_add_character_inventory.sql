alter table public.characters
add column inventory jsonb not null default '[]'::jsonb
check (jsonb_typeof(inventory) = 'array');

