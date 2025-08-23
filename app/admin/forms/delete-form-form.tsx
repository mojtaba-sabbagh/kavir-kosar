'use client';

export default function DeleteFormForm({ formId }: { formId: string }) {
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm('آیا از حذف این فرم مطمئن هستید؟')) e.preventDefault();
  };
  return (
    <form action={`/api/admin/forms/${formId}`} method="post" onSubmit={onSubmit}>
      <input type="hidden" name="_method" value="DELETE" />
      <button className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50">
        حذف
      </button>
    </form>
  );
}
