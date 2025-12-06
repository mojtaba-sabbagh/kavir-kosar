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

  if (!isOpen || !entry) return null;

  // Fetch form title and subform data when component opens
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
        }

        // Fetch subform schemas and data
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
        <style>
          @font-face {
            font-family: 'IRYekan';
            src: url('${baseUrl}/fonts/Yekan.woff') format('woff'),
                url('${baseUrl}/fonts/Yekan.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }

          /* حاشیه صفحه را صفر می‌کنیم تا کنترل کامل داشته باشیم */
          @page {
            size: A4;
            margin: 0 !important;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
              font-family: 'IRYekan', sans-serif !important;
              font-size: 11pt;
              line-height: 1.6;
              color: #000;
              direction: rtl;
            }

            /* کانتینر اصلی */
            .page-content {
              width: 100%;
              height: 100%;
              position: relative;
              box-sizing: border-box;
            }

           .print-date {
            position: fixed;
            top: 1cm !important;
            left: 1cm !important;
            font-size: 10pt !important;
            font-family: 'IRYekan', sans-serif !important;
            z-index: 9999 !important;
            direction: ltr !important; /* چپ به راست برای تاریخ */
            text-align: left !important;
            margin: 0 !important;
            padding: 0 !important;
          }

            /* محتوای اصلی - حاشیه‌ها را با padding شبیه‌سازی می‌کنیم */
            .main-content {
              padding: 4cm 2cm 2cm 3cm !important;
              margin: 0;
              box-sizing: border-box;
            }

            /* بقیه استایل‌ها بدون تغییر */
            .form-title-print {
              text-align: center;
              font-size: 16pt;
              font-weight: bold;
              margin: 0 0 30px 0;
              font-family: 'IRYekan', sans-serif;
            }

            .two-column-layout-print {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px 30px;
              margin-bottom: 30px;
            }

            .subform-table-print {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 9.5pt;
              page-break-inside: avoid;
            }
            .subform-table-print th,
            .subform-table-print td {
              border: 1px solid #ccc;
              padding: 8px;
              text-align: right;
            }
            .subform-table-print th {
              background-color: #f8f8f8;
              text-align: center;
              font-weight: bold;
            }
            .row-counter-print {
              width: 50px;
              text-align: center;
            }

            .persian-digits {
              font-family: 'IRYekan', sans-serif;
            }
          }

          @media screen {
            .page-content {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-content">
          <!-- تاریخ در گوشه بالا راست -->
          <div class="print-date">${dateValue}</div>

          <!-- محتوای اصلی -->
          <div class="main-content">
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

  // Categorize fields for two-column layout
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
                    className="bg-white border persian-digits print-content"
                    style={{
                      width: '210mm',
                      minHeight: '297mm',
                      margin: '0 auto',
                      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                      padding: '20px',
                      fontFamily: 'IRYekan, sans-serif'
                    }}
                  >
                    {/* Date container - will be positioned by CSS in print */}
                      <div className="date-container-print no-print" style={{ display: 'none' }}>
                        <div className="persian-digits">
                          {getDateValue()}
                        </div>
                      </div>               
                    {/* Form title */}
                    <h1 className="form-title-print" style={{ 
                      textAlign: 'center', 
                      fontSize: '16pt', 
                      fontWeight: 'bold', 
                      margin: '0 0 25px 0',
                      fontFamily: 'IRYekan, sans-serif'
                    }}>
                      {formTitle || 'فرم'}
                    </h1>
                    
                    {/* Two-column layout for non-text fields */}
                    {otherFields.length > 0 && (
                      <div className="two-column-layout-print" style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        gap: '20px 30px',
                        marginBottom: '25px',
                        fontFamily: 'IRYekan, sans-serif'
                      }}>
                        {otherFields.map((field) => {
                          const value = entry.payload?.[field.key];
                          const label = labels[field.key] || field.key;
                          
                          return (
                            <div key={field.key} className="field-item-print" style={{ 
                              breakInside: 'avoid',
                              fontFamily: 'IRYekan, sans-serif'
                            }}>
                              <div className="field-label-print" style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '5px', 
                                color: '#333',
                                fontFamily: 'IRYekan, sans-serif'
                              }}>
                                {label}
                              </div>
                              <div className="field-value-print persian-digits" style={{ 
                                padding: '5px',
                                borderBottom: '1px solid #ddd',
                                minHeight: '25px',
                                fontFamily: 'IRYekan, sans-serif'
                              }}>
                                {renderValue(field, value)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Full-width text fields */}
                    {textFields.length > 0 && (
                      <div className="full-width-fields-print" style={{ 
                        marginBottom: '25px',
                        fontFamily: 'IRYekan, sans-serif'
                      }}>
                        {textFields.map((field) => {
                          const value = entry.payload?.[field.key];
                          const label = labels[field.key] || field.key;
                          
                          return (
                            <div key={field.key} className="full-width-field-print" style={{ 
                              marginBottom: '15px',
                              fontFamily: 'IRYekan, sans-serif'
                            }}>
                              <div className="field-label-print" style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '5px', 
                                color: '#333',
                                fontFamily: 'IRYekan, sans-serif'
                              }}>
                                {label}
                              </div>
                              <div className="field-value-print persian-digits" style={{ 
                                padding: '5px',
                                borderBottom: '1px solid #ddd',
                                minHeight: '25px',
                                fontFamily: 'IRYekan, sans-serif'
                              }}>
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
                        <div key={field.key} className="subform-section-print" style={{ 
                          marginTop: '30px', 
                          breakInside: 'avoid',
                          fontFamily: 'IRYekan, sans-serif'
                        }}>
                          <h2 className="subform-title-print" style={{ 
                            fontSize: '13pt',
                            fontWeight: 'bold',
                            marginBottom: '15px',
                            paddingBottom: '8px',
                            borderBottom: '2px solid #333',
                            fontFamily: 'IRYekan, sans-serif'
                          }}>
                            {label}
                          </h2>
                          
                          <table className="subform-table-print persian-digits" style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            margin: '10px 0',
                            fontSize: '9.5pt',
                            fontFamily: 'IRYekan, sans-serif'
                          }}>
                            <thead>
                              <tr>
                                <th className="row-counter-print" style={{ 
                                  textAlign: 'center',
                                  width: '50px',
                                  backgroundColor: '#f8f8f8',
                                  border: '1px solid #ccc',
                                  padding: '8px',
                                  fontFamily: 'IRYekan, sans-serif'
                                }}>
                                  ردیف
                                </th>
                                {subformKeys.map((key) => {
                                  const subField = subformSchema.find((f: any) => f.key === key);
                                  const subLabel = subField?.labelFa || key;
                                  return (
                                    <th key={key} style={{
                                      backgroundColor: '#f8f8f8',
                                      border: '1px solid #ccc',
                                      padding: '8px',
                                      textAlign: 'center',
                                      fontWeight: 'bold',
                                      fontFamily: 'IRYekan, sans-serif'
                                    }}>
                                      {subLabel}
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {subformInfo.data.map((item: any, index: number) => (
                                <tr key={index}>
                                  <td className="row-counter-print" style={{
                                    textAlign: 'center',
                                    width: '50px',
                                    border: '1px solid #ccc',
                                    padding: '8px',
                                    fontFamily: 'IRYekan, sans-serif'
                                  }}>
                                    {persianRowNumber(index + 1)}
                                  </td>
                                  {subformKeys.map((key) => {
                                    const subField = subformSchema.find((f: any) => f.key === key) || { type: 'text', key };
                                    const value = item[key];
                                    return (
                                      <td key={key} className="persian-digits" style={{
                                        border: '1px solid #ccc',
                                        padding: '8px',
                                        textAlign: 'right',
                                        fontFamily: 'IRYekan, sans-serif'
                                      }}>
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