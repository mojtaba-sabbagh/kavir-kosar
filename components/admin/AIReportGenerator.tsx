'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
interface ReportResult {
  success: boolean;
  sql?: string;
  columns?: string[];
  results?: Record<string, any>[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
}

interface SavedReport {
  id: string;
  requirement: string;
  resultCount: number;
  lastExecutedAt: string;
  createdAt: string;
}

export default function AIReportGenerator() {
  const [requirement, setRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Load saved reports on mount
  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    try {
      const response = await fetch('/api/reports/ai-generate');
      const data = await response.json();
      if (data.success) {
        setSavedReports(data.reports);
      }
    } catch (error) {
      console.error('Error loading saved reports:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (!requirement.trim()) {
      alert('لطفا شرط گزارش را وارد کنید');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/reports/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        loadSavedReports(); // Refresh history
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setResult({
        success: false,
        error: 'خطا در ایجاد گزارش',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReExecuteReport = async (reportId: string) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/reports/ai-generate?action=reexecute&reportId=${reportId}`
      );
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error re-executing report:', error);
      setResult({
        success: false,
        error: 'خطا در اجرای گزارش',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!result?.results || !result.columns) return;

    // Create CSV content
    const csvContent = [
      result.columns.join(','),
      ...result.results.map((row) =>
        result.columns!.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(','))
            return `"${value}"`;
          return value;
        }).join(',')
      ),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          تولیدکننده گزارش هوشمند
        </h1>
        <p className="text-gray-600">
          نیازمندی خود را به فارسی بنویسید و سیستم به طور خودکار گزارش را تولید میکند
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Input Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Input Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              شرط گزارش (به فارسی)
            </label>
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="مثال: تمام ثبت‌نام‌های ماه اخیر را نشان بده، با تعداد و جمع مبلغ برای هر فرم"
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={loading}
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleGenerateReport}
                disabled={loading || !requirement.trim()}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'درحال تولید...' : 'تولید گزارش'}
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                تاریخ ({savedReports.length})
              </button>
            </div>
          </div>

          {/* Results Section */}
          {result && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              {result.success ? (
                <div className="space-y-4">
                  {/* Success Message */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-700 font-medium">
                      ✓ گزارش با موفقیت تولید شد ({result.rowCount} سطر)
                    </p>
                    {result.executionTime && (
                      <p className="text-sm text-green-600 mt-1">
                        زمان اجرا: {result.executionTime}ms
                      </p>
                    )}
                  </div>

                  {/* SQL Display */}
                  {result.sql && (
                    <details className="border border-gray-200 rounded-lg">
                      <summary className="p-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50">
                        SQL Generated
                      </summary>
                      <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-xs rounded-b-lg">
                        {result.sql}
                      </pre>
                    </details>
                  )}

                  {/* Export Button */}
                  {result.results && result.results.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      دانلود CSV
                    </button>
                  )}

                  {/* Results Table */}
                  {result.results && result.results.length > 0 && (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {result.columns?.map((col) => (
                              <th
                                key={col}
                                className="px-4 py-2 text-right text-gray-700 font-medium whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {result.results.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              {result.columns?.map((col) => (
                                <td
                                  key={`${idx}-${col}`}
                                  className="px-4 py-2 text-gray-700"
                                >
                                  {formatCellValue(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {result.rowCount! > 50 && (
                        <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
                          نمایش ۵۰ سطر از {result.rowCount}
                        </div>
                      )}
                    </div>
                  )}

                  {result.results && result.results.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      نتیجه‌ای یافت نشد
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 font-medium">خطا:</p>
                    <p className="text-red-600 mt-1">{result.error}</p>
                  </div>
                  {result.sql && (
                    <details className="border border-red-200 rounded-lg">
                      <summary className="p-3 cursor-pointer font-medium text-red-700 hover:bg-red-50">
                        SQL تولید شده (برای بررسی)
                      </summary>
                      <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-xs rounded-b-lg">
                        {result.sql}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - History */}
        {showHistory && (
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="font-bold text-gray-900 mb-4">گزارش‌های ذخیره شده</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedReports.length === 0 ? (
                <p className="text-gray-500 text-sm">گزارشی ذخیره نشده</p>
              ) : (
                savedReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      handleReExecuteReport(report.id);
                      setShowHistory(false);
                    }}
                    className="w-full text-right p-2 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors text-sm"
                  >
                    <p className="font-medium text-gray-700 line-clamp-2">
                      {report.requirement}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {report.resultCount} سطر
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(
                        new Date(report.lastExecutedAt),
                        'dd/MM HH:mm'
                      )}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format cell values for display
 */
function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(2);
  }
  return String(value);
}
