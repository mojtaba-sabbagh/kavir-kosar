import React, { ReactElement } from 'react';

interface FormField {
  key: string;
  type: string;
  labelFa?: string;
  config?: any;
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
  // Extract data from entry payload
  const payload = entry.payload || {};
  
  // Helper function to get field value
  const getFieldValue = (fieldKey: string) => {
    const field = schema.find(f => f.key === fieldKey);
    if (!field) return '';
    return renderValue(field, payload[fieldKey], displayMaps);
  };
  
  // Get subform data (product items) - look for subform
  const subformFields = schema.filter((field: FormField) => field.type === 'subform');
  let productItems: any[] = [];
  let productSchema: FormField[] = [];
  let subformDisplayMaps: Record<string, Record<string, string>> = {};
  
  if (subformFields.length > 0) {
    const firstSubformKey = subformFields[0].key;
    const subformInfo = subformData[firstSubformKey];
    if (subformInfo && Array.isArray(subformInfo.data)) {
      productItems = subformInfo.data;
      productSchema = subformInfo.schema || [];
      subformDisplayMaps = subformInfo.displayMaps || {};
    }
  }
  
  // Calculate total quantity
  const totalQuantity = productItems.reduce((sum, item) => {
    const quantityField = productSchema.find(f => 
      f.labelFa?.includes('تعداد') || 
      f.key.includes('quantity') || 
      f.key.includes('number') ||
      f.key === 'تعداد'
    );
    if (quantityField) {
      const qty = parseFloat(item[quantityField.key]) || 0;
      return sum + qty;
    }
    return sum;
  }, 0);
  
  // Extract specific fields based on your PDF output
  const andikator = getFieldValue('andikator') || payload['شماره'] || ''; // {andikator}
  const driver = getFieldValue('driver') || getFieldValue('راننده') || payload['راننده'] || 'علی رفیعی'; // {driver}
  const pelak = getFieldValue('pelak') || getFieldValue('plate') || payload['پلاک'] || 'ایران‌م'; // {pelak}
  const mobile = getFieldValue('mobile') || getFieldValue('phone') || getFieldValue('موبایل') || '۰۹۹۰۱۰۲۳۳۴۶'; // {mobile}
  const barnameh = getFieldValue('barnameh') || getFieldValue('documentNumber') || getFieldValue('شماره برنامه') || '۲۰۴ / ۲۷'; // {barnameh}
  const address = getFieldValue('address') || getFieldValue('Address') || getFieldValue('آدرس') || 'امواز- بخش مرکزی - حمله پدافند هوایی - خیابان اصلی خیابان بنگداران پانک ۱۸۵۵ شرکت رخشان'; // {Address}
  const deliver = getFieldValue('deliver') || getFieldValue('deliveryDate') || getFieldValue('تاریخ تحویل') || '۱۴۰۴/۰۹/۱۷'; // {deliver}
  const date = getFieldValue('date') || getDateValue(); // Use getDateValue as fallback
  // Get warehouse manager - default to پورعباس if not found
  const warehouseManager = getFieldValue('انباردار') || getFieldValue('warehouseManager') || getFieldValue('مسئول انبار') || 'پورعباس';
  
  // Determine unit from first item or default
  let defaultUnit = 'کارتن';
  
  // Find unit field in subform schema
  const unitFieldInSchema = productSchema.find(f => 
    f.labelFa?.includes('واحد') || 
    f.key.includes('unit') ||
    f.key === 'واحد'
  );
  
