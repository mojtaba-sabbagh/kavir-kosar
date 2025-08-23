// app/403/page.tsx
export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 text-center">
      <h2 className="text-xl font-bold mb-2">دسترسی غیرمجاز</h2>
      <p className="text-gray-600">برای دسترسی به این بخش باید نقش «admin» داشته باشید.</p>
    </div>
  );
}
