# Repeating Subforms Guide

## Overview

Repeating subforms allow you to create forms that contain nested, repeating sections. For example:
- **Purchase Order**: Main form with repeating line items
- **Invoice**: Main form with repeating invoice lines (each with product, quantity, price)
- **Work Order**: Main form with repeating task checklist items
- **Production Log**: Main form with repeating material consumption records

## Architecture

### Components

1. **RepeatingSubform** (`components/forms/RepeatingSubform.tsx`)
   - Manages array of rows (form instances)
   - Handles add/delete/reorder operations
   - Provides collapsible row UI
   - Lazy-renders fields within each row

2. **DynamicForm** (updated)
   - Now supports `subform` field type
   - Auto-loads subform definitions on mount
   - Passes subform data to API during submission

### Data Storage

Subform data is stored as a JSON array in the parent form's `payload` field:

```json
{
  "purchaseOrderNumber": "PO-2025-001",
  "vendor": "Acme Corp",
  "lineItems": [
    {
      "product": "Widget A",
      "quantity": 100,
      "unitPrice": 25.50,
      "notes": "Expedited shipping requested"
    },
    {
      "product": "Widget B",
      "quantity": 50,
      "unitPrice": 30.00,
      "notes": ""
    }
  ]
}
```

## Setup Instructions

### Step 1: Create the Subform

First, create a form that will serve as the repeating rows structure.

**Example: Line Items Form**

```
Form Code: line-items
Form Title: آیتم‌های خط
Fields:
  1. product (text) - "محصول"
  2. quantity (number) - "تعداد"
  3. unitPrice (number) - "قیمت واحد"
  4. notes (textarea) - "یادداشت"
```

**Important**: This form doesn't need to be in the user menu (set `isActive: false` or just don't link it). It's only used as a template.

### Step 2: Create the Parent Form

Create the main form that will contain the subform field.

**Example: Purchase Order Form**

```
Form Code: purchase-order
Form Title: سفارش خرید
Fields:
  1. purchaseOrderNumber (text) - "شماره سفارش"
  2. vendor (text) - "تامین‌کننده"
  3. orderDate (date) - "تاریخ سفارش"
  4. lineItems (subform) - "آیتم‌های سفارش"
```

### Step 3: Configure the Subform Field

For the subform field (`lineItems` in the example), set its configuration:

**Field Config (JSON)**:

```json
{
  "subformCode": "line-items"
}
```

Where:
- `subformCode` (required): The code of the child form created in Step 1
- This tells DynamicForm which form to load as the subform template

### Admin Panel Setup

When creating the subform field in the admin panel:

1. **Field Type**: Select "subform" from the dropdown
2. **Field Key**: Enter `lineItems` (no spaces, camelCase)
3. **Field Label**: Enter the Persian label (e.g., "آیتم‌های سفارش")
4. **Config**: Paste the JSON config with `subformCode`

```json
{
  "subformCode": "line-items"
}
```

## User Interface

### Adding Rows

1. Click the **"+ افزودن ردیف"** (Add Row) button
2. A new row appears with all subform fields in expanded edit mode
3. Fill in the fields
4. Click the **"-"** button to collapse/summarize the row

### Viewing Rows (Summary Mode)

When collapsed, each row shows:
- **Row number** (e.g., "ردیف 1")
- **First 2 fields** as a summary
- **Arrow indicators** showing more fields exist (if > 2 fields)

### Editing Rows

- Click the **"+"** button to expand a row for full editing
- All subform fields become editable
- Changes apply immediately to the row

### Reordering Rows

- Click **"↑"** to move a row up
- Click **"↓"** to move a row down
- Ordering is preserved when the form is submitted

### Deleting Rows

- Click **"✕"** to delete a row
- No confirmation dialog (can be added if needed)
- Deleted rows cannot be recovered

## Field Types Supported in Subforms

All standard field types work within subforms:

- `text` - Single-line text input
- `textarea` - Multi-line text input
- `number` - Numeric input with Persian/Arabic digit support
- `date` - Persian date picker
- `datetime` - Persian date and time picker
- `select` - Dropdown selection
- `multiselect` - Multi-select dropdown
- `checkbox` - Boolean toggle
- `file` - File upload
- `kardexItem` - Kardex item picker
- `tableSelect` - Table-based selection

**Note**: `entryRef`, `entryRefMulti`, and nested `subform` are not currently tested in subforms. Use standard field types for best compatibility.

## API & Data Handling

### Form Submission

When the parent form is submitted, the subform data is included in the payload:

**Submitted Payload**:

```json
{
  "purchaseOrderNumber": "PO-2025-001",
  "vendor": "Acme Corp",
  "orderDate": "1403-10-15",
  "lineItems": [
    {
      "product": "Widget A",
      "quantity": "100",
      "unitPrice": "25.50",
      "notes": "Expedited shipping requested"
    },
    {
      "product": "Widget B",
      "quantity": "50",
      "unitPrice": "30.00",
      "notes": ""
    }
  ]
}
```

