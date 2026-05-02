import React from 'react';

export const metadata = {
  title: 'Contact Us | Where Big Fish',
  description: 'Get in touch with the team at Where Big Fish.',
};

export default function ContactPage() {
  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
      <div className="prose prose-invert max-w-none">
        <p className="mb-4">
          Have questions, suggestions, or want to contribute a big fish story? We'd love to hear
          from you! Whether you found a new hotspot or noticed an error in our data, your feedback
          helps us keep the directory accurate for everyone.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Reach Out</h2>
        <p className="mb-4">You can contact our team via email or mail:</p>
        <ul className="list-disc pl-6 mb-6">
          <li className="mb-2">
            <strong>Email:</strong>{' '}
            <a href="mailto:info@wherebigfish.com" className="text-blue-400">
              info@wherebigfish.com
            </a>
          </li>
          <li className="mb-2">
            <strong>Address:</strong> 123 River Road, Fisherman's Cove, FL 33000, USA
          </li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Social Media</h2>
        <p className="mb-4">
          Follow us for the latest updates on monster fish catches and conservation news:
        </p>
        <p className="space-x-4">
          <span className="text-gray-400">#WhereBigFish</span>
          <span className="text-gray-400">#FishingLife</span>
          <span className="text-gray-400">#MonsterFish</span>
        </p>
      </div>
    </div>
  );
}
