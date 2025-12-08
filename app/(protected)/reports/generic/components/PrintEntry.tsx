// app/(protected)/reports/generic/components/PrintEntry.tsx
'use client';
import { useRef, useEffect, useState } from 'react';
import { formatJalali } from '@/lib/date-utils';
import { boolFa } from '@/lib/utils';

interface SubformSchema {
  key: string;
  labelFa?: string;
  type: string;
  config?: any;
}

interface SubformData {
  schema: SubformSchema[];
  displayMaps: Record<string, Record<string, string>>;
  data: any[];
}

interface PrintEntryProps {
  entry: any;
  schema: any[];
  labels: Record<string, string>;
  displayMaps?: Record<string, Record<string, string>>;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintEntry({
  entry,
  schema,
  labels,
  displayMaps = {},
  isOpen,
  onClose
}: PrintEntryProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [subformData, setSubformData] = useState<Record<string, SubformData>>({});
  const [CustomPrintComponent, setCustomPrintComponent] = useState<React.ComponentType<any> | null>(null);

  if (!isOpen || !entry) return null;

  // Fetch form title, subform data, and check for custom print template when component opens
  useEffect(() => {
    const fetchFormData = async () => {
      if (!entry?.id) return;
      setLoading(true);
      try {
        // Fetch entry summary which includes form title
        const summaryResponse = await fetch(`/api/entries/${entry.id}/summary`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          if (summaryData?.formTitle) {
            setFormTitle(summaryData.formTitle);
          } else if (summaryData?.form?.titleFa) {
            setFormTitle(summaryData.form.titleFa);
          }

          // Load custom print template if available (based on form code)
          const formCode = summaryData.formCode; // Updated based on API response structure
          if (formCode) {
            try {
              const module = await import(`@/components/print-templates/${formCode}.tsx`);
              setCustomPrintComponent(() => module.default);
            } catch (error) {
              console.error(`No custom print template found for form code "${formCode}"`, error);
              setCustomPrintComponent(null);
            }
          }
        }

        // Fetch subform schemas and data (unchanged)
        const subformFields = schema.filter(field => field.type === 'subform');
        const subformPromises = subformFields.map(async (field) => {
          const subformCode = field.config?.subformCode;
          const fieldData = entry.payload?.[field.key];
          if (!subformCode || !Array.isArray(fieldData) || fieldData.length === 0) {
            return null;
          }
          try {
            // Fetch subform schema
            const schemaResponse = await fetch(
              `/api/forms/by-code/${encodeURIComponent(subformCode)}?include=fields`,
              { cache: 'no-store', credentials: 'include' }
            );
            if (!schemaResponse.ok) {
              console.error(`Failed to fetch schema for subform ${subformCode}`);
              return null;
            }
            const result = await schemaResponse.json();
            const subformSchema = result.form?.fields || [];
            // Process subform schema for display
            const processedSchema = subformSchema.map((f: any) => ({
              key: f.key,
              labelFa: f.labelFa || f.key,
              type: f.type,
              config: f.config || {}
            }));
            // Fetch display maps for tableSelect and kardexItem fields
            const displayMaps: Record<string, Record<string, string>> = {};
            // Process tableSelect fields
            const tableSelectFields = processedSchema.filter((f: any) => f.type === 'tableSelect');
            for (const subField of tableSelectFields) {
              const table = subField.config?.tableSelect?.table;
              const type = subField.config?.tableSelect?.type;
              if (!table) continue;
              // Collect unique values
              const uniqueValues = new Set<string>();
              fieldData.forEach((row: any) => {
                const value = row[subField.key];
                if (value && value !== '') {
                  uniqueValues.add(String(value));
                }
              });
              if (uniqueValues.size === 0) continue;
              try {
                const url = new URL('/api/table-select/items', window.location.origin);
                url.searchParams.set('table', table);
                if (type) url.searchParams.set('type', type);
                const response = await fetch(url.toString(), {
                  cache: 'no-store',
                  credentials: 'include'
                });
                if (response.ok) {
                  const result = await response.json();
                  if (result.ok && Array.isArray(result.items)) {
                    const itemLookup: Record<string, string> = {};
                    result.items.forEach((item: any) => {
                      if (item.code && item.title) {
                        itemLookup[item.code] = item.title;
                      }
                    });
                    displayMaps[subField.key] = itemLookup;
                  }
                }
              } catch (error) {
                console.error(`Error fetching table select items for ${subField.key}:`, error);
              }
            }
            // Process kardexItem fields
            const kardexFields = processedSchema.filter((f: any) => f.type === 'kardexItem');
            for (const subField of kardexFields) {
              // Collect unique values
              const uniqueValues = new Set<string>();
              fieldData.forEach((row: any) => {
                const value = row[subField.key];
                if (value && value !== '') {
                  uniqueValues.add(String(value));
                }
              });
              if (uniqueValues.size === 0) continue;
              try {
                const codes = Array.from(uniqueValues).join(',');
                const response = await fetch(`/api/kardex/items?codes=${encodeURIComponent(codes)}`, {
                  cache: 'no-store',
                  credentials: 'include'
                });
                if (response.ok) {
                  const result = await response.json();
                  if (result.ok && Array.isArray(result.items)) {
                    const itemLookup: Record<string, string> = {};
                    result.items.forEach((item: any) => {
                      if (item.code && item.nameFa) {
                        itemLookup[item.code] = item.nameFa;
                      }
                    });
                    displayMaps[subField.key] = itemLookup;
                  }
                }
              } catch (error) {
                console.error(`Error fetching kardex items for ${subField.key}:`, error);
              }
            }
            return {
              key: field.key,
              data: {
                schema: processedSchema,
                displayMaps,
                data: fieldData
              }
            };
          } catch (error) {
            console.error(`Error processing subform ${field.key}:`, error);
            return null;
          }
        });
        // Wait for all subform data to be fetched
        const subformResults = await Promise.all(subformPromises);
        const subformDataMap: Record<string, SubformData> = {};
        subformResults.forEach(result => {
          if (result) {
            subformDataMap[result.key] = result.data;
          }
        });
        setSubformData(subformDataMap);
      } catch (error) {
        console.error('Failed to fetch form data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFormData();
  }, [entry?.id, schema]);

  // Helper function to convert English digits to Persian
  const toPersianDigits = (str: string): string => {
    if (!str) return str;
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.replace(/\d/g, (digit) => {
      const num = parseInt(digit, 10);
      return (num >= 0 && num <= 9) ? persianDigits[num] : digit;
    });
  };

  // Helper function to render value for print with Persian digits
  const renderValue = (field: any, value: any, customDisplayMaps?: Record<string, Record<string, string>>): string => {
    if (value == null || value === '') return '-';
    const t = field.type;
    const valueStr = String(value);
    // Handle different field types
    switch (t) {
      case 'checkbox':
      case 'boolean':
        return boolFa(value);
      case 'date':
        return value ? toPersianDigits(formatJalali(value, false)) : '';
      case 'datetime':
        return value ? toPersianDigits(formatJalali(value, true)) : '';
      case 'number':
        // Convert to Persian digits
        return toPersianDigits(valueStr);
      case 'select':
        const selectOptions = field.config?.options || [];
        const selectedOption = selectOptions.find((opt: any) => String(opt.value) === valueStr);
        return selectedOption?.label || toPersianDigits(valueStr);
      case 'multiselect':
        if (Array.isArray(value)) {
          const multiOptions = field.config?.options || [];
          return toPersianDigits(value.map(v => {
            const option = multiOptions.find((opt: any) => String(opt.value) === String(v));
            return option?.label || String(v);
          }).join('، '));
        }
        return toPersianDigits(valueStr);
      case 'tableSelect':
      case 'kardexItem':
        const maps = customDisplayMaps || displayMaps;
        const label = maps?.[field.key]?.[valueStr];
        return label ? label : toPersianDigits(valueStr);
      case 'subform':
        if (Array.isArray(value)) {
          return toPersianDigits(`${value.length} مورد`);
        }
        return toPersianDigits(valueStr);
      case 'entryRef':
        return toPersianDigits(valueStr);
      case 'entryRefMulti':
        if (Array.isArray(value)) {
          return toPersianDigits(value.join('، '));
        }
        return toPersianDigits(valueStr);
      default:
        return toPersianDigits(valueStr);
    }
  };

  // Function to format row numbers in Persian
  const persianRowNumber = (num: number): string => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().split('').map(digit => persianDigits[parseInt(digit)]).join('');
  };

  // Separate main form items from subforms
  const mainFields = schema.filter(field => field.type !== 'subform');
  const subformFields = schema.filter(field => field.type === 'subform');

  // Get date field from schema
  const dateField = schema.find(field => field.type === 'date' || field.type === 'datetime');

  // Get date value for display
  const getDateValue = () => {
    if (dateField) {
      const value = entry.payload?.[dateField.key];
      if (value) {
        return renderValue(dateField, value);
      }
    }
    return toPersianDigits(formatJalali(entry.createdAt, true));
  };

  // Handle print
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('لطفا اجازه باز کردن پنجره جدید را بدهید');
      return;
    }
    const content = printRef.current.innerHTML;
    const title = formTitle || 'فرم';
    const dateValue = getDateValue();
    // Get the base URL for the font files
    const baseUrl = window.location.origin;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  IRYekan: ['IRYekan', 'sans-serif']
                }
              }
            }
          }
        </script>
        <style>
          @font-face {
            font-family: 'IRYekan';
            src: url('${baseUrl}/fonts/Yekan.woff') format('woff'),
                 url('${baseUrl}/fonts/Yekan.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          @page {
            size: A4;
            margin: 0 !important;
          }
          @media screen {
            .page-content {
              display: none;
            }
          }
        </style>
      </head>
      <body class="print:font-IRYekan print:text-base print:leading-loose print:text-black print:dir-rtl print:m-0 print:p-0">
        <div class="page-content print:w-full print:h-full print:relative print:box-border">
          <!-- محتوای اصلی -->
          <div class="main-content print:p-[4cm_2cm_2cm_3cm] print:m-0 print:box-border">
            ${content}
          </div>
        </div>
        <script>
          window.onload = function() {
            // Add a small delay to ensure fonts are loaded
            setTimeout(() => {
              window.print();
              setTimeout(() => {
                window.close();
              }, 500);
            }, 100);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Categorize fields for two-column layout (used in default rendering)
  const categorizeFields = () => {
    const textFields: any[] = [];
    const otherFields: any[] = [];
    mainFields.forEach(field => {
      // Skip the date field since it's displayed separately
      if (dateField && field.key === dateField.key) return;
      if (field.type === 'text' || field.type === 'textarea' || field.type === 'longText') {
        textFields.push(field);
      } else {
        otherFields.push(field);
      }
    });
    return { textFields, otherFields };
  };
  const { textFields, otherFields } = categorizeFields();

  return (
    <>
      {/* Modal for print preview */}
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className="w-full max-w-4xl rounded-xl bg-white shadow-lg border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold">چاپ فرم</h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'در حال آماده‌سازی...' : 'چاپ'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  بستن
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto max-h-[80vh]">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">در حال بارگذاری اطلاعات فرم...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Print preview - using different class names for print */}
                  <div
                    ref={printRef}
                    dir="rtl"
                    className="bg-white border persian-digits print-content w-[210mm] min-h-[297mm] mx-auto shadow-lg p-5 font-IRYekan"
                  >
                    {/* Date container - will be positioned by CSS in print */}
                    <div className="date-container-print no-print hidden">
                      <div className="persian-digits">
                        {getDateValue()}
                      </div>
                    </div>

                    {CustomPrintComponent ? (
                      <CustomPrintComponent
                        entry={entry}
                        schema={schema}
                        labels={labels}
                        displayMaps={displayMaps}
                        subformData={subformData}
                        formTitle={formTitle}
                        renderValue={renderValue}
                        toPersianDigits={toPersianDigits}
                        persianRowNumber={persianRowNumber}
                        getDateValue={getDateValue}
                        // Add more props as needed for custom templates
                      />
                    ) : (
                      <>
                        {/* Default rendering */}
                        {/* Form title */}
                        <h1 className="form-title-print text-center text-[16pt] font-bold m-0 mb-[25px] font-IRYekan">
                          {formTitle || 'فرم'}
                        </h1>
                        {/* Two-column layout for non-text fields */}
                        {otherFields.length > 0 && (
                          <div className="two-column-layout-print grid grid-cols-2 gap-x-[30px] gap-y-[20px] mb-[25px] font-IRYekan">
                            {otherFields.map((field) => {
                              const value = entry.payload?.[field.key];
                              const label = labels[field.key] || field.key;
                              return (
                                <div key={field.key} className="field-item-print break-inside-avoid font-IRYekan">
                                  <div className="field-label-print font-bold mb-[5px] text-[#333] font-IRYekan">
                                    {label}
                                  </div>
                                  <div className="field-value-print persian-digits p-[5px] border-b border-[#ddd] min-h-[25px] font-IRYekan">
                                    {renderValue(field, value)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Full-width text fields */}
                        {textFields.length > 0 && (
                          <div className="full-width-fields-print mb-[25px] font-IRYekan">
                            {textFields.map((field) => {
                              const value = entry.payload?.[field.key];
                              const label = labels[field.key] || field.key;
                              return (
                                <div key={field.key} className="full-width-field-print mb-[15px] font-IRYekan">
                                  <div className="field-label-print font-bold mb-[5px] text-[#333] font-IRYekan">
                                    {label}
                                  </div>
                                  <div className="field-value-print persian-digits p-[5px] border-b border-[#ddd] min-h-[25px] font-IRYekan">
                                    {renderValue(field, value)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Subforms as tables */}
                        {subformFields.map((field) => {
                          const subformInfo = subformData[field.key];
                          const label = labels[field.key] || field.key;
                          if (!subformInfo || !Array.isArray(subformInfo.data) || subformInfo.data.length === 0) {
                            return null;
                          }
                          const subformSchema = subformInfo.schema || [];
                          const subformKeys = subformSchema.length > 0
                            ? subformSchema.map((f: any) => f.key)
                            : (subformInfo.data[0] ? Object.keys(subformInfo.data[0]) : []);
                          return (
                            <div key={field.key} className="subform-section-print mt-[30px] break-inside-avoid font-IRYekan">
                              <h2 className="subform-title-print text-[13pt] font-bold mb-[15px] pb-[8px] border-b-2 border-[#333] font-IRYekan">
                                {label}
                              </h2>
                              <table className="subform-table-print persian-digits w-full border-collapse my-[10px] text-[9.5pt] font-IRYekan">
                                <thead>
                                  <tr>
                                    <th className="row-counter-print text-center w-[50px] bg-[#f8f8f8] border border-[#ccc] p-2 font-IRYekan">
                                      ردیف
                                    </th>
                                    {subformKeys.map((key) => {
                                      const subField = subformSchema.find((f: any) => f.key === key);
                                      const subLabel = subField?.labelFa || key;
                                      return (
                                        <th key={key} className="bg-[#f8f8f8] border border-[#ccc] p-2 text-center font-bold font-IRYekan">
                                          {subLabel}
                                        </th>
                                      );
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  {subformInfo.data.map((item: any, index: number) => (
                                    <tr key={index}>
                                      <td className="row-counter-print text-center w-[50px] border border-[#ccc] p-2 font-IRYekan">
                                        {persianRowNumber(index + 1)}
                                      </td>
                                      {subformKeys.map((key) => {
                                        const subField = subformSchema.find((f: any) => f.key === key) || { type: 'text', key };
                                        const value = item[key];
                                        return (
                                          <td key={key} className="persian-digits border border-[#ccc] p-2 text-right font-IRYekan">
                                            {renderValue(subField, value, subformInfo.displayMaps)}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}