"use client";

const Footer = () => {
  return (
    <footer className="relative border-t border-white/10 bg-gradient-to-b from-black via-slate-950 to-black pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          {/* brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#FF6FD8] to-[#6F8BFF] flex items-center justify-center">
                <span className="text-xl font-black text-white">S</span>
              </div>
              <div>
                <span className="text-xl font-bold text-white">
                  STAERA
                </span>
                <span className="block text-[11px] text-purple-400 font-mono">
                  AI-Powered Web3
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Building a multi-utility digital asset ecosystem for sustainable
              growth in the Web3 era.
            </p>
          </div>

          {/* quick links */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-sm">
              {["Whitepaper", "Tokenomics", "Roadmap", "Ecosystem", "Team", "Blog"].map(
                (item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* resources */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-3">
              Resources
            </h3>
            <ul className="space-y-2.5 text-sm">
              {[
                "Documentation",
                "Audit Reports",
              ].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* socials */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-3">
              Connect With Us
            </h3>
            <div className="flex flex-wrap gap-2 mb-5">
              {["Telegram", "Twitter", "Discord", "Medium"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-[#FF6FD8] hover:text-white transition-all text-lg"
                >
                  <span>
                    {social === "Twitter"
                      ? "🐦"
                      : social === "Telegram"
                      ? "✈️"
                      : social === "Discord"
                      ? "💬"
                      : "📝"}
                  </span>
                </a>
              ))}
            </div>
            <div className="space-y-1 text-xs sm:text-sm">
              <a
                href="mailto:contact@staera.io"
                className="text-zinc-400 hover:text-white transition-colors block"
              >
                contact@staera.io
              </a>
              <a
                href="https://staera.io"
                className="text-[#FF6FD8] hover:text-[#6F8BFF] transition-colors block"
              >
                staera.io
              </a>
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="text-zinc-500">
              © {new Date().getFullYear()} Staera Ecosystem. All rights
              reserved.
            </div>
            <div className="flex gap-5 text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-center text-zinc-600">
            $AERA is a utility token, not a regulated investment product. Always
            do your own research.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
