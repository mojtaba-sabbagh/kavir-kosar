import AIReportGenerator from '@/components/admin/AIReportGenerator';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'تولیدکننده گزارش هوشمند | مدیریت',
};

export default async function AIReportPage() {
  const user = await getSession();

  if (!user?.id) {
    redirect('/auth/sign-in');
  }

  // TODO: Check if user has admin role or report:ai-generate permission
  // const isAdmin = await checkAdminRole(user.id);
  // if (!isAdmin) {
  //   redirect('/403');
  // }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <AIReportGenerator />
    </div>
  );
}
