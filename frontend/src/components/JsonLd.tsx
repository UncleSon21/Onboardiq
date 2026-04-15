// components/JsonLd.tsx
// Drop this component into your homepage <head> or just before </main>
// Usage: <JsonLd />

export default function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CobbyIQ",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "CobbyIQ turns your company documents into an AI-powered knowledge base so new hires get instant answers from your policies, handbooks, and SOPs.",
    url: "https://cobbyiq.com",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free plan available, no credit card required",
    },
    featureList: [
      "RAG-powered answers from company documents",
      "Role-based access control",
      "PDF and Word document upload",
      "Analytics dashboard",
      "30/60/90 day onboarding task checklists",
    ],
    audience: {
      "@type": "BusinessAudience",
      numberOfEmployees: {
        "@type": "QuantitativeValue",
        minValue: 20,
        maxValue: 150,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}