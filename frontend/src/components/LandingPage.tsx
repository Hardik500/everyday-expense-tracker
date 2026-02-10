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
        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: "500px",
          aspectRatio: "4/3",
          zIndex: 10
        }}>
          {/* Main Dashboard Card */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(22, 30, 46, 0.8)",
            backdropFilter: "blur(20px)",
            borderRadius: "1.5rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Header */}
            <div style={{
              padding: "1rem 1.5rem",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              </div>
              <div style={{
                flex: 1,
                height: 8,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 4,
                maxWidth: 120,
                marginLeft: "1rem"
              }} />
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem", flex: 1, display: "flex", gap: "1.5rem" }}>
              {/* Sidebar */}
              <div style={{ width: 60, display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ height: 40, borderRadius: 8, background: "rgba(102, 126, 234, 0.2)" }} />
                <div style={{ height: 10, width: "80%", borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ height: 10, width: "60%", borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ height: 10, width: "70%", borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
              </div>

              {/* Main Content Area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Chart Area */}
                <div style={{
                  flex: 1,
                  background: "linear-gradient(180deg, rgba(102, 126, 234, 0.05) 0%, transparent 100%)",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.05)",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  {/* SVG Chart Line */}
                  <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0 }}>
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
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div style={{ flex: 1, height: 60, background: "rgba(255,255,255,0.03)", borderRadius: 10 }} />
                  <div style={{ flex: 1, height: 60, background: "rgba(255,255,255,0.03)", borderRadius: 10 }} />
                  <div style={{ flex: 1, height: 60, background: "rgba(255,255,255,0.03)", borderRadius: 10 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Floating Card - Mobile App */}
          <div style={{
            position: "absolute",
            bottom: -20,
            right: -20,
            width: 140,
            height: 240,
            background: "#0f172a",
            borderRadius: 20,
            border: "4px solid #1e293b",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            zIndex: 20,
            animation: "float 6s ease-in-out infinite",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem"
          }}>
            <div style={{ height: 4, width: "40%", background: "#334155", borderRadius: 2, margin: "0 auto" }} />
            <div style={{ height: 60, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: 12 }} />
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 12 }} />
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 12 }} />
          </div>

          {/* Floating Element - Success Notification */}
          <div style={{
            position: "absolute",
            top: 40,
            left: -30,
            padding: "0.75rem 1rem",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            animation: "float 5s ease-in-out infinite 1s",
            color: "#0f172a"
          }}>
            <div style={{
              width: 32,
              height: 32,
              background: "#10b981",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "1.2rem"
            }}>✓</div>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>Payment Received</div>
              <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Just now</div>
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
  <footer className={styles.footer}>
    <div className={styles.footerLogo}>💰 ExpenseTracker</div>
    <p>© 2025 ExpenseTracker. All rights reserved.</p>
  </footer>
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