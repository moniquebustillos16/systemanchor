import { useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "./api/axios";
import mainLogo from "./assets/main_logo.png";
import { schedulePrefetch } from "./lib/prefetch";
import { setAuthToken } from "./lib/auth";
import "./index.css";

function App() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/login", {
        email,
        password,
      });

      const { token, user } = response.data;

      setAuthToken(token, remember);
      const userStore = remember ? localStorage : sessionStorage;
      userStore.setItem("user", JSON.stringify(user));

      window.dispatchEvent(new Event("sa-auth-changed"));
      window.dispatchEvent(new Event("sa-permissions-refresh"));
      schedulePrefetch();
      navigate("/dashboard");
    } catch (error: any) {
      if (error.response) {
        setError(error.response.data.message || "Invalid email or password.");
      } else {
        setError("Unable to connect to server.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* ───────── BRAND SIDE ───────── */}
      <aside className="brand-side">
        <div className="bg-layers" aria-hidden="true">
          <div className="bg-base" />
          <div className="bg-mesh" />
          <div className="bg-grid" />
          <div className="bg-ring bg-ring--1" />
          <div className="bg-ring bg-ring--2" />
          <div className="bg-ring bg-ring--3" />
          <div className="bg-blob bg-blob--a" />
          <div className="bg-blob bg-blob--b" />
          <div className="bg-blob bg-blob--c" />

          <div className="bg-lines">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="bg-noise" />
        </div>

        <div className="brand-inner">
          <div className="brand-top">
            <div className="mark">
              <img src={mainLogo} alt="SystemAnchor" className="mark-logo" />
            </div>
            <span className="mark-label">SystemAnchor</span>
          </div>

          <div className="brand-hero">
            <p className="hero-kicker">Warehouse OS</p>
            <h1 className="hero-title">
              Clarity for every
              <em> aisle &amp; order.</em>
            </h1>
            <p className="hero-body">
              One platform for inventory, logistics, and operations — built for
              teams that move fast and stay precise.
            </p>
          </div>

          <ul className="brand-points">
            <li>
              <span className="point-icon">◇</span>
              Live stock across all locations
            </li>
            <li>
              <span className="point-icon">◇</span>
              Secure roles for every team
            </li>
          </ul>
        </div>

        <footer className="brand-foot">
          <span className="status-pip" />
          Production-ready  · Audit-friendly
        </footer>
      </aside>

      {/* ───────── FORM SIDE ───────── */}
      <main className="form-side">
        <div className="form-frame">
          <div className="form-card">
            <header className="form-header">
              <img src={mainLogo} alt="SystemAnchor" className="form-logo" />
              <h2>Welcome back</h2>
              <p>Sign in to your workspace</p>
            </header>

            <form onSubmit={handleLogin} noValidate className="auth-form">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  required
                />
              </div>

              <div className="field">
                <div className="field-head">
                  <label htmlFor="password">Password</label>
                  <a href="#" className="text-link">
                    Forgot?
                  </a>
                </div>

                <div className="field-affix">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="affix"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember this device</span>
              </label>

              {error && (
                <div className="error-banner" role="alert">
                  <span className="error-icon">!</span>
                  {error}
                </div>
              )}

              <button type="submit" className="cta" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="form-meta">
              <p>
                Demo ·
                <kbd>admin@systemanchor.com</kbd> /
                <kbd>SystemAnchor@123</kbd>
              </p>
            </div>
          </div>

          <p className="fine-print">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;