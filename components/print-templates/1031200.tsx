import React, { ReactElement } from 'react';

interface FormField {
  key: string;
  type: string;
  labelFa?: string;
}

interface SubformInfo {
  data: Record<string, any>[];
  schema: FormField[];
  displayMaps?: Record<string, Record<string, string>>;
}

interface CustomPrintProps {
  entry: { payload?: Record<string, any> };
  schema: FormField[];
  labels: Record<string, string>;
  displayMaps?: Record<string, Record<string, string>>;
  subformData: Record<string, SubformInfo>;
  formTitle: string;
  renderValue: (field: FormField, value: any, customDisplayMaps?: Record<string, Record<string, string>>) => string;
  toPersianDigits: (str: string) => string;
  persianRowNumber: (num: number) => string;
  getDateValue: () => string;
}

export default function CustomPrint1031200({
  entry,
  schema,
  labels,
  displayMaps,
  subformData,
  formTitle,
  renderValue,
  toPersianDigits,
  persianRowNumber,
  getDateValue
}: CustomPrintProps): ReactElement {
  // Separate main form items from subforms with explicit types
  const mainFields = schema.filter((field: FormField) => field.type !== 'subform');
  const subformFields = schema.filter((field: FormField) => field.type === 'subform');
  
  // Get date field from schema
  const dateField = schema.find((field: FormField) => field.type === 'date' || field.type === 'datetime');
  
  // Categorize fields and combine for single column layout
  const textFields: FormField[] = [];
  const otherFields: FormField[] = [];
  
  mainFields.forEach((field: FormField) => {
    if (dateField && field.key === dateField.key) return; // Skip date field
    if (field.type === 'text' || field.type === 'textarea' || field.type === 'longText') {
      textFields.push(field);
    } else {
      otherFields.push(field);
    }
  });
  
  const allFields = [...otherFields, ...textFields]; // Combine all for single column
  
  return (
    <>
      {/* Form title */}
      <h1 className="form-title-print text-center text-[16pt] font-bold m-0 mb-[10px] font-IRYekan">
        {formTitle || 'مجوز خروج کالا'}
      </h1>
      
      {/* All fields in single-column full-width layout without borders */}
      {allFields.length > 0 && (
        <div className="full-width-fields-print mb-[10px] font-IRYekan">
          <p>این تعهدنامه برای آفای</p>
          {allFields.map((field: FormField) => {
            const value = entry.payload?.[field.key];
            const label = labels[field.key] || field.key;
            return (
              <div key={field.key} className="full-width-field-print mb-[5px] font-IRYekan">
                <div className="field-label-print font-bold mb-[2px] text-[#333] font-IRYekan">
                  {label}
                </div>
                <div className="field-value-print persian-digits p-[2px] border-b-0 min-h-[15px] font-IRYekan">
                  {renderValue(field, value, displayMaps)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Subforms as tables */}
      {subformFields.map((field: FormField) => {
        const subformInfo = subformData[field.key];
        const label = labels[field.key] || field.key;
        
        if (!subformInfo || !Array.isArray(subformInfo.data) || subformInfo.data.length === 0) {
          return null;
        }
        
        const subformSchema = subformInfo.schema || [];
        const subformKeys = subformSchema.length > 0
          ? subformSchema.map((f: FormField) => f.key)
          : (subformInfo.data[0] ? Object.keys(subformInfo.data[0]) : []);
        
        return (
          <div key={field.key} className="subform-section-print mt-[10px] break-inside-avoid font-IRYekan">
            <h2 className="subform-title-print text-[13pt] font-bold mb-[10px] pb-[5px] border-b-2 border-[#333] font-IRYekan">
              {label} ({toPersianDigits(subformInfo.data.length.toString())} ردیف)
            </h2>
            <table className="subform-table-print persian-digits w-full border-collapse my-[5px] text-[9pt] font-IRYekan">
              <thead>
                <tr>
                  <th className="row-counter-print text-center w-[50px] bg-[#f8f8f8] border border-[#ccc] p-1 font-IRYekan">
                    ردیف
                  </th>
                  {subformKeys.map((key: string) => {
                    const subField = subformSchema.find((f: FormField) => f.key === key);
                    const subLabel = subField?.labelFa || key;
                    return (
                      <th key={key} className="bg-[#f8f8f8] border border-[#ccc] p-1 text-center font-bold font-IRYekan">
                        {subLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {subformInfo.data.map((item: Record<string, any>, index: number) => (
                  <tr key={index}>
                    <td className="row-counter-print text-center w-[50px] border border-[#ccc] p-1 font-IRYekan">
                      {persianRowNumber(index + 1)}
                    </td>
                    {subformKeys.map((key: string) => {
                      const subField = subformSchema.find((f: FormField) => f.key === key) || { type: 'text', key };
                      const value = item[key];
                      return (
                        <td key={key} className="persian-digits border border-[#ccc] p-1 text-right font-IRYekan">
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
      
      {/* Bottom code/date */}
      <div className="text-left mt-[10px] text-[10pt] font-IRYekan dir-ltr">
        {getDateValue()}
      </div>
    </>
  );
}