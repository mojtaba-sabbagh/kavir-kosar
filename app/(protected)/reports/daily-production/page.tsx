// app/(protected)/reports/daily-production/page.tsx
import RawMaterialsSection from "./components/RawMaterialsSection";
import RawMaterialsDetailsSection from "./components/RawMaterialsDetailsSection";
import ProductsDetailsSection from "./components/ProductsDetailsSection";
import ProductsSummarySection from "./components/ProductsSummarySection";
import ReportFilterForm from "./components/ReportFilterForm";
import { CollapsiblePanelAdvanced } from "@/components/ui/CollapsiblePanelAdvanced";
import WasteDetailsSection from "./components/WasteDetailsSection";
import WasteSummarySection from "./components/WasteSummarySection";
import PauseDetailsSection from "./components/PauseDetailsSection";
import FinalSummarySection from "./components/FinalSummarySection";
import type { ProductKey } from "@/lib/report-helpers"; // ✅ import the type

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Search = { date?: string; hours?: string; product?: string };

export default async function DailyProductionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const date = (sp.date ?? "").trim();
  const hours = Math.max(1, Number(sp.hours ?? "") || 24);

  // normalize to the allowed union
  const rawProduct = (sp.product ?? "").trim();
  const product: ProductKey = rawProduct === "2" ? "2" : "1"; // ✅ coerce to "1" | "2"

  const show = !!date;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6" dir="rtl">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">گزارش تولید روزانه</h1>

      <ReportFilterForm initialDate={date || undefined} initialHours={hours} initialProduct={product} />

      {show ? (
        <>
          <CollapsiblePanelAdvanced /* مواد اولیه */ title="مواد اولیه" variant="accent" defaultOpen={false}
            closedHintText="برای مشاهده گزارش کلیک کنید +" className="mb-6" headerClassName="py-4" contentClassName="p-6"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          >
            <div className="space-y-8">
              <RawMaterialsDetailsSection date={date} product={product} />
              <RawMaterialsSection        date={date} hours={hours} product={product} />
            </div>
          </CollapsiblePanelAdvanced>

          <CollapsiblePanelAdvanced /* تولید */ title="تولید" variant="accent" defaultOpen={false}
            closedHintText="برای مشاهده گزارش تولید کلیک کنید +" className="mb-6" headerClassName="py-4" contentClassName="p-6"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4m3-16v4m0 0v4m0-4h4m-4 0H9"/></svg>}
          >
            <div className="space-y-8">
              <ProductsDetailsSection date={date} product={product} />
              <ProductsSummarySection date={date} product={product} />
            </div>
          </CollapsiblePanelAdvanced>

          <CollapsiblePanelAdvanced /* ضایعات */ title="ضایعات" variant="accent" defaultOpen={false}
            closedHintText="برای مشاهده ضایعات کلیک کنید +" className="mb-6" headerClassName="py-4" contentClassName="p-6 bg-white"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-7 4h8M10 9h4m7 3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          >
            <div className="space-y-8">
              <WasteDetailsSection  date={date} product={product} />
              <WasteSummarySection  date={date} product={product} />
            </div>
          </CollapsiblePanelAdvanced>

          <CollapsiblePanelAdvanced /* توقفات */ title="توقفات و تعمیرات" variant="accent" defaultOpen={false}
            closedHintText="برای مشاهده توقفات کلیک کنید +" className="mb-6" headerClassName="py-4" contentClassName="p-6 bg-white"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>}
          >
            <PauseDetailsSection date={date} product={product} />
          </CollapsiblePanelAdvanced>

          <CollapsiblePanelAdvanced /* جمع بندی */ title="جمع بندی" variant="accent" defaultOpen={false}
            closedHintText="برای مشاهده جمع‌بندی کلیک کنید +" className="mb-6" headerClassName="py-4" contentClassName="p-6 bg-white"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10M5 11h14M5 15h14" /></svg>}
          >
            <FinalSummarySection date={date} product={product} />
          </CollapsiblePanelAdvanced>
        </>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-700">لطفاً تاریخ و ساعات کار را انتخاب و روی «نمایش گزارش» کلیک کنید.</p>
        </div>
      )}
    </div>
  );
}
