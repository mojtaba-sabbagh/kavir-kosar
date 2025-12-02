'use server';

import { prisma } from '@/lib/db';
import OpenAI from 'openai';

interface GenerateReportParams {
  requirement: string; // Farsi natural language requirement
  userId: string;
  formId?: string; // Optional: restrict to specific form
}

interface GeneratedReport {
  success: boolean;
  sql?: string;
  results?: Record<string, any>[];
  rowCount?: number;
  columns?: string[];
  error?: string;
  executionTime?: number;
}

// Initialize OpenAI-compatible client for Avalai
const openai = new OpenAI({
  apiKey: process.env.AVALAI_API_KEY,
  baseURL: 'https://api.avalai.ir/v1',
});

/**
 * Get database schema in a format suitable for LLM prompt
 */
async function getDatabaseSchema(formId?: string) {
  const forms = formId
    ? await prisma.form.findMany({
        where: { id: formId },
        include: { fields: true },
      })
    : await prisma.form.findMany({
        include: { fields: true },
      });

  const schemaDescription = forms
    .map((form) => {
      const fields = form.fields
        .map(
          (f) =>
            `  - ${f.key} (${f.type})${f.required ? ' [required]' : ''}${f.labelFa ? ` // ${f.labelFa}` : ''}`
        )
        .join('\n');

      return `
**Form: ${form.titleFa} (code: ${form.code})**
- Table: FormEntry with payload JSON field
- Status: ${form.isActive ? 'active' : 'inactive'}
- Fields:
${fields}
`;
    })
    .join('\n');

  return `
# Database Schema for Report Generation

## FormEntry Table
- id: UUID (primary key)
- formId: UUID (foreign key to Form)
- createdBy: UUID (user ID)
- createdAt: DateTime
- updatedAt: DateTime
- payload: JSON (form answers, field values stored as JSON object)
- status: Enum(draft, submitted, confirmed, finalConfirmed)
- finalConfirmedAt: DateTime (nullable)
- finalConfirmedById: UUID (nullable, user who gave final confirmation)

## Available Forms and Fields
${schemaDescription}

## Important Notes
- All form field values are stored in the FormEntry.payload JSON field
- Use JSON operators to access payload fields: payload->>'fieldKey' for text, payload->'fieldKey' for JSON
- Date fields are stored as strings in ISO format (YYYY-MM-DD or ISO-8601)
- Numbers are stored as JSON numbers or strings
- Multi-select and array fields are stored as JSON arrays
`;
}

/**
 * Create LLM prompt for SQL generation
 */
function createPrompt(requirement: string, schema: string): string {
  return `You are an expert PostgreSQL developer who understands Farsi requirements and database schemas. Your task is to convert a Farsi natural language requirement into a valid PostgreSQL SELECT query.

${schema}

## Instructions
1. The user's requirement is in Farsi. Understand what data they want.
2. Generate a PostgreSQL SELECT query that extracts the required data from FormEntry and related tables.
3. Use JSON operators to access payload fields: 
   - payload->>'fieldKey' returns text/string values
   - payload->'fieldKey'::numeric returns numeric values
   - payload->>'fieldKey'::date returns dates
4. Always use parameterized queries (use $1, $2, etc. for any literal values that should be parameterized)
5. Include comments in the query explaining each part
6. The query MUST start with SELECT and MUST be a read-only query
7. Return ONLY the SQL query wrapped in \`\`\`sql ... \`\`\` blocks, with no other text

User's requirement (in Farsi):
"${requirement}"

Generated PostgreSQL SQL:
\`\`\`sql
`;
}

/**
 * Extract SQL from LLM response
 */
