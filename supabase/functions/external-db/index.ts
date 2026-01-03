import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExternalDbRequest {
  connectionString: string;
  query: string;
  isWrite?: boolean;
  params?: unknown[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionString, query, isWrite = false, params = [] }: ExternalDbRequest = await req.json();

    if (!connectionString) {
      throw new Error("connectionString is required");
    }

    if (!query) {
      throw new Error("query is required");
    }

    console.log(`Executing ${isWrite ? "write" : "read"} query on external database`);
    console.log(`Query: ${query.slice(0, 200)}...`);

    const client = new Client(connectionString);
    await client.connect();

    try {
      const result = await client.queryArray(query, params);

      if (isWrite) {
        return new Response(
          JSON.stringify({
            success: true,
            rowCount: result.rowCount,
            command: result.command,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For read queries, return rows with column names
      const columns = result.rowDescription?.columns?.map(c => c.name) || [];
      const rows = result.rows.map(row => {
        const obj: Record<string, unknown> = {};
        row.forEach((value, i) => {
          obj[columns[i] || `col_${i}`] = value;
        });
        return obj;
      });

      return new Response(
        JSON.stringify({
          success: true,
          columns,
          rows,
          rowCount: result.rowCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await client.end();
    }

  } catch (error) {
    console.error("External DB error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Database operation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
