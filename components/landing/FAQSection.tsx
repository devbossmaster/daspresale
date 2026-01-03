"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is Staera?",
      answer:
        "Staera is a holistic Web3 ecosystem that brings AI trading, travel, education, real estate tokenization, gaming and staking under one $AERA-powered umbrella.",
    },
    {
      question: "What makes Staera different?",
      answer:
        "Instead of being a purely speculative meme, Staera is backed by multiple real utilities that create continuous usage, fees and buy-pressure across several industries.",
    },
    {
      question: "How does the presale work?",
      answer:
        "The presale starts at $0.01 per $AERA with a soft cap of $2.5M. Tokens are sold in stages, each with a higher price. 40% of total supply is reserved for presale and liquidity.",
    },
    {
      question: "What is the token utility?",
      answer:
        "$AERA is used for AI Hub subscriptions, travel bookings, course access, real-estate investments, in-app purchases, staking rewards and governance.",
    },
    {
      question: "How are funds and users secured?",
      answer:
        "Smart contracts are audited, liquidity is locked for years, team tokens are vested, and treasury wallets are secured via multisig and best-practice security.",
    },
    {
      question: "What are the staking rewards?",
      answer:
        "Different lock periods pay different yields, with higher APR for long-term commitments. Rewards are paid directly in $AERA to your wallet.",
    },
  ];

  return (
    <section id="faq" className="relative py-20 sm:py-28 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs font-medium text-purple-100 backdrop-blur-xl mb-5">
            <Sparkles className="h-4 w-4" />
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF]">
              Frequently Asked Questions
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
            Quick answers on the Staera ecosystem and the $AERA token.
          </p>
        </div>

        {/* accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={faq.question}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setOpenIndex(isOpen ? null : index)
                  }
                  className="w-full px-5 sm:px-6 py-4 sm:py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm sm:text-base font-semibold text-white">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#FF6FD8] transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0 }}
                  className="overflow-hidden"
                >
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-4 sm:pb-5 pt-1">
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
