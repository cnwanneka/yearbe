
// src/components/ReturnPolicy.jsx
export default function ReturnPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Returns & Refunds Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: 11 August 2025</p>
        </header>

        {/* At-a-glance summary */}
        <section className="rounded-2xl border p-5 bg-gray-50 space-y-3 mb-10">
          <h2 className="text-lg font-semibold">At a glance</h2>
          <p>
            <strong>Return Policy – Shop with Confidence.</strong> At <strong>Yearbe Ltd.</strong>, your satisfaction is our priority.
            If you’re not completely happy with your purchase, you can request a return within <strong>14 days</strong> of receiving your order.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Items must be <strong>unused, unwashed</strong>, and in their original packaging with all tags intact.</li>
            <li>Proof of purchase is required.</li>
            <li>For hygiene reasons, we cannot accept returns of opened bedding unless defective or damaged.</li>
          </ul>
          <p>
            If your item arrives damaged or faulty, contact us within <strong>48 hours</strong> with photos, and we’ll arrange a replacement or full refund at no extra cost.
          </p>
          <p>
            For change-of-mind returns, customers cover return shipping. Refunds are processed within <strong>5–7 business days</strong> after inspection.
          </p>
          <p>
            Email us at <a href="mailto:support@yearbe.com" className="underline">support@yearbe.com</a> for assistance.
          </p>
        </section>

        {/* Full policy (kept below for details) */}
        <div className="space-y-8 text-base leading-7">
          {/* ...keep your detailed sections exactly as you have them... */}
        </div>
      </section>
    </main>
  );
}
