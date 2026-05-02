import React from 'react';

export const metadata = {
  title: 'About Us | Where Big Fish',
  description:
    "Learn about Where Big Fish and our mission to catalog the world's largest fish species.",
};

export default function AboutPage() {
  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-8">About Where Big Fish</h1>
      <div className="prose prose-invert max-w-none">
        <p className="mb-4">
          Welcome to <strong>Where Big Fish</strong>, your ultimate guide to the giants of the
          underwater world. Our mission is to provide a comprehensive directory of the world's most
          impressive fish species and the best locations to find them.
        </p>
        <p className="mb-4">
          Whether you are an avid angler, a marine biologist, or just someone fascinated by nature's
          giants, we bring you curated information about record-breaking catches, habitat
          preservation, and fishing regulations.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">Our Vision</h2>
        <p className="mb-4">
          We believe in responsible fishing and conservation. By documenting these magnificent
          creatures, we hope to raise awareness about the importance of preserving aquatic
          ecosystems for future generations. We encourage all anglers to follow local regulations
          and practice catch-and-release where appropriate.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">Data Sources</h2>
        <p className="mb-4">
          Our information is gathered from reputable sources, including scientific databases,
          fishing records, and environmental organizations such as the IUCN Red List and IGFA. We
          always strive for accuracy and provide citations for our content.
        </p>
        <p className="mb-4">
          All images used on this site are sourced from Creative Commons or provided with permission
          from the original creators.
        </p>
      </div>
    </div>
  );
}
