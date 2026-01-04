import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExternalDbRequest {
  connectionString: string;
  action?: "query" | "schemas";  // Default: "query"
  query?: string;                // Required for action="query"
  isWrite?: boolean;
  params?: unknown[];
  schemas?: string[];            // Filter to specific schemas (for action="schemas")
}

// Schema introspection query - gets tables, columns, types, constraints
const SCHEMA_INTROSPECTION_QUERY = `
WITH table_info AS (
  SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale
  FROM information_schema.tables t
  JOIN information_schema.columns c 
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
  WHERE t.table_type = 'BASE TABLE'
    AND t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
),
constraints_info AS (
  SELECT 
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type,
    tc.constraint_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
),
indexes_info AS (
  SELECT
    schemaname AS table_schema,
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS index_definition
  FROM pg_indexes
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
)
SELECT 
  ti.table_schema,
  ti.table_name,
  ti.column_name,
  ti.ordinal_position,
  ti.data_type,
  ti.udt_name,
  ti.is_nullable,
  ti.column_default,
  ti.character_maximum_length,
  ti.numeric_precision,
  ci.constraint_type,
  ci.constraint_name,
  ci.foreign_table_name,
  ci.foreign_column_name
FROM table_info ti
LEFT JOIN constraints_info ci 
  ON ti.table_schema = ci.table_schema 
  AND ti.table_name = ci.table_name 
  AND ti.column_name = ci.column_name
ORDER BY ti.table_schema, ti.table_name, ti.ordinal_position;
`;

// Enforce SSL on connection string
function enforceSSL(connectionString: string): string {
  const url = new URL(connectionString);
  
  // Check if sslmode is already set
  const existingSSL = url.searchParams.get('sslmode');
  if (!existingSSL) {
    url.searchParams.set('sslmode', 'require');
    console.log("[SSL] Added sslmode=require to connection string");
  } else {
    console.log(`[SSL] Using existing sslmode=${existingSSL}`);
  }
  
  return url.toString();
}

// Split SQL statements by semicolon, respecting quoted strings
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Handle dollar-quoted strings (PostgreSQL specific)
    if (char === '$' && !inSingleQuote && !inDoubleQuote) {
      if (inDollarQuote) {
        // Check if this ends the dollar quote
        const endTag = sql.slice(i, i + dollarTag.length);
        if (endTag === dollarTag) {
          current += endTag;
          i += dollarTag.length - 1;
          inDollarQuote = false;
          dollarTag = '';
          continue;
        }
      } else {
        // Check if this starts a dollar quote
        const match = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
        if (match) {
          dollarTag = match[0];
          current += dollarTag;
          i += dollarTag.length - 1;
          inDollarQuote = true;
          continue;
        }
      }
    }
    
    // Handle single quotes
    if (char === "'" && !inDoubleQuote && !inDollarQuote) {
      // Check for escaped quote
      if (nextChar === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
    }
    
    // Handle double quotes
    if (char === '"' && !inSingleQuote && !inDollarQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
    
    // Check for semicolon outside quotes
    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Add final statement if exists
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }
  
  return statements;
}

