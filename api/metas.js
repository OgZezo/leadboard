/**
 * /api/metas
 *
 * GET  → retorna metas atuais
 * POST → salva/atualiza metas (upsert na linha id=1)
 *
 * Env vars necessárias na Vercel:
 *   SUPABASE_URL      → https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY → eyJh...
 *
 * Tabela Supabase esperada (SQL no README):
 *   CREATE TABLE metas (
 *     id            int  PRIMARY KEY DEFAULT 1,
 *     meta_vendas   numeric NOT NULL DEFAULT 0,
 *     meta_entradas numeric NOT NULL DEFAULT 0,
 *     meta_equipes  numeric NOT NULL DEFAULT 0,
 *     updated_at    timestamptz DEFAULT now()
 *   );
 *   -- garante apenas 1 linha
 *   INSERT INTO metas (id) VALUES (1) ON CONFLICT DO NOTHING;
 */

export const config = { runtime: "edge" };

const TABLE = "metas";

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const base = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_ANON_KEY;

  if (!base || !key) return json({ error: "Supabase não configurado" }, 500);

  const endpoint = `${base}/rest/v1/${TABLE}?id=eq.1`;
  const headers  = supaHeaders(key);

  /* ── GET ── */
  if (req.method === "GET") {
    const res  = await fetch(endpoint, { headers });
    const rows = await res.json();
    const meta = rows?.[0] ?? { meta_vendas: 0, meta_entradas: 0, meta_equipes: 0 };
    return json({ ok: true, data: meta });
  }

  /* ── POST ── */
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Body JSON inválido" }, 400); }

    const payload = {
      id:            1,
      meta_vendas:   Number(body.meta_vendas)   || 0,
      meta_entradas: Number(body.meta_entradas) || 0,
      meta_equipes:  Number(body.meta_equipes)  || 0,
      updated_at:    new Date().toISOString(),
    };

    const res = await fetch(`${base}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: err }, 502);
    }

    return json({ ok: true, data: payload });
  }

  return json({ error: "Método não permitido" }, 405);
}

/* ─── helpers ─────────────────────────────────────────────── */

function supaHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}
