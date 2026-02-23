import React, { useEffect, useState } from "react";
import styles from "./LandingPage.module.css";

// Types
type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

// Data
const features: Feature[] = [
  {
    title: "Smart Import",
    description: "Automatically import transactions from multiple sources including CSV, PDF, and Excel files.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ) as any,
  },
  {
    title: "AI-Powered Categorization",
    description: "Let our AI automatically categorize your transactions with intelligent suggestions.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M12 16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z" />
        <path d="M2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
        <path d="M16 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
        <rect x="7" y="7" width="10" height="10" rx="3" />
      </svg>
    ) as any,
  },
  {
    title: "Rich Analytics",
    description: "Gain insights with beautiful charts and reports about your spending patterns.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ) as any,
  },
  {
    title: "Custom Categories",
    description: "Create your own categories and subcategories to match your financial needs.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ) as any,
  },
  {
    title: "Review Queue",
    description: "Easily review and verify uncategorized transactions with bulk actions.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ) as any,
  },
  {
    title: "Multi-Account Support",
    description: "Track all your accounts - bank accounts, credit cards, and cash in one place.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ) as any,
  },
];

// Sub-components
const Navbar = () => {
  const handleGetStarted = () => (window.location.href = "/login");
  const handleLearnMore = () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLogo}>
        <span>💰</span>
        <span className={styles.navLogoText}>ExpenseTracker</span>
      </div>
      <div className={styles.navLinks}>
        <button onClick={handleLearnMore} className={styles.navButton}>
          Features
        </button>
        <button onClick={handleGetStarted} className={`${styles.navButton} ${styles.navButtonPrimary}`}>
          Get Started
        </button>
      </div>
    </nav>
  );
};

const HeroSection = ({ isLoaded }: { isLoaded: boolean }) => {
  const handleGetStarted = () => (window.location.href = "/login");
  const handleLearnMore = () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className={styles.hero}>
      <div
        className={styles.heroContent}
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        <div className={styles.badge}>✨ Track your finances with ease</div>
        <h1 className={styles.title}>
          Take Control of Your <br />
          <span className={styles.gradientText}>Financial Future</span>
        </h1>
        <p className={styles.subtitle}>
          A powerful expense tracker that helps you monitor spending, categorize transactions with AI, and gain insights into your financial habits.
        </p>
        <div className={styles.ctaGroup}>
          <button onClick={handleGetStarted} className={styles.primaryButton}>
            Start Free Trial
          </button>
          <button onClick={handleLearnMore} className={styles.secondaryButton}>
            Learn More
          </button>
        </div>
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <strong>10K+</strong>
            <span>Active Users</span>
          </div>
          <div className={styles.statItem}>
            <strong>1M+</strong>
            <span>Transactions</span>
          </div>
          <div className={styles.statItem}>
            <strong>99.9%</strong>
            <span>Uptime</span>
          </div>
        </div>
      </div>

      <div
        className={styles.heroVisual}
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateX(0)" : "translateX(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s"
        }}
      >
        <div className="relative w-full max-w-[500px] aspect-[4/3] z-10">
          {/* Main Dashboard Card */}
          <div className="absolute inset-0 bg-[rgba(22,30,46,0.9)] backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 h-2 bg-white/5 rounded max-w-[120px] ml-4" />
            </div>

            {/* Body */}
            <div className="p-6 flex-1 flex gap-6">
              {/* Sidebar */}
              <div className="w-[60px] flex flex-col gap-4">
                <div className="h-10 rounded-lg bg-indigo-500/20" />
                <div className="h-2.5 w-4/5 rounded bg-white/5" />
                <div className="h-2.5 w-3/5 rounded bg-white/5" />
                <div className="h-2.5 w-[70%] rounded bg-white/5" />
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col gap-6">
                {/* Chart Area */}
                <div className="flex-1 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-xl border border-white/5 relative overflow-hidden">
                  {/* SVG Chart Line */}
                  <svg width="100%" height="100%" preserveAspectRatio="none" className="absolute bottom-0">
                    <path d="M0 100 Q 50 20 100 60 T 200 80 T 300 30 L 300 150 L 0 150 Z" fill="url(#gradient)" opacity="0.4" />
                    <path d="M0 100 Q 50 20 100 60 T 200 80 T 300 30" stroke="#667eea" strokeWidth="3" fill="none" />
                    <defs>
                      <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#667eea" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Grid Items */}
                <div className="flex gap-3">
                  <div className="flex-1 h-15 bg-white/[0.03] rounded-[10px]" />
                  <div className="flex-1 h-15 bg-white/[0.03] rounded-[10px]" />
                  <div className="flex-1 h-15 bg-white/[0.03] rounded-[10px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Floating Card - Mobile App */}
          <div className="absolute -bottom-5 -right-5 w-[140px] h-60 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-[0_20px_40px_rgba(0,0,0,0.4)] z-20 p-3 flex flex-col gap-3 animate-float">
            <div className="h-1 w-2/5 bg-slate-700 rounded mx-auto" />
            <div className="h-15 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl" />
            <div className="flex-1 bg-white/5 rounded-xl" />
            <div className="flex-1 bg-white/5 rounded-xl" />
          </div>

          {/* Floating Element - Success Notification */}
          <div className="absolute top-10 -left-8 px-4 py-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.2)] z-20 flex items-center gap-3 text-slate-900 animate-float-delayed">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-lg">
              ✓
            </div>
            <div>
              <div className="text-xs font-bold">Payment Received</div>
              <div className="text-[0.65rem] text-slate-500">Just now</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


