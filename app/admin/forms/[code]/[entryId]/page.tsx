import ConfirmButtons from '@/components/ConfirmButtons';

export default async function EntryPage({ params }: { params: { code: string; entryId: string } }) {
  const user = await getSession();
  if (!user) redirect('/auth/sign-in');

  const entry = await prisma.formEntry.findUnique({
    where: { id: params.entryId },
    include: {
      tasks: { where: { userId: user.id } }, // my tasks
    },
  });
  if (!entry) notFound();

  const myTask = entry.tasks[0] ?? null;
  const allowed = !!myTask; // or also check RoleFormPermission if you want extra guard

  return (
    <div className="space-y-6">
      {/* ... your form entry details / payload renderer ... */}

      <ConfirmButtons entryId={entry.id} task={myTask} allowed={allowed} />
    </div>
  );
}
