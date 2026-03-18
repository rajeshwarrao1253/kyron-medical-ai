import "./globals.css";

export const metadata = {
  title: "Kyron Medical — AI Health Assistant",
  description: "Intelligent appointment scheduling and patient care assistant powered by Kyron Medical."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