// Helper for intersection observer
const useScrollAnimation = () => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Unobserve after triggering once
          if (domRef.current) observer.unobserve(domRef.current);
        }
      });
    });

    const current = domRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  return [isVisible, domRef] as const;
};

// ... existing sub-components ...

const FeaturesSection = () => {
  const [isVisible, domRef] = useScrollAnimation();

  return (
    <section id="features" className={styles.features} ref={domRef}>
      <div className={styles.featuresContainer}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Everything You Need</h2>
          <p className={styles.sectionDesc}>
            Powerful features designed to help you understand and manage your finances better.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${styles.featureCard} ${isVisible ? styles.featureCardVisible : ''}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Trusted Section
const TrustedSection = () => (
  <section className={styles.trustedSection}>
    <div className={styles.trustedTitle}>TRUSTED BY FINANCE TEAMS AT</div>
    <div className={styles.trustedLogos}>
      {[
        { name: "TechCorp", icon: "💎" },
        { name: "FinFlow", icon: "🌊" },
        { name: "BankIO", icon: "🏦" },
        { name: "Monetize", icon: "💵" },
        { name: "ScaleUp", icon: "📈" }
      ].map((company) => (
        <div key={company.name} className={styles.trustedLogo}>
          <span>{company.icon}</span>
          <span>{company.name}</span>
        </div>
      ))}
    </div>
  </section>
);

const CTASection = () => {
  const [isVisible, domRef] = useScrollAnimation();

  return (
    <section className={styles.ctaSection} ref={domRef}>
      <div
        className={`${styles.ctaCard} ${isVisible ? styles.featureCardVisible : ''}`}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s ease'
        }}
      >
        <h2 className={styles.sectionTitle}>Ready to Start?</h2>
        <p className={styles.sectionDesc} style={{ marginBottom: "2rem" }}>
          Join thousands of users who are already tracking their expenses with ease.
        </p>
        <button
          onClick={() => window.location.href = "/login"}
          className={styles.primaryButton}
        >
          Get Started Now
        </button>
      </div>
    </section>
  );
};

const Footer = () => (
  <div className="border-t border-white/10 bg-[#0b0f19] w-full">
    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <div className={styles.footerLogo}>💰 ExpenseTracker</div>
        <div className={styles.footerTagline}>
          Take control of your financial future.
        </div>
      </div>
      <div className={styles.footerCopyright}>
        © 2025 ExpenseTracker. All rights reserved.
      </div>
    </footer>
  </div>
);

export default function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className={styles.container}>
      <Navbar />
      <HeroSection isLoaded={isLoaded} />
      <TrustedSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
}