function extractSql(response: string): string | null {
  const match = response.match(/\`\`\`sql\s*([\s\S]*?)\s*\`\`\`/);
  return match ? match[1].trim() : null;
}

/**
 * Validate SQL query for safety
 */
function validateSql(sql: string): { valid: boolean; error?: string } {
  // Dangerous keywords that should not appear in SELECT queries
  const dangerousKeywords = [
    'DROP',
    'DELETE',
    'UPDATE',
    'INSERT',
    'ALTER',
    'CREATE',
    'TRUNCATE',
    'EXEC',
    'EXECUTE',
    'PRAGMA',
    '--',
    '/*',
    '*/',
  ];

  const upperSql = sql.toUpperCase();

  for (const keyword of dangerousKeywords) {
    if (upperSql.includes(keyword)) {
      return { valid: false, error: `Query contains forbidden keyword: ${keyword}` };
    }
  }

  // Ensure query starts with SELECT
  if (!upperSql.trim().startsWith('SELECT')) {
    return { valid: false, error: 'Query must start with SELECT' };
  }

  // Check for comment injection attempts
  if (sql.includes('--') || sql.includes('/*')) {
    return { valid: false, error: 'Comments not allowed in generated queries' };
  }

  return { valid: true };
}

/**
 * Generate a report from a Farsi requirement using LLM
 */
export async function generateReportFromRequirement(
  params: GenerateReportParams
): Promise<GeneratedReport> {
  try {
    const startTime = Date.now();

    // 1. Get schema context
    const schema = await getDatabaseSchema(params.formId);

    // 2. Create prompt for LLM
    const prompt = createPrompt(params.requirement, schema);

    // 3. Call Avalai (OpenAI-compatible) API
    const message = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // 4. Extract SQL from response
    const responseText = message.choices[0].message.content || '';
    const generatedSql = extractSql(responseText);

    if (!generatedSql) {
      return {
        success: false,
        error: 'Failed to extract SQL from LLM response',
      };
    }

    // 5. Validate SQL for safety
    const validation = validateSql(generatedSql);
    if (!validation.valid) {
      return {
        success: false,
        error: `SQL validation failed: ${validation.error}`,
        sql: generatedSql,
      };
    }

    // 6. Execute the query
    let results: Record<string, any>[] = [];
    try {
      // Use raw query with parameterized safety
      results = await prisma.$queryRawUnsafe(generatedSql);

      // Limit results to prevent memory issues
      const maxRows = parseInt(process.env.AI_REPORT_MAX_ROWS || '10000', 10);
      if (results.length > maxRows) {
        results = results.slice(0, maxRows);
      }
    } catch (dbError: any) {
      return {
        success: false,
        error: `Database execution error: ${dbError.message}`,
        sql: generatedSql,
      };
    }

    // 7. Extract column names from first result
    const columns = results.length > 0 ? Object.keys(results[0]) : [];

    // 8. Save the successful query
    try {
      await prisma.aIGeneratedReport.create({
        data: {
          userId: params.userId,
          requirement: params.requirement,
          generatedSql,
          resultCount: results.length,
          formId: params.formId,
          lastExecutedAt: new Date(),
        },
      });
    } catch (saveError) {
      console.error('Failed to save generated report:', saveError);
      // Don't fail the whole operation if saving fails
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      sql: generatedSql,
      results,
      rowCount: results.length,
      columns,
      executionTime,
    };
  } catch (error: any) {
    console.error('Report generation error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during report generation',
    };
  }
}

/**
 * Get user's saved reports
 */
export async function getSavedReports(userId: string, limit = 20) {
  return await prisma.aIGeneratedReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      requirement: true,
      resultCount: true,
      lastExecutedAt: true,
      createdAt: true,
      formId: true,
    },
  });
}

/**
 * Get a saved report by ID
 */
export async function getSavedReport(id: string, userId: string) {
  return await prisma.aIGeneratedReport.findUnique({
    where: { id, userId },
  });
}

/**
 * Re-execute a saved report
 */
export async function reExecuteSavedReport(id: string, userId: string): Promise<GeneratedReport> {
  const report = await getSavedReport(id, userId);
  if (!report) {
    return {
      success: false,
      error: 'Report not found',
    };
  }

  try {
    const results = (await prisma.$queryRawUnsafe(report.generatedSql)) as Record<string, any>[];
    const columns = results.length > 0 ? Object.keys(results[0]) : [];

    // Update last executed time
    await prisma.aIGeneratedReport.update({
      where: { id },
      data: { lastExecutedAt: new Date(), resultCount: results.length },
    });

    return {
      success: true,
      sql: report.generatedSql,
      results,
      rowCount: results.length,
      columns,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Execution error: ${error.message}`,
      sql: report.generatedSql,
    };
  }
}
