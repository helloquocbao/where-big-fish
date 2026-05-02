import React from 'react';

export const metadata = {
  title: 'Disclaimer | Where Big Fish',
  description: 'Disclaimer and Terms of Use for Where Big Fish.',
};

export default function Disclaimer() {
  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-8">Disclaimer</h1>
      <div className="prose prose-invert max-w-none">
        <p>Last updated: May 02, 2026</p>

        <h2>1. Accuracy of Information</h2>
        <p>
          The information provided on Where Big Fish is for general informational purposes only.
          While we strive to keep the information up to date and correct, we make no representations
          or warranties of any kind about the completeness, accuracy, reliability, or suitability of
          the information.
        </p>

        <h2>2. Fishing Regulations</h2>
        <p>
          Fishing regulations change frequently. Always check local laws and obtain necessary
          permits before fishing at any location mentioned on this site. We are not responsible for
          any legal issues or fines incurred by users.
        </p>

        <h2>3. Safety</h2>
        <p>
          Fishing can be a dangerous activity. Users are responsible for their own safety. Always
          use appropriate safety gear and be aware of your surroundings.
        </p>

        <h2>4. Affiliate Disclosure</h2>
        <p>
          Where Big Fish participates in various affiliate marketing programs, which means we may
          get paid commissions on editorially chosen products purchased through our links to
          retailer sites.
        </p>
      </div>
    </div>
  );
}
