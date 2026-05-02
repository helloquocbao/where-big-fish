import React from 'react';

export const metadata = {
  title: 'Privacy Policy | Where Big Fish',
  description: 'Privacy Policy for Where Big Fish - Learn how we handle your data.',
};

export default function PrivacyPolicy() {
  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose prose-invert max-w-none">
        <p>Last updated: May 02, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>
          We do not collect any personal information from our users unless voluntarily provided
          through contact forms or newsletter signups.
        </p>

        <h2>2. Cookies</h2>
        <p>
          We use cookies to improve your browsing experience and analyze our traffic. By using our
          website, you consent to our use of cookies.
        </p>

        <h2>3. Third-Party Services</h2>
        <p>
          We may use third-party services such as Google AdSense and Google Analytics. These
          services may collect data about your visit.
        </p>

        <h2>4. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at
          info@wherebigfish.com.
        </p>
      </div>
    </div>
  );
}