### API Endpoint

The same `/api/forms/submit?code=<formCode>` endpoint handles both regular and subform data. No changes needed to the API.

### Data Retrieval

When retrieving a form entry, subform data is nested in the `payload` JSON:

```typescript
const entry = await prisma.formEntry.findUnique({
  where: { id: entryId }
});

const lineItems = entry.payload.lineItems; // Array of row objects
```

## Advanced Configuration

### Optional: Multiple Subforms Per Form

A single parent form can have multiple subform fields:

**Example: Invoice Form**

```
- invoiceNumber (text)
- lineItems (subform) → references "invoice-line-items" form
- shipmentItems (subform) → references "shipment-items" form
- paymentTerms (text)
```

Each subform is independent with its own add/delete/reorder controls.

### Optional: Set Default Rows

To start a form with pre-populated rows, modify the `getInitialValues()` function in DynamicForm or set defaults in the form entry creation logic.

### Optional: Validation

Subform field validation can be added to:
1. **Individual field level**: Add `required`, `pattern`, `min`, `max` to subform field config
2. **Row level**: Validate that at least one row exists
3. **Row content level**: Validate relationships between fields

(Currently validation is basic; can be enhanced as needed)

## Examples

### Example 1: Simple Line Items

**Parent Form: invoice**
- invoiceNumber (text)
- vendor (tableSelect)
- lineItems (subform) → "invoice-lines"

**Child Form: invoice-lines**
- itemDescription (text)
- quantity (number)
- unitPrice (number)
- taxPercentage (number)

### Example 2: Nested Data Collection

**Parent Form: production-batch**
- batchNumber (text)
- startDate (date)
- materials (subform) → "material-batch-items"
- qualityChecks (subform) → "quality-checks"

**Child Form: material-batch-items**
- materialCode (kardexItem)
- quantityUsed (number)
- storageLocation (text)
- notes (textarea)

**Child Form: quality-checks**
- checkDescription (text)
- passedCheck (checkbox)
- comments (textarea)
- checkedBy (text)

## Troubleshooting

### Subform not showing in form

- ✓ Verify field type is set to "subform"
- ✓ Verify `config.subformCode` matches the child form's code exactly
- ✓ Verify the child form exists in the database with `isActive: true` (or at least retrievable)
- ✓ Check browser console for errors loading the subform definition

### Subform fields not displaying

- ✓ Verify the child form has fields defined
- ✓ Verify fields have proper `labelFa` set
- ✓ Verify field `order` is set correctly
- ✓ Check if field types are supported (see list above)

### Data not saving

- ✓ Verify parent form submission endpoint works for regular fields
- ✓ Check that subform data is being serialized correctly (JSON array of objects)
- ✓ Verify backend is handling the nested payload structure

### Performance Issues

- **For many rows**: Subforms are designed for 10-50 rows per form. For larger datasets (100+ rows), consider pagination or splitting into multiple subforms.
- **For many fields**: Keep subform fields under 10 fields for optimal UX. Use summaries effectively.

## Future Enhancements

Potential improvements:

1. **Validation System**: Add row-level and field-level validation with error messages
2. **Templates**: Allow users to save row patterns as templates
3. **Copy/Paste**: Support duplicating rows
4. **Sorting**: Allow sorting by column
5. **Aggregation**: Show totals/summaries at the bottom
6. **Conditional Fields**: Show/hide fields based on other field values
7. **Nested Subforms**: Allow subforms within subforms (unlimited nesting depth)
8. **Batch Operations**: Select multiple rows and perform bulk actions
9. **Import/Export**: CSV import/export for rows
10. **Linked Lookups**: Subform fields that populate based on parent form selections

## Code Reference

### RepeatingSubform Component

```typescript
type Props = {
  label: string; // Field label (Persian)
  subformFields: FormField[]; // Field definitions from child form
  value: SubformInstance[]; // Array of row objects
  onChange: (rows: SubformInstance[]) => void; // Update handler
};
```

### Integration in DynamicForm

```typescript
{f.type === 'subform' && subformDefs[f.key] && (
  <RepeatingSubform
    label={f.labelFa}
    subformFields={subformDefs[f.key]}
    value={(values[f.key] as any[] | undefined) ?? []}
    onChange={(rows) => set(f.key, rows)}
  />
)}
```

### Config Object

```typescript
interface SubformConfig {
  subformCode: string; // Code of child form (required)
  // Future additions:
  // minRows?: number; // Minimum rows required
  // maxRows?: number; // Maximum rows allowed
  // defaultRows?: number; // Auto-populate N empty rows
}
```
