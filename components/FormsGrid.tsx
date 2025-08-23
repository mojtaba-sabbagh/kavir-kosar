// components/FormsGrid.tsx
import Link from 'next/link';

export type FormsGridItem = {
  id: string;
  code: string;
  titleFa: string;
  canRead: boolean;
  canSubmit: boolean;
};

export default function FormsGrid({ forms }: { forms: FormsGridItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {forms.map((f) => {
        // فقط نمایش کارت‌هایی که حداقل Read دارند
        if (!f.canRead && !f.canSubmit) return null;

        const actionable = !!f.canSubmit;

        const cardClasses = actionable
          ? 'no-underline rounded-2xl bg-blue-600 p-6 text-white shadow hover:bg-blue-700 transition'
          : 'no-underline rounded-2xl bg-gray-200 p-6 text-gray-800 shadow hover:bg-gray-300 transition';

        const badgeClasses = actionable
          ? 'inline-flex items-center rounded-md bg-white/20 px-2 py-0.5 text-xs'
          : 'inline-flex items-center rounded-md bg-black/10 px-2 py-0.5 text-xs';

        return (
          <Link
            key={f.id}
            href={`/forms/${encodeURIComponent(f.code)}`}
            className={cardClasses}
            aria-label={`فرم ${f.titleFa}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold">{f.titleFa}</div>
              <span className={badgeClasses}>
                {actionable ? 'ارسال مجاز' : 'فقط مشاهده'}
              </span>
            </div>
            <div className={actionable ? 'text-white/80 text-xs mt-2' : 'text-gray-600 text-xs mt-2'}>
              کد فرم: {f.code}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
