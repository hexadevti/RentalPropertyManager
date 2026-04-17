-- Optional script: import existing KV data from a JSON object.
-- Replace the JSON in the payload CTE with your exported Spark KV data.

with payload as (
  select
    '{
      "app-language": "pt",
      "app-currency": "BRL",
      "properties": [],
      "transactions": [],
      "contracts": [],
      "guests": [],
      "service-providers": [
  {
    "name": "Sr. Mário",
    "service": "Encanador, pintor e pedreiro",
    "phone": "11992359798",
    "email": "",
    "document": "",
    "address": "",
    "notes": "",
    "id": "1776345107046",
    "createdAt": "2026-04-16T13:11:47.046Z"
  },
  {
    "name": "Mercado Livre",
    "service": "Compra de materiais",
    "phone": "11992359798",
    "email": "",
    "document": "",
    "address": "",
    "notes": "",
    "id": "1776345142982",
    "createdAt": "2026-04-16T13:12:22.982Z"
  }
],
      "tasks": [],
      "appointments": [],
      "owners": [
  {
    "name": "Patricia Mara Oliveira Cintra de Faria",
    "email": "patriciantr@gmail.com",
    "phone": "35987997953",
    "document": "24634561832",
    "address": "AVENIDA BPS, 2275 Apto 702",
    "notes": "",
    "id": "1776374611866",
    "createdAt": "2026-04-16T21:23:31.866Z"
  }
],
      "documents": [],
      "contract-templates": [],
      "user-profiles": [
  {
    "githubLogin": "hexadevti",
    "role": "admin",
    "status": "approved",
    "email": "",
    "avatarUrl": "https://avatars.githubusercontent.com/u/5727814?v=4",
    "createdAt": "2026-04-16T21:59:05.052Z",
    "updatedAt": "2026-04-16T21:59:05.052Z",
    "id": "590e656c"
  }
]
    }'::jsonb as data
)
insert into public.app_kv (key, value)
select kv.key, kv.value
from payload
cross join lateral jsonb_each(payload.data) as kv(key, value)
on conflict (key)
do update set
  value = excluded.value,
  updated_at = timezone('utc', now());
