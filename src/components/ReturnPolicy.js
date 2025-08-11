
export default function ReturnPolicy() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Returns & Refunds Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: 11 August 2025</p>
        </header>

        <div className="space-y-8 text-base leading-7">
          <p>
            This Returns & Refunds Policy applies to purchases made directly from <span className="font-semibold">Yearbe Ltd</span> ("we", "us"). It is designed to be clear and customer‑friendly while complying with applicable UK consumer laws. Your statutory rights are not affected.
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1) Return window</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                You may return eligible items within <span className="font-semibold">30 days of delivery</span>.
              </li>
              <li>
                Under the UK Consumer Contracts Regulations, you also have a <span className="font-semibold">14‑day cooling‑off</span> period to cancel an online order from the day you receive it. If you cancel within this period, you must send the goods back within 14 days of cancellation.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2) Condition of returned items</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Items must be unused, unwashed, and in their original packaging with all labels attached.</li>
              <li>
                For hygiene reasons, <span className="font-semibold">opened bedding</span> (e.g., bedsheets) that has had its hygiene seal or protective packaging removed cannot be returned <span className="italic">unless</span> the item is faulty.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3) Faulty or incorrect items</h2>
            <p className="mb-2">
              If your item arrives damaged, defective or not as described, contact us within <span className="font-semibold">30 days</span> of delivery. We will arrange a replacement or refund and cover reasonable return postage.
            </p>
            <p className="text-sm text-gray-600">Tip: include clear photos of any faults to help us resolve things quickly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4) How to start a return</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Email <span className="font-mono">returns@yearbe.co.uk</span> with your order number, the item(s) you wish to return, and the reason.</li>
              <li>We’ll reply with a Return Authorisation (RMA) and instructions.</li>
              <li>Send the item back within 14 days of approval and keep your postage proof/tracking.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5) Refunds</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Refunds are issued to your original payment method within <span className="font-semibold">14 days</span> of us receiving and inspecting the return.</li>
              <li>Original delivery fees are refunded only where the entire order is returned within the cooling‑off period or where we made an error.</li>
              <li>We cannot refund customs duties/taxes for international orders.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6) Exchanges</h2>
            <p>For the fastest service, place a new order for the desired item and return the original for a refund, or request an exchange when contacting us.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7) Non‑returnable items</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Opened or used bedding (unless faulty).</li>
              <li>Gift cards and final‑sale items (if clearly marked at purchase).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8) Return shipping costs</h2>
            <p>
              You are responsible for return postage unless the item is faulty, damaged, or we sent the wrong product. We recommend a tracked service as you are responsible for the item until it reaches us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9) Contact</h2>
            <div className="rounded-2xl border p-4 sm:p-5 bg-gray-50">
              <p className="font-semibold">Yearbe Ltd (Customer Support)</p>
              <p>Email: <span className="font-mono">support@yearbe.co.uk</span> · Returns: <span className="font-mono">returns@yearbe.co.uk</span></p>
              <p>Address: <span className="italic">[Insert returns address here]</span></p>
            </div>
          </section>

          <section className="text-sm text-gray-600">
            <p>
              Note: This page is provided for general information and does not replace legal advice. We aim to go above and beyond minimum legal obligations—please contact us if you need help.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