  return (
    <div className="custom-print-exit-permit font-IRYekan text-[10pt]" dir="rtl" style={{ marginTop: '-3cm' }}>
      {/* Date and number on the LEFT side (which is text-right in RTL) */}
      <div className="mb-[20px]" style={{ marginTop: '-1cm', marginRight: '3cm' }}>
        <div className="flex justify-end"> {/* This aligns content to the LEFT in RTL */}
          <div className="text-right"> {/* text-right aligns to LEFT in RTL */}
            <div className="text-[10pt] mb-1">{date}</div>
            <div className="text-[10pt]">{andikator}</div>
          </div>
        </div>
      </div>
      
      {/* Main title */}
      <h1 className="text-center text-[16pt] font-bold mb-[30px] border-b-2 border-black pb-[5px]">
        مجوز خروج کالا
      </h1>
      
      {/* Product items table */}
      <div className="product-table-section mb-[30px]">
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr>
              <th className="border border-gray-800 p-2 text-center w-[40px] bg-gray-100">ردیف</th>
              <th className="border border-gray-800 p-2 text-center bg-gray-100">شرح کالا</th>
              <th className="border border-gray-800 p-2 text-center w-[80px] bg-gray-100">تعداد</th>
              <th className="border border-gray-800 p-2 text-center w-[60px] bg-gray-100">واحد</th>
              <th className="border border-gray-800 p-2 text-center bg-gray-100">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {productItems.map((item, index) => {
              // Find the product description field
              const productField = productSchema.find(f => 
                f.labelFa?.includes('شرح') || 
                f.key.includes('description') || 
                f.key.includes('name') ||
                f.key.includes('product') ||
                f.key === 'شرح کالا'
              );
              
              // Find quantity field
              const quantityField = productSchema.find(f => 
                f.labelFa?.includes('تعداد') || 
                f.key.includes('quantity') || 
                f.key.includes('number') ||
                f.key === 'تعداد'
              );
              
              // Find unit field - use the one we found above
              const unitField = unitFieldInSchema;
              
              // Find notes field
              const notesField = productSchema.find(f => 
                f.labelFa?.includes('ملاحظات') || 
                f.labelFa?.includes('توضیحات') ||
                f.key.includes('notes') ||
                f.key.includes('description') ||
                f.key === 'ملاحظات'
              );
              
              // Get values using renderValue for proper display (especially for select fields)
              const productName = productField ? renderValue(productField, item[productField.key], subformDisplayMaps) : '';
              const quantity = quantityField ? renderValue(quantityField, item[quantityField.key], subformDisplayMaps) : '';
              
              // SPECIAL: For unit field, use renderValue to get the label from select options
              let itemUnit = defaultUnit;
              if (unitField && item[unitField.key]) {
                itemUnit = renderValue(unitField, item[unitField.key], subformDisplayMaps);
              }
              
              const notes = notesField ? renderValue(notesField, item[notesField.key], subformDisplayMaps) : '';
              
              return (
                <tr key={index}>
                  <td className="border border-gray-800 p-2 text-center">{persianRowNumber(index + 1)}</td>
                  <td className="border border-gray-800 p-2 text-right">{productName}</td>
                  <td className="border border-gray-800 p-2 text-center">{toPersianDigits(quantity)}</td>
                  <td className="border border-gray-800 p-2 text-center">{itemUnit}</td>
                  <td className="border border-gray-800 p-2 text-right">{notes || '-'}</td>
                </tr>
              );
            })}
            
            {/* Total row */}
            <tr>
              <td className="border border-gray-800 p-2"></td>
              <td className="border border-gray-800 p-2 text-right font-bold">جمع</td>
              <td className="border border-gray-800 p-2 text-center font-bold">{toPersianDigits(String(totalQuantity))}</td>
              <td className="border border-gray-800 p-2 text-center font-bold">
                {unitFieldInSchema && productItems.length > 0 
                  ? renderValue(unitFieldInSchema, productItems[0][unitFieldInSchema.key], subformDisplayMaps)
                  : defaultUnit
                }
              </td>
              <td className="border border-gray-800 p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Driver declaration section */}
      <div className="driver-section mb-[30px]">
        <div className="flex items-start mb-[15px]">
          <span className="font-bold ml-[10px] min-w-[60px]">اینجانب</span>
          <span className="border-b border-dashed border-gray-800 flex-grow px-2 min-h-[20px]">{driver}</span>
          <span className="mr-[10px] min-w-[140px]">راننده ماشین به شماره</span>
          <span className="border-b border-dashed border-gray-800 px-2 min-w-[80px] min-h-[20px]">{pelak}</span>
        </div>
        
        <div className="text-justify mb-[15px] leading-[1.8] text-[11pt]">
          گواهی می‌دهم که محموله فوق را کاملاً شمارش کرده و از شرکت صنایع غذایی کوثر کویر رفسنجان
          <br />
          تحویل گرفته و متعهد می‌شوم که آن را به آدرس زیر تحویل نمایم.
        </div>
        
        <div className="flex justify-between mb-[20px]">
          <div className="flex items-center">
            <span className="font-bold ml-[5px]">شماره بارنامه :</span>
            <span className="border-b border-dashed border-gray-800 px-2 min-w-[120px] min-h-[20px] text-center">{barnameh}</span>
          </div>
          <div className="flex items-center">
            <span className="font-bold ml-[5px]">همراه راننده :</span>
            <span className="border-b border-dashed border-gray-800 px-2 min-w-[120px] min-h-[20px] text-center">{mobile}</span>
          </div>
        </div>
      </div>
      
      {/* Receiver section */}
      <div className="receiver-section">
        <div className="flex items-start mb-[15px]">
          <span className="font-bold ml-[10px] min-w-[60px]">گیرنده:</span>
          <span className="border-b border-dashed border-gray-800 flex-grow px-2 min-h-[20px] text-[11pt]">{address}</span>
        </div>

        <div className="flex items-start">
          <span className="font-bold ml-[10px] min-w-[80px]">تاریخ تحویل:</span>
          <span className="border-b border-dashed border-gray-800 px-2 min-w-[100px] min-h-[20px] text-center">{deliver}</span>
        </div>
      </div>
      
      {/* Signatures section */}
      <div className="signatures-section mb-[30px]">
        <div className="flex justify-between">
          <div className="text-center w-1/2">
            <div className="mb-[10px] text-[11pt]">مسئول انبار:</div>
            <div className="mb-[20px] border-gray-800 pt-2 min-h-[40px] text-[11pt]">{/* warehouseManager */}</div>
          </div>
          <div className="text-center w-1/2">
            <div className="mb-[10px] text-[11pt]">راننده ماشین:</div>
            <div className="mb-[20px] border-gray-800 pt-2 min-h-[40px] text-[11pt]">{/* driver */}</div>
          </div>
        </div>
      </div>
      
      {/* Additional styling for print */}
      <style jsx>{`
        @media print {
          .custom-print-exit-permit {
            padding: 1.5cm;
            font-family: 'IRYekan', sans-serif;
          }
          
          .border-gray-800 {
            border-color: #2d3748 !important;
          }
          
          .border-dashed {
            border-style: dashed !important;
          }
          
          table {
            page-break-inside: avoid;
            border-width: 1px !important;
          }
          
          th, td {
            border-width: 1px !important;
          }
        }
      `}</style>
    </div>
  );
}