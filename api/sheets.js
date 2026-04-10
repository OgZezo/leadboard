/**
 * GET /api/sheets
 * Proxy para o Google Sheets publicado como CSV.
 * Faz cache de 30s na edge para não martela o Google.
 *
 * Query params:
 *   ?gid=0        → aba pelo ID (padrão 0 = primeira aba)
 *
 * Env vars necessárias na Vercel:
 *   SHEETS_URL  → URL base do CSV publicado
 *                 Ex: https://docs.google.com/spreadsheets/d/SEU_ID/export?format=csv
 */

export const config = { runtime: "edge" };

export default async function handler(req) {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const { searchParams } = new URL(req.url);
  const gid = searchParams.get("gid") ?? "0";

  const sheetsUrl = process.env.SHEETS_URL;
  if (!sheetsUrl) {
    return json({ error: "SHEETS_URL não configurada" }, 500);
  }

  const url = `${sheetsUrl}&gid=${gid}`;

  try {
    const upstream = await fetch(url, {
      // Diz ao edge para usar cache de 30s
      next: { revalidate: 30 },
    });

    if (!upstream.ok) {
      return json({ error: "Falha ao buscar planilha", status: upstream.status }, 502);
    }

    const csv = await upstream.text();
    const data = parseCSV(csv);

    return new Response(JSON.stringify({ ok: true, data, updatedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
        // Cache 30s no browser / CDN
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

/* ─── helpers ─────────────────────────────────────────────── */

function parseCSV(text) {
  // Parser robusto: respeita campos com vírgulas dentro de aspas
  function splitLine(line) {
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  }

  const lines = text.trim().split(/\r?\n/).map(splitLine);
  if (lines.length < 2) return [];

  // Trata cabeçalhos duplicados adicionando sufixo _2, _3...
  const rawHeaders = lines[0];
  const seen = {};
  const headers = rawHeaders.map(h => {
    const key = h || "_empty";
    seen[key] = (seen[key] || 0) + 1;
    return seen[key] > 1 ? `${key}_${seen[key]}` : key;
  });

  return lines.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}