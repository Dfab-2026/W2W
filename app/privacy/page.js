import fs from 'fs';
import path from 'path';

export const metadata = {
  title: 'Privacy Policy | Work2Wish',
};

export default function PrivacyPage() {
  const filePath = path.join(process.cwd(), 'public', 'legal', 'privacy.txt');

  const content = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : 'Work2Wish Privacy Policy will be updated soon.';

  return (
    <main className="h-[calc(100dvh-140px)] overflow-y-auto bg-slate-50 px-4 py-6 text-slate-900">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-10">
        <h1 className="mb-6 text-3xl font-extrabold text-slate-950">
          Privacy Policy
        </h1>

        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-700 sm:text-base">
          {content}
        </pre>

        <div className="h-20" />
      </section>
    </main>
  );
}