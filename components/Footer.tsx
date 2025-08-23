export default function Footer() {
return (
    <footer className="mt-8 border-t bg-white">
        <div className="container mx-auto max-w-5xl px-4 py-6 text-center text-sm text-gray-600">
            © {new Date().getFullYear()} کوثر کویر رفسنجان • تمامی حقوق محفوظ است.
        </div>
    </footer>
    );
}