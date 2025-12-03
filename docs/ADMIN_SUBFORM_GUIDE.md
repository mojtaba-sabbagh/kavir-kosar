# How to Create a Repeating Subform in the Admin Site

## Quick Start (3 Steps)

### Step 1: Create the "Child Form" (Template)

This form defines the structure of each row in the repeating section.

1. Go to **Admin** → **Forms** → **New Form**
2. Fill in the form details:
   - **Form Code**: `line-items` (example)
   - **Form Title**: `آیتم‌های خط` (example - in Persian)
   - **Active**: Check ✓
   - **Sort Order**: 100

3. Add the fields that will appear in each row:
   - **Field 1**: `product` (type: text) - "محصول"
   - **Field 2**: `quantity` (type: number) - "تعداد"
   - **Field 3**: `unitPrice` (type: number) - "قیمت واحد"

4. Click **Save**

✅ **Done!** Your child form template is ready.

---

### Step 2: Create the "Parent Form" (Main)

This is the form that will contain your repeating subform.

1. Go to **Admin** → **Forms** → **New Form**
2. Fill in the form details:
   - **Form Code**: `purchase-order` (example)
   - **Form Title**: `سفارش خرید` (example)
   - **Active**: Check ✓

3. Add regular fields first:
   - **Field 1**: `poNumber` (type: text) - "شماره سفارش"
   - **Field 2**: `vendor` (type: text) - "تامین‌کننده"
   - **Field 3**: `orderDate` (type: date) - "تاریخ سفارش"

4. Click **Save**

---

### Step 3: Add the Subform Field

Now add the repeating section to your parent form.

1. In the same form editor, click **Add Field** button
2. Fill in the field details:
   - **Field Key**: `lineItems` (or any name, camelCase)
   - **Field Label**: `آیتم‌های سفارش` (or your Persian label)
   - **Field Type**: Select **"فرم تکرارشونده"** (Repeating Subform)
   - **Required**: Check if needed

3. A new section appears: **تنظیمات فرم تکرارشونده** (Subform Settings)
   - Click the **"کد فرم"** (Form Code) dropdown
   - Select the child form you created in **Step 1**: `line-items`

4. Click **Save**

✅ **Congratulations!** Your repeating subform is ready to use!

---

## Detailed Admin Interface Walkthrough

### Main Form Editor

```
┌─────────────────────────────────────────────┐
│ Form Builder                                 │
├─────────────────────────────────────────────┤
│ Code: purchase-order                         │
│ Title: سفارش خرید                            │
│ Active: ☑                                    │
│ Sort Order: 100                              │
└─────────────────────────────────────────────┘
```

### Adding a Field

After clicking "Add Field", you'll see:

```
┌─────────────────────────────────────────────┐
│ Field Editor                                 │
├──────────────────┬──────────────────┬────────┤
│ Key              │ Label            │ Type   │
├──────────────────┼──────────────────┼────────┤
│ lineItems        │ آیتم‌های سفارش    │ فرم تک │
│                  │                  │رار... │
└──────────────────┴──────────────────┴────────┘
```

### Subform Configuration Panel

After selecting **"فرم تکرارشونده"** as the type:

```
┌────────────────────────────────────────────────┐
│ تنظیمات فرم تکرارشونده                         │
│ (Subform Settings)                             │
├────────────────────────────────────────────────┤
│ کد فرم (Form Code):                             │
│ ┌──────────────────────────────────────────┐   │
│ │ — انتخاب فرم —                           │   │
│ │ آیتم‌های خط (line-items)                  │   │
│ │ دیگر فرم ها...                          │   │
│ └──────────────────────────────────────────┘   │
│                                                │
│ ⚠️ برای فرم تکرارشونده، انتخاب «کد فرم»      │
│    ضروری است. فیلدهای فرم انتخاب‌شده به‌ عنوان│
│    ردیف‌های تکرار استفاده خواهند شد.          │
└────────────────────────────────────────────────┘
```

After selection:

```
┌────────────────────────────────────────────────┐
│ تنظیمات فرم تکرارشونده                         │
├────────────────────────────────────────────────┤
│ کد فرم (Form Code):                             │
│ ┌──────────────────────────────────────────┐   │
│ │ آیتم‌های خط (line-items) ✓              │   │
│ └──────────────────────────────────────────┘   │
│                                                │
│ ✅ Ready to save!                             │
└────────────────────────────────────────────────┘
```

---

## Real-World Examples

### Example 1: Invoice with Line Items

**Step 1: Create child form "invoice-line"**
```
Fields:
  - itemDescription (text) - "توضیح محصول"
  - quantity (number) - "تعداد"
  - unitPrice (number) - "قیمت واحد"
  - discount (number) - "تخفیف (%)"
```

**Step 2: Create parent form "invoice"**
```
Fields:
  - invoiceNumber (text) - "شماره فاکتور"
  - customer (text) - "نام مشتری"
  - invoiceDate (date) - "تاریخ"
  - lineItems (subform) → "invoice-line" ← Select here!
  - totalAmount (number) - "جمع کل"
  - notes (textarea) - "یادداشت"
```

### Example 2: Production Batch with Material Tracking

