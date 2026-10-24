import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Side Hustle HQ — Make room for your next big thing", template: "%s · Side Hustle HQ" },
  description: "A focused, private workspace to discover side-hustle ideas, collect evidence, and turn conviction into action.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><a href="#main-content" className="skip-link">Skip to content</a>{children}</body>
    </html>
  );
}
