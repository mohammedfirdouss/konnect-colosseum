import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import Image from "next/image";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t mt-12"
      style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
    >
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Top Section */}
        <div className="flex items-center justify-between">
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-1">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Image src="/logo.png" alt="Konnect" width={50} height={50} />
              </div>
              <p className="text-sm mb-4 max-w-md" style={{ color: "#B3B3B3" }}>
                The trusted campus marketplace for students. Buy, sell, and
                trade securely with blockchain-powered escrow.
              </p>
              {/* Social Links */}
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href="https://x.com/Konnectfc"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-opacity-80"
              style={{ backgroundColor: "#333333" }}
            >
              <Twitter size={18} style={{ color: "#FFFFFF" }} />
            </a>
          </div>
        </div>

        {/* Contact Info */}

        {/* Bottom Section */}
        <div className="flex text-xs flex-col md:flex-row items-center justify-between gap-4 border-t">
          <div className="flex items-center gap-2">
            <p className="text-sm" style={{ color: "#666666" }}>
              © {currentYear} Konnect. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm" style={{ color: "#666666" }}>
              Powered by
            </p>
            <Image
              src="/solana-tag.png"
              alt="Solana"
              width={150}
              height={150}
              className="aspect-2/3"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