**Step 1: Create child form "batch-material"**
```
Fields:
  - materialCode (kardexItem) - "کالا"
  - quantityUsed (number) - "مقدار مصرف‌شده"
  - storageLocation (text) - "محل ذخیره"
  - notes (textarea) - "یادداشت"
```

**Step 2: Create parent form "production-batch"**
```
Fields:
  - batchNumber (text) - "شماره دسته"
  - productionDate (date) - "تاریخ تولید"
  - materials (subform) → "batch-material" ← Select here!
  - totalQuantity (number) - "جمع کل"
```

### Example 3: Work Order with Tasks

**Step 1: Create child form "task-item"**
```
Fields:
  - taskDescription (textarea) - "توضیح کار"
  - estimatedHours (number) - "ساعت برآورد"
  - assignedTo (text) - "مسئول"
  - completed (checkbox) - "انجام شده"
```

**Step 2: Create parent form "work-order"**
```
Fields:
  - workOrderNumber (text) - "شماره کار"
  - customer (text) - "مشتری"
  - dueDate (date) - "موعد تسلیم"
  - tasks (subform) → "task-item" ← Select here!
  - status (select) - "وضعیت"
```

---

## Using the Form (User Perspective)

Once you've created the form, users will see this interface:

### Initial State (No Rows)
```
┌──────────────────────────────┐
│ آیتم‌های سفارش               │ + افزودن ردیف
├──────────────────────────────┤
│                              │
│ هنوز ردیفی اضافه نشده است    │
│                              │
└──────────────────────────────┘
```

### After Adding a Row
```
┌──────────────────────────────────────────┐
│ آیتم‌های سفارش        │ + افزودن ردیف   │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ ردیف 1        ↑ ↓ + ✕               │ │
│ │ ─────────────────────────────────────│ │
│ │ محصول: Widget A              (25.50)│ │
│ │ و 2 فیلد دیگر                       │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### After Expanding (Editing)
```
┌──────────────────────────────────────────┐
│ آیتم‌های سفارش        │ + افزودن ردیف   │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ ردیف 1        ↑ ↓ − ✕               │ │
│ │ ─────────────────────────────────────│ │
│ │ محصول *                             │ │
│ │ [________________]                  │ │
│ │                                      │ │
│ │ تعداد *                              │ │
│ │ [________________]                  │ │
│ │                                      │ │
│ │ قیمت واحد *                          │ │
│ │ [________________]                  │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### With Multiple Rows
```
┌──────────────────────────────────────────┐
│ آیتم‌های سفارش        │ + افزودن ردیف   │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ ردیف 1        − ↓ + ✕               │ │
│ │ محصول: Widget A / تعداد: 100        │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ردیف 2        ↑ − + ✕               │ │
│ │ محصول: Widget B / تعداد: 50         │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ردیف 3        ↑ ↓ + ✕               │ │
│ │ محصول: Widget C / تعداد: 25         │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## Supported Field Types in Subforms

When creating your child form, you can use any of these field types:

| Type | Persian Name | Example |
|------|-------------|---------|
| `text` | متن | Product name |
| `textarea` | چندخطی | Detailed notes |
| `number` | عدد | Quantity, price |
| `date` | تاریخ | Production date |
| `datetime` | تاریخ‌زمان | Entry timestamp |
| `select` | انتخابی | Status dropdown |
| `multiselect` | انتخاب‌های متعدد | Multiple categories |
| `checkbox` | بله/خیر | Completed, approved |
| `file` | فایل | Document attachment |
| `kardexItem` | کاردکس کالا | Warehouse item picker |
| `tableSelect` | انتخاب از جدول | Table-based selection |

---

## Troubleshooting

### Subform field type not appearing?
- ✅ Make sure your database schema has been updated (Prisma generate)
- ✅ Refresh the page

### Cannot select child form?
- ✅ Make sure the child form exists in the database
- ✅ Check that the child form code is correct
- ✅ Reload the form editor page

### Rows not showing when user fills form?
- ✅ Verify the child form has fields defined
- ✅ Check browser console for errors
- ✅ Verify form code in subform config exactly matches child form code

### Data not saving?
- ✅ Check network tab for API errors
- ✅ Verify backend is accepting the nested payload structure
- ✅ Check database logs for insert errors

---

## Tips & Best Practices

1. **Keep child forms simple**: Use 3-6 fields per subform for best UX
2. **Use descriptive labels**: Make it clear what each field means in Persian
3. **Set required fields**: Mark `*` on mandatory fields
4. **Order matters**: Set proper `order` values so fields appear in logical sequence
5. **Unique keys**: Use camelCase for field keys (e.g., `lineItem`, `materialCode`)
6. **Test first**: Create a test form and test it before deploying
7. **Document usage**: Leave notes in the child form title (use comments or description field)

---

## API Integration (For Developers)

When the form is submitted, subform data appears as a JSON array in the payload:

```json
{
  "poNumber": "PO-001",
  "vendor": "Acme Corp",
  "orderDate": "1403-10-15",
  "lineItems": [
    {
      "product": "Widget A",
      "quantity": "100",
      "unitPrice": "25.50"
    },
    {
      "product": "Widget B",
      "quantity": "50",
      "unitPrice": "30.00"
    }
  ]
}
```

This can be retrieved in your backend:
```typescript
const entry = await prisma.formEntry.findUnique({ where: { id } });
const lineItems = entry.payload.lineItems; // Array of rows
```
