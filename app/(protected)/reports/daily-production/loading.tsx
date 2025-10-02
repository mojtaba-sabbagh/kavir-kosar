// app/(protected)/reports/daily-production/loading.tsx
export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6" dir="rtl">
      <div className="animate-pulse h-8 w-64 bg-gray-200 rounded mb-4" />
      <div className="h-32 w-full bg-gray-100 rounded-xl border" />
    </div>
  );
}
