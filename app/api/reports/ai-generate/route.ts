import { getSession } from '@/lib/auth';
import { generateReportFromRequirement, getSavedReports, reExecuteSavedReport } from '@/lib/ai-report-generator';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Convert BigInt values to strings for JSON serialization
 */
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(convertBigIntToString);
    }
    
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }
  
  return obj;
}

/**
 * POST /api/reports/ai-generate
 * Generate a report from a Farsi natural language requirement
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check user permission for report:ai-generate
    // if (!await checkPermission(user.id, 'report:ai-generate')) {
    //   return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    // }

    const body = await request.json();
    const { requirement, formId } = body;

    if (!requirement || typeof requirement !== 'string') {
      return NextResponse.json(
        { error: 'Requirement is required and must be a string' },
        { status: 400 }
      );
    }

    // Rate limiting (simple in-memory check, can be improved with Redis)
    // TODO: Implement proper rate limiting
    const result = await generateReportFromRequirement({
      requirement,
      userId: user.id,
      formId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          sql: result.sql, // Include generated SQL for debugging
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      sql: result.sql,
      columns: result.columns,
      results: convertBigIntToString(result.results),
      rowCount: result.rowCount,
      executionTime: result.executionTime,
    });
  } catch (error: any) {
    console.error('AI report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/ai-generate
 * Get user's saved reports
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const reportId = searchParams.get('reportId');

    // Re-execute a saved report
    if (action === 'reexecute' && reportId) {
      const result = await reExecuteSavedReport(reportId, user.id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        columns: result.columns,
        results: result.results,
        rowCount: result.rowCount,
        sql: result.sql,
      });
    }

    // Get saved reports history
    const reports = await getSavedReports(user.id);
    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports', message: error.message },
      { status: 500 }
    );
  }
}
