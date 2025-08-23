// components/FormsGrid.tsx
import Link from 'next/link';

export type FormsGridItem = {
  id: string;
  code: string;
  titleFa: string;
};

export default function FormsGrid({
  forms,
  className,
  itemClassName,
  linkBuilder,
}: {
  forms: FormsGridItem[];
  /** Grid container classes */
  className?: string;
  /** Each item card classes */
  itemClassName?: string;
  /** Optional custom URL builder (defaults to /forms/{code}) */
  linkBuilder?: (f: FormsGridItem) => string;
}) {
  const build = linkBuilder ?? ((f: FormsGridItem) => `/forms/${encodeURIComponent(f.code)}`);

  const container =
    className ?? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

  const item =
    itemClassName ??
    'rounded-2xl border p-5 no-underline hover:bg-gray-50 transition';

  return (
    <div className={container}>
      {forms.map((f) => (
        <Link
          key={f.id}
          href={build(f)}
          className={item}
          aria-label={`فرم ${f.titleFa}`}
        >
          <div className="text-base font-semibold mb-1">{f.titleFa}</div>
          <div className="text-xs opacity-80">کد فرم: {f.code}</div>
        </Link>
      ))}
    </div>
  );
}