// Parse schema results into structured format
function parseSchemaResults(rows: unknown[][]): Record<string, unknown> {
  const schemas: Record<string, {
    tables: Record<string, {
      columns: Array<{
        name: string;
        dataType: string;
        udtName: string;
        isNullable: boolean;
        default: string | null;
        maxLength: number | null;
        precision: number | null;
        constraints: Array<{
          type: string;
          name: string;
          foreignTable?: string;
          foreignColumn?: string;
        }>;
      }>;
      constraints: Array<{
        type: string;
        name: string;
        column: string;
        foreignTable?: string;
        foreignColumn?: string;
      }>;
    }>;
  }> = {};
  
  for (const row of rows) {
    const [
      schemaName, tableName, columnName, _ordinalPosition,
      dataType, udtName, isNullable, columnDefault, maxLength, precision,
      constraintType, constraintName, foreignTable, foreignColumn
    ] = row as [string, string, string, number, string, string, string, string | null, number | null, number | null, string | null, string | null, string | null, string | null];
    
    // Initialize schema
    if (!schemas[schemaName]) {
      schemas[schemaName] = { tables: {} };
    }
    
    // Initialize table
    if (!schemas[schemaName].tables[tableName]) {
      schemas[schemaName].tables[tableName] = { columns: [], constraints: [] };
    }
    
    const table = schemas[schemaName].tables[tableName];
    
    // Find or add column
    let column = table.columns.find(c => c.name === columnName);
    if (!column) {
      column = {
        name: columnName,
        dataType: dataType,
        udtName: udtName,
        isNullable: isNullable === 'YES',
        default: columnDefault,
        maxLength: maxLength,
        precision: precision,
        constraints: []
      };
      table.columns.push(column);
    }
    
    // Add constraint if present
    if (constraintType && constraintName) {
      const constraint = {
        type: constraintType,
        name: constraintName,
        foreignTable: foreignTable || undefined,
        foreignColumn: foreignColumn || undefined
      };
      
      // Add to column constraints (avoiding duplicates)
      if (!column.constraints.find(c => c.name === constraintName)) {
        column.constraints.push(constraint);
      }
      
      // Add to table constraints (avoiding duplicates)
      if (!table.constraints.find(c => c.name === constraintName && c.column === columnName)) {
        table.constraints.push({
          ...constraint,
          column: columnName
        });
      }
    }
  }
  
  return schemas;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody: ExternalDbRequest = await req.json();
    const { 
      connectionString, 
      action = "query", 
      query, 
      isWrite = false, 
      params = [],
      schemas: schemaFilter 
    } = requestBody;

    if (!connectionString) {
      throw new Error("connectionString is required");
    }

    // Enforce SSL for security
    const secureConnectionString = enforceSSL(connectionString);
    
    // Log sanitized connection info (hide password)
    const sanitizedUrl = new URL(secureConnectionString);
    sanitizedUrl.password = '***';
    console.log(`[External DB] Connecting to: ${sanitizedUrl.toString()}`);
    console.log(`[External DB] Action: ${action}`);

    const client = new Client(secureConnectionString);
    await client.connect();

    try {
      // Handle schema introspection
      if (action === "schemas") {
        console.log("[External DB] Executing schema introspection");
        
        const result = await client.queryArray(SCHEMA_INTROSPECTION_QUERY);
        const parsedSchemas = parseSchemaResults(result.rows);
        
        // Apply schema filter if provided
        let filteredSchemas = parsedSchemas;
        if (schemaFilter && schemaFilter.length > 0) {
          filteredSchemas = {};
          for (const schemaName of schemaFilter) {
            if (parsedSchemas[schemaName]) {
              filteredSchemas[schemaName] = parsedSchemas[schemaName];
            }
          }
        }
        
        // Calculate statistics
        let totalTables = 0;
        let totalColumns = 0;
        for (const schema of Object.values(filteredSchemas) as Array<{ tables: Record<string, { columns: unknown[] }> }>) {
          for (const table of Object.values(schema.tables)) {
            totalTables++;
            totalColumns += table.columns.length;
          }
        }
        
        console.log(`[External DB] Found ${totalTables} tables, ${totalColumns} columns across ${Object.keys(filteredSchemas).length} schemas`);
        
        return new Response(
          JSON.stringify({
            success: true,
            action: "schemas",
            schemas: filteredSchemas,
            totalSchemas: Object.keys(filteredSchemas).length,
            totalTables,
            totalColumns,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle query execution
      if (!query) {
        throw new Error("query is required for action='query'");
      }

      // Split into multiple statements
      const statements = splitStatements(query);
      console.log(`[External DB] Executing ${statements.length} statement(s), isWrite: ${isWrite}`);
      
      if (statements.length === 0) {
        throw new Error("No valid SQL statements found");
      }

      // Execute statements sequentially
      const results: Array<{
        statement: string;
        success: boolean;
        columns?: string[];
        rows?: Record<string, unknown>[];
        rowCount?: number | null;
        command?: string;
        error?: string;
      }> = [];

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        console.log(`[External DB] Statement ${i + 1}/${statements.length}: ${stmt.slice(0, 100)}...`);
        
        try {
          const result = await client.queryArray(stmt, params);
          
          if (isWrite || !result.rowDescription) {
            // Write operation or no result set
            results.push({
              statement: stmt.slice(0, 200) + (stmt.length > 200 ? '...' : ''),
              success: true,
              rowCount: result.rowCount,
              command: result.command,
            });
          } else {
            // Read operation with results
            const columns = result.rowDescription?.columns?.map(c => c.name) || [];
            const rows = result.rows.map(row => {
              const obj: Record<string, unknown> = {};
              row.forEach((value, idx) => {
                obj[columns[idx] || `col_${idx}`] = value;
              });
              return obj;
            });

            results.push({
              statement: stmt.slice(0, 200) + (stmt.length > 200 ? '...' : ''),
              success: true,
              columns,
              rows,
              rowCount: result.rowCount,
            });
          }
        } catch (stmtError) {
          console.error(`[External DB] Statement ${i + 1} failed:`, stmtError);
          results.push({
            statement: stmt.slice(0, 200) + (stmt.length > 200 ? '...' : ''),
            success: false,
            error: stmtError instanceof Error ? stmtError.message : "Statement execution failed",
          });
          // Continue with remaining statements (don't abort on single failure)
        }
      }

      // Determine overall success
      const allSucceeded = results.every(r => r.success);
      const someSucceeded = results.some(r => r.success);
      
      // For single statement, return simplified response
      if (statements.length === 1) {
        const result = results[0];
        return new Response(
          JSON.stringify({
            success: result.success,
            action: "query",
            columns: result.columns,
            rows: result.rows,
            rowCount: result.rowCount,
            command: result.command,
            error: result.error,
          }),
          { 
            status: result.success ? 200 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // For multiple statements, return detailed results
      return new Response(
        JSON.stringify({
          success: allSucceeded,
          partialSuccess: !allSucceeded && someSucceeded,
          action: "query",
          statementCount: statements.length,
          results,
          summary: {
            total: statements.length,
            succeeded: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
          },
        }),
        { 
          status: allSucceeded ? 200 : (someSucceeded ? 207 : 500),
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error("[External DB] Error:", error);
    
    // Provide more specific error messages
    let errorMessage = "Database operation failed";
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle common Postgres errors with helpful messages
      if (error.message.includes("connection refused")) {
        errorMessage = "Connection refused - check host/port and ensure database is accessible";
      } else if (error.message.includes("password authentication failed")) {
        errorMessage = "Authentication failed - check username and password";
      } else if (error.message.includes("does not exist")) {
        errorMessage = error.message; // Keep original for clarity
      } else if (error.message.includes("SSL")) {
        errorMessage = "SSL connection failed - database may not support SSL or certificate issue";
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
