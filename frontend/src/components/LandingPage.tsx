import { useEffect, useState } from "react";
type Feature = {
  title: string;
  description: string;
  icon: string;
};

const features: Feature[] = [
  {
    title: "Smart Import",
    description: "Automatically import transactions from multiple sources including CSV, PDF, and Excel files.",
    icon: "📁",
  },
  {
    title: "AI-Powered Categorization",
    description: "Let our AI automatically categorize your transactions with intelligent suggestions.",
    icon: "🤖",
  },
  {
    title: "Rich Analytics",
    description: "Gain insights with beautiful charts and reports about your spending patterns.",
    icon: "📊",
  },
  {
    title: "Custom Categories",
    description: "Create your own categories and subcategories to match your financial needs.",
    icon: "🏷️",
  },
  {
    title: "Review Queue",
    description: "Easily review and verify uncategorized transactions with bulk actions.",
    icon: "✅",
  },
  {
    title: "Multi-Account Support",
    description: "Track all your accounts - bank accounts, credit cards, and cash in one place.",
    icon: "💳",
  },
];

function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleGetStarted = () => {
    window.location.href = "/login";
  };

  const handleLearnMore = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
    }}>
      {/* Navigation */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "rgba(15, 23, 42, 0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border-color)",
        zIndex: 1000,
        padding: "1rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "1.5rem",
          fontWeight: 700,
        }}>
          <span>💰</span>
          <span style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ExpenseTracker
          </span>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={handleLearnMore}
            style={{
              background: "transparent",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Features
          </button>
          <button
            onClick={handleGetStarted}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              color: "white",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        padding: "6rem 2rem 4rem",
        maxWidth: "1200px",
        margin: "0 auto",
        gap: "4rem",
        flexDirection: "row",
      }}>
        <div style={{ flex: 1, opacity: isLoaded ? 1 : 0, transform: isLoaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.6s ease" }}>
          <div style={{
            display: "inline-block",
            padding: "0.25rem 0.75rem",
            background: "rgba(102, 126, 234, 0.1)",
            color: "#667eea",
            borderRadius: "1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            marginBottom: "1rem",
          }}>
            ✨ Track your finances with ease
          </div>
          <h1 style={{
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "1.5rem",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Take Control of Your<br />Financial Future
          </h1>
          <p style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom: "2rem",
          }}>
            A powerful expense tracker that helps you monitor spending, categorize transactions with AI, and gain insights into your financial habits. Import from any source and start tracking today.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button
              onClick={handleGetStarted}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                color: "white",
                padding: "0.875rem 2rem",
                borderRadius: "0.75rem",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
              }}
            >
              Start Free Trial
            </button>
            <button
              onClick={handleLearnMore}
              style={{
                background: "transparent",
                border: "2px solid var(--border-color)",
                color: "var(--text-secondary)",
                padding: "0.875rem 2rem",
                borderRadius: "0.75rem",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              Learn More
            </button>
          </div>
          <div style={{ marginTop: "2rem", display: "flex", gap: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            <div>
              <strong style={{ color: "var(--text-primary)", fontSize: "1.25rem" }}>10K+</strong>
              <br />Active Users
            </div>
            <div>
              <strong style={{ color: "var(--text-primary)", fontSize: "1.25rem" }}>1M+</strong>
              <br />Transactions Tracked
            </div>
            <div>
              <strong style={{ color: "var(--text-primary)", fontSize: "1.25rem" }}>99.9%</strong>
              <br />Uptime
            </div>
          </div>
        </div>

        {/* Hero Image/Video Placeholder */}
        <div style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateX(0)" : "translateX(20px)",
          transition: "all 0.6s ease 0.2s",
        }}>
          <div style={{
            position: "relative",
            width: "100%",
            maxWidth: "500px",
            aspectRatio: "4/3",
            background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
            borderRadius: "1.5rem",
            border: "2px solid var(--border-color)",
            overflow: "hidden",
          }}>
            {/* Placeholder for App Screenshot or Demo Video */}
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-secondary)",
            }}>
              <div style={{
                textAlign: "center",
                color: "var(--text-muted)",
              }}>
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="10" y="10" width="100" height="100" rx="12" strokeDasharray="8 4" />
                  <path d="M35 50 L50 65 L85 35" stroke="#667eea" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p style={{ marginTop: "1rem", fontSize: "1rem" }}>App Preview</p>
                <p style={{ fontSize: "0.875rem" }}>Demo video or screenshot coming soon</p>
              </div>
            </div>

            {/* Floating Elements */}
            <div style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              boxShadow: "0 10px 30px rgba(102, 126, 234, 0.3)",
              animation: "float 3s ease-in-out infinite",
            }}>
              💰
            </div>
            <div style={{
              position: "absolute",
              bottom: -15,
              left: -15,
              width: "60px",
              height: "60px",
              background: "var(--bg-card)",
              borderRadius: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              border: "2px solid var(--border-color)",
              animation: "float 3s ease-in-out infinite 1.5s",
            }}>
              📊
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: "6rem 2rem",
        background: "var(--bg-secondary)",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 700,
              marginBottom: "1rem",
            }}>
              Everything You Need to Track Your Expenses
            </h2>
            <p style={{
              fontSize: "1.125rem",
              color: "var(--text-secondary)",
              maxWidth: "600px",
              margin: "0 auto",
            }}>
              Powerful features designed to help you understand and manage your finances better.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2rem",
          }}>
            {features.map((feature, index) => (
              <div
                key={feature.title}
                style={{
                  padding: "2rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "1rem",
                  transition: "all 0.3s ease",
                  opacity: 0,
                  transform: "translateY(20px)",
                }}
                className="feature-card"
                data-index={index}
              >
                <div style={{
                  width: "60px",
                  height: "60px",
                  background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                  borderRadius: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  marginBottom: "1.5rem",
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: "6rem 2rem",
        textAlign: "center",
      }}>
        <div style={{
          maxWidth: "800px",
          margin: "0 auto",
          background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
          border: "2px solid var(--border-color)",
          borderRadius: "2rem",
          padding: "3rem",
        }}>
          <h2 style={{
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            fontWeight: 700,
            marginBottom: "1rem",
          }}>
            Ready to Take Control of Your Finances?
          </h2>
          <p style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            marginBottom: "2rem",
          }}>
            Join thousands of users who are already tracking their expenses with ease.
          </p>
          <button
            onClick={handleGetStarted}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              color: "white",
              padding: "1rem 2.5rem",
              borderRadius: "0.75rem",
              cursor: "pointer",
              fontSize: "1.125rem",
              fontWeight: 600,
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            }}
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "3rem 2rem",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-color)",
        textAlign: "center",
      }}>
        <div style={{ marginBottom: "1rem", fontSize: "1.5rem", fontWeight: 700 }}>
          💰 ExpenseTracker
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          © 2025 ExpenseTracker. All rights reserved.
        </p>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 40px rgba(102, 126, 234, 0.15);
          border-color: rgba(102, 126, 234, 0.3);
        }

        @media (max-width: 768px) {
          nav {
            padding: 1rem;
          }

          section:first-of-type {
            flex-direction: column;
            text-align: center;
            gap: 2rem;
            padding-top: 8rem;
          }

          div[style*="display: flex"][style*="gap: 2rem"] {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

export default LandingPage;