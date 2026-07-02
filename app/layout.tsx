import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://arash-ahmadi.com"),
  title: "Arash Ahmadi | PhD Student at University of Oklahoma | LLM & AI Research",
  description:
    "Arash Ahmadi is a PhD student in Electrical and Computer Engineering at the University of Oklahoma (OU), fine-tuning small language models for edge devices and building AI for aviation safety, agentic systems, and reasoning at INQUIRE Lab.",
  keywords: [
    "Arash Ahmadi",
    "University of Oklahoma",
    "OU",
    "PhD student",
    "Large Language Models",
    "LLM",
    "AI interpretability",
    "machine learning",
    "artificial intelligence",
    "InquireLab",
    "Electrical and Computer Engineering",
    "NLP",
    "natural language processing",
    "deep learning",
    "AI research",
    "Oklahoma researcher",
  ],
  authors: [{ name: "Arash Ahmadi", url: "https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en" }],
  creator: "Arash Ahmadi",
  publisher: "Arash Ahmadi",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Arash Ahmadi | PhD Student at University of Oklahoma | LLM & AI Research",
    description:
      "Arash Ahmadi is a PhD student in Electrical and Computer Engineering at the University of Oklahoma, specializing in Large Language Models (LLMs), AI interpretability, and machine learning research.",
    siteName: "Arash Ahmadi - Personal Website",
    images: [
      {
        url: "/portrait.jpg",
        width: 800,
        height: 600,
        alt: "Arash Ahmadi - PhD Student at University of Oklahoma",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arash Ahmadi | PhD Student at University of Oklahoma",
    description:
      "PhD student at OU specializing in Large Language Models (LLMs) and AI interpretability research at InquireLab.",
    images: ["/portrait.jpg"],
  },
  alternates: {
    canonical: "/",
  },
  category: "education",
  classification: "Academic Personal Website",
};

// JSON-LD structured data for better SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Arash Ahmadi",
  givenName: "Arash",
  familyName: "Ahmadi",
  jobTitle: "PhD Student",
  description:
    "PhD student in Electrical and Computer Engineering at the University of Oklahoma, fine-tuning small language models for edge devices with applications in agentic systems, aviation safety, and health monitoring. M.S. in ECE (2026), founder of the OU LLM Engineering Club.",
  url: "https://arash-ahmadi.com",
  image: "/portrait.jpg",
  email: "arash.ahmadi@ou.edu",
  sameAs: [
    "https://github.com/arash-san",
    "https://scholar.google.com/citations?user=RR1oK4sAAAAJ&hl=en",
    "https://www.linkedin.com/in/arash-ahmadi-619ab1352",
    "https://x.com/user_arash",
  ],
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "University of Kurdistan",
  },
  affiliation: {
    "@type": "CollegeOrUniversity",
    name: "University of Oklahoma",
    department: {
      "@type": "Organization",
      name: "Electrical and Computer Engineering",
    },
  },
  worksFor: {
    "@type": "ResearchOrganization",
    name: "InquireLab",
    url: "https://inquirelab.ai/",
  },
  knowsAbout: [
    "Large Language Models",
    "LLM Interpretability",
    "Machine Learning",
    "Artificial Intelligence",
    "Natural Language Processing",
    "Deep Learning",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
