import { getSession } from '@/lib/auth';
import { getAllowedFormsForUser } from '@/lib/permissions';
import FormsGrid from '@/components/FormsGrid';


export default async function HomeProtected() {
const user = await getSession();
const forms = user ? await getAllowedFormsForUser(user.id) : [];


return (
    <div className="space-y-6">
        <div>
            <h2 className="text-2xl font-bold mb-2">خوش آمدید{user?.name ? `، ${user.name}` : ''}</h2>
            <p className="text-gray-600">فرم‌ها</p>
        </div>
        <FormsGrid forms={forms.map(f => ({ id: f.id, titleFa: f.titleFa, code: f.code }))} />
    </div>
);
}