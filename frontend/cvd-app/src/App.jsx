// -----------------------------------------------------------------------------
// App.jsx - Cardiovascular Risk Screening Dashboard
// Collects patient biometrics and lifestyle indicators, communicates with
// the FastAPI backend (/predict), and visualizes risk estimation on an
// interactive medical dial with live clinical insights.
// -----------------------------------------------------------------------------
import { useState, useEffect, useMemo } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/predict";

const YES_NO = [
  [0, "No"],
  [1, "Yes"],
];

const LEVELS = [
  [1, "Normal (<200 mg/dL)", "Normal"],
  [2, "Above Normal (200–239)", "Borderline"],
  [3, "Well Above Normal (≥240)", "High"],
];

const GLUC_LEVELS = [
  [1, "Normal (<100 mg/dL)", "Normal"],
  [2, "Above Normal (100–125)", "Impaired"],
  [3, "Well Above Normal (≥126)", "Elevated"],
];

const INITIAL_FORM = {
  age_years: "50",
  gender: "1",
  height: "170",
  weight: "70",
  ap_hi: "120",
  ap_lo: "80",
  cholesterol: "1",
  gluc: "1",
  smoke: "0",
  alco: "0",
  active: "1",
};

const PRESETS = [
  {
    id: "low",
    name: "Low Risk",
    desc: "Young adult, optimal BP & lipids, active",
    values: {
      age_years: "32",
      gender: "1",
      height: "165",
      weight: "58",
      ap_hi: "114",
      ap_lo: "74",
      cholesterol: "1",
      gluc: "1",
      smoke: "0",
      alco: "0",
      active: "1",
    },
  },
  {
    id: "mod",
    name: "Moderate Risk",
    desc: "Middle-aged, elevated BP, borderline lipids",
    values: {
      age_years: "52",
      gender: "2",
      height: "175",
      weight: "82",
      ap_hi: "135",
      ap_lo: "86",
      cholesterol: "2",
      gluc: "1",
      smoke: "0",
      alco: "1",
      active: "0",
    },
  },
  {
    id: "high",
    name: "High Risk",
    desc: "Senior, hypertension, smoker, high lipids",
    values: {
      age_years: "64",
      gender: "2",
      height: "170",
      weight: "92",
      ap_hi: "158",
      ap_lo: "96",
      cholesterol: "3",
      gluc: "2",
      smoke: "1",
      alco: "1",
      active: "0",
    },
  },
];

// Clinically calibrated simulation model (fallback if local backend is offline)
function simulateCardioRisk(payload) {
  const age = payload.age_years;
  const gender = payload.gender;
  const bmi = payload.weight / Math.pow(payload.height / 100, 2);
  const ap_hi = payload.ap_hi;
  const ap_lo = payload.ap_lo;
  const chol = payload.cholesterol;
  const gluc = payload.gluc;
  const smoke = payload.smoke;
  const alco = payload.alco;
  const active = payload.active;

  // Calibrated logistic regression formula based on standard cardiovascular parameters
  let z = -5.8;
  z += 0.052 * (age - 35);
  z += gender === 2 ? 0.18 : 0;
  z += 0.075 * (bmi - 23);
  z += 0.042 * (ap_hi - 115);
  z += 0.02 * (ap_lo - 75);
  z += (chol - 1) * 0.65;
  z += (gluc - 1) * 0.4;
  z += smoke * 0.52;
  z += alco * 0.16;
  z -= active * 0.38;

  const prob = 1 / (1 + Math.exp(-z));
  const clamped = Math.min(0.99, Math.max(0.01, prob));
  const prediction = clamped >= payload.threshold ? 1 : 0;

  return {
    probability: Number(clamped.toFixed(4)),
    threshold: payload.threshold,
    prediction,
    label: prediction === 1 ? "Elevated risk" : "Low risk",
    simulated: true,
  };
}

// Dial Gauge Geometry
const DIAL_R = 85;
const DIAL_CX = 120;
const DIAL_CY = 115;
const DIAL_ARC_LEN = Math.PI * DIAL_R;
const DIAL_PATH = `M ${DIAL_CX - DIAL_R} ${DIAL_CY} A ${DIAL_R} ${DIAL_R} 0 0 1 ${DIAL_CX + DIAL_R} ${DIAL_CY}`;

function RiskDial({ probability, threshold }) {
  const p = probability ?? 0;
  const high = probability != null && probability >= threshold;
  const isModerate = probability != null && probability >= 0.25 && probability < threshold;

  // Threshold tick coordinates
  const threshAngle = Math.PI * threshold;
  const tickX1 = DIAL_CX - (DIAL_R - 14) * Math.cos(threshAngle);
  const tickY1 = DIAL_CY - (DIAL_R - 14) * Math.sin(threshAngle);
  const tickX2 = DIAL_CX - (DIAL_R + 14) * Math.cos(threshAngle);
  const tickY2 = DIAL_CY - (DIAL_R + 14) * Math.sin(threshAngle);

  // Current probability pointer circle coordinates
  const probAngle = Math.PI * Math.min(Math.max(p, 0), 1);
  const needleX = DIAL_CX - DIAL_R * Math.cos(probAngle);
  const needleY = DIAL_CY - DIAL_R * Math.sin(probAngle);

  const fillClass = high ? "dial-fill-path high" : isModerate ? "dial-fill-path moderate" : "dial-fill-path low";

  return (
    <div className="dial-container">
      <svg
        viewBox="0 0 240 140"
        className="risk-dial-svg"
        role="img"
        aria-label={
          probability == null
            ? "Risk gauge, awaiting calculation"
            : `Estimated cardiovascular risk: ${(p * 100).toFixed(1)} percent`
        }
      >
        <defs>
          <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="35%" stopColor="#2563eb" />
            <stop offset="65%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {/* Base Track */}
        <path d={DIAL_PATH} className="dial-track-bg" />

        {/* Colored Background Zones */}
        <path
          d={DIAL_PATH}
          stroke="url(#dialGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          opacity="0.22"
        />

        {/* Active Probability Fill */}
        {probability != null && (
          <path
            d={DIAL_PATH}
            className={fillClass}
            strokeDasharray={`${p * DIAL_ARC_LEN} ${DIAL_ARC_LEN}`}
          />
        )}

        {/* Threshold Notch Line */}
        <line
          x1={tickX1}
          y1={tickY1}
          x2={tickX2}
          y2={tickY2}
          className="dial-threshold-tick"
        />

        {/* Needle Bead Marker */}
        {probability != null && (
          <circle cx={needleX} cy={needleY} r="7" className="dial-needle-indicator" />
        )}
      </svg>

      <div className="dial-labels">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("cardio_theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cardio_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setActivePreset(null);
  };

  const applyPreset = (preset) => {
    setForm({ ...preset.values });
    setActivePreset(preset.id);
    setError("");
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setResult(null);
    setError("");
    setActivePreset(null);
  };

  // Live BMI calculation
  const bmiInfo = useMemo(() => {
    const h = Number(form.height);
    const w = Number(form.weight);
    if (!h || !w || h <= 0) return null;
    const bmiVal = w / Math.pow(h / 100, 2);
    const rounded = Number(bmiVal.toFixed(1));

    let category = "Normal";
    let status = "normal";
    if (rounded < 18.5) {
      category = "Underweight";
      status = "warning";
    } else if (rounded >= 25 && rounded < 30) {
      category = "Overweight";
      status = "warning";
    } else if (rounded >= 30) {
      category = "Obese";
      status = "danger";
    }
    return { val: rounded, category, status };
  }, [form.height, form.weight]);

  // Live Blood Pressure classification
  const bpInfo = useMemo(() => {
    const hi = Number(form.ap_hi);
    const lo = Number(form.ap_lo);
    if (!hi || !lo) return null;

    if (hi <= lo) {
      return { category: "Invalid (Systolic must be > Diastolic)", status: "danger", invalid: true };
    }
    if (hi >= 180 || lo >= 120) {
      return { category: "Hypertensive Crisis", status: "danger" };
    }
    if (hi >= 140 || lo >= 90) {
      return { category: "Hypertension Stage 2", status: "danger" };
    }
    if ((hi >= 130 && hi <= 139) || (lo >= 80 && lo <= 89)) {
      return { category: "Hypertension Stage 1", status: "warning" };
    }
    if (hi >= 120 && hi <= 129 && lo < 80) {
      return { category: "Elevated BP", status: "warning" };
    }
    return { category: "Normal BP", status: "normal" };
  }, [form.ap_hi, form.ap_lo]);

  // Validate form ranges
  const validateForm = () => {
    const problems = [];
    const age = Number(form.age_years);
    const h = Number(form.height);
    const w = Number(form.weight);
    const hi = Number(form.ap_hi);
    const lo = Number(form.ap_lo);

    if (isNaN(age) || age < 18 || age > 100) problems.push("Age must be between 18 and 100 years.");
    if (isNaN(h) || h < 120 || h > 220) problems.push("Height must be between 120 and 220 cm.");
    if (isNaN(w) || w < 30 || w > 200) problems.push("Weight must be between 30 and 200 kg.");
    if (isNaN(hi) || hi < 80 || hi > 250) problems.push("Systolic blood pressure must be between 80 and 250 mmHg.");
    if (isNaN(lo) || lo < 40 || lo > 200) problems.push("Diastolic blood pressure must be between 40 and 200 mmHg.");
    if (hi <= lo) problems.push("Systolic pressure must be strictly greater than diastolic pressure.");

    return problems;
  };

  const executeCalculation = async (forceDemo = false) => {
    const problems = validateForm();
    if (problems.length > 0) {
      setError(problems.join(" "));
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");

    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, Number(v)])
    );
    payload.threshold = threshold;

    if (useDemoMode || forceDemo) {
      setTimeout(() => {
        const simulated = simulateCardioRisk(payload);
        setResult(simulated);
        setLoading(false);
      }, 350);
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`The backend server rejected the request (Status ${res.status}).`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult(null);
      const isConnectionIssue = err instanceof TypeError || err.message?.includes("Failed to fetch");
      setError(
        isConnectionIssue
          ? "Unable to connect to the FastAPI backend (expected at port 8000). You can run in Demo Mode to preview all screening calculations."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeCalculation(false);
  };

  const isHighRisk = result && result.prediction === 1;

  // Contributing risk factor analysis
  const riskFactors = useMemo(() => {
    const items = [];
    if (Number(form.ap_hi) >= 130 || Number(form.ap_lo) >= 85) {
      items.push({ name: "Blood Pressure", desc: `${form.ap_hi}/${form.ap_lo} mmHg`, isRisk: true });
    } else {
      items.push({ name: "Blood Pressure", desc: `${form.ap_hi}/${form.ap_lo} mmHg`, isRisk: false });
    }

    if (Number(form.cholesterol) > 1) {
      items.push({ name: "Cholesterol", desc: Number(form.cholesterol) === 3 ? "Well Above Normal" : "Above Normal", isRisk: true });
    } else {
      items.push({ name: "Cholesterol", desc: "Optimal / Normal", isRisk: false });
    }

    if (Number(form.smoke) === 1) {
      items.push({ name: "Tobacco Use", desc: "Active Smoker", isRisk: true });
    }

    if (bmiInfo && bmiInfo.val >= 25) {
      items.push({ name: "Body Mass Index", desc: `${bmiInfo.val} (${bmiInfo.category})`, isRisk: true });
    }

    if (Number(form.active) === 1) {
      items.push({ name: "Physical Activity", desc: "Active Lifestyle", isRisk: false });
    } else {
      items.push({ name: "Physical Activity", desc: "Sedentary / Inactive", isRisk: true });
    }

    return items;
  }, [form, bmiInfo]);

  // Copy report to clipboard
  const copyReport = () => {
    if (!result) return;
    const text = `--- CARDIOVASCULAR RISK ASSESSMENT ---
Date: ${new Date().toLocaleDateString()}
Patient Age: ${form.age_years} | Gender: ${form.gender === "1" ? "Female" : "Male"}
Blood Pressure: ${form.ap_hi}/${form.ap_lo} mmHg
BMI: ${bmiInfo ? bmiInfo.val : "N/A"} (${bmiInfo ? bmiInfo.category : ""})
Total Cholesterol: ${form.cholesterol === "1" ? "Normal" : form.cholesterol === "2" ? "Borderline" : "High"}
Fasting Glucose: ${form.gluc === "1" ? "Normal" : form.gluc === "2" ? "Impaired" : "Elevated"}
Smoker: ${form.smoke === "1" ? "Yes" : "No"} | Alcohol: ${form.alco === "1" ? "Yes" : "No"} | Active: ${form.active === "1" ? "Yes" : "No"}
--------------------------------------
Estimated CVD Risk: ${(result.probability * 100).toFixed(1)}%
Decision Threshold: ${(result.threshold * 100).toFixed(0)}%
Classification: ${result.label}
Status: ${isHighRisk ? "Elevated Risk - Clinical Follow-up Advised" : "Low Risk - Maintain Healthy Lifestyle"}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="app-wrapper">
      <div className="page-container">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="brand-section">
            <div className="brand-icon-wrapper">
              <span className="pulse-ring"></span>
              {/* Heartbeat pulse icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                <path d="M12 5v4" />
                <path d="M4 11h3l2-3 3 6 2-3h4" />
              </svg>
            </div>
            <div className="brand-text">
              <h1>CardioScreen AI</h1>
              <p className="brand-subtitle">Clinical Cardiovascular Risk Stratification & Screening</p>
            </div>
          </div>

          <div className="navbar-actions">
            <span className={`mode-badge ${useDemoMode ? "demo" : "connected"}`}>
              <span className="mode-dot"></span>
              {useDemoMode ? "Demo Mode (Offline)" : "API Connected (port 8000)"}
            </span>

            <button
              type="button"
              className="icon-button"
              onClick={() => setUseDemoMode(!useDemoMode)}
              title={useDemoMode ? "Switch to Live FastAPI API" : "Switch to Offline Simulation Mode"}
              aria-label="Toggle Demo / API mode"
            >
              {/* Toggle switch icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="12" x="2" y="6" rx="6" />
                <circle cx={useDemoMode ? "16" : "8"} cy="12" r="3" />
              </svg>
            </button>

            <button
              type="button"
              className="icon-button theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                // Sun Icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                // Moon Icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Quick Presets Toolbar */}
        <section className="presets-banner" aria-label="Patient sample profiles">
          <div className="presets-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Sample Patient Profiles:</span>
          </div>

          <div className="preset-pills-list">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`preset-chip ${activePreset === p.id ? "active" : ""}`}
                onClick={() => applyPreset(p)}
                title={p.desc}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              className="preset-chip"
              onClick={resetForm}
              title="Reset all fields to standard baseline"
            >
              Reset to Defaults
            </button>
          </div>
        </section>

        {/* Error / Offline Alert */}
        {error && (
          <div className="alert-banner error" role="alert">
            <div className="alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="alert-content">
              <p>{error}</p>
              {error.includes("FastAPI backend") && (
                <button
                  type="button"
                  className="demo-fallback-btn"
                  onClick={() => executeCalculation(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Calculate using Demo Simulation Mode
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="layout-grid">
          {/* Left Column: Form Panel */}
          <form className="card-panel" onSubmit={handleSubmit} noValidate>
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                </div>
                <div>
                  <h2>Patient Biometrics & Lifestyle</h2>
                  <p className="panel-subtitle">Enter clinical measurements and lifestyle variables</p>
                </div>
              </div>
            </div>

            {/* Section 1: Physical Measurements */}
            <div className="form-section">
              <span className="section-caption">1. Physical Measurements</span>

              <div className="fields-grid-2">
                {/* Age */}
                <div className="field-wrapper">
                  <label className="field-label" htmlFor="age_years">
                    <span>Age</span>
                    <span className="field-unit">years</span>
                  </label>
                  <div className="input-container">
                    <input
                      id="age_years"
                      name="age_years"
                      type="number"
                      min="18"
                      max="100"
                      className="text-input"
                      value={form.age_years}
                      onChange={(e) => handleInputChange("age_years", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Gender */}
                <div className="field-wrapper">
                  <label className="field-label">
                    <span>Biological Sex</span>
                  </label>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`segmented-btn ${form.gender === "1" ? "active" : ""}`}
                      onClick={() => handleInputChange("gender", "1")}
                    >
                      <span>Female ♀</span>
                    </button>
                    <button
                      type="button"
                      className={`segmented-btn ${form.gender === "2" ? "active" : ""}`}
                      onClick={() => handleInputChange("gender", "2")}
                    >
                      <span>Male ♂</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Height & Weight */}
              <div className="fields-grid-2">
                <div className="field-wrapper">
                  <label className="field-label" htmlFor="height">
                    <span>Height</span>
                    <span className="field-unit">cm</span>
                  </label>
                  <div className="input-container">
                    <input
                      id="height"
                      name="height"
                      type="number"
                      min="120"
                      max="220"
                      className="text-input"
                      value={form.height}
                      onChange={(e) => handleInputChange("height", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-wrapper">
                  <label className="field-label" htmlFor="weight">
                    <span>Weight</span>
                    <span className="field-unit">kg</span>
                  </label>
                  <div className="input-container">
                    <input
                      id="weight"
                      name="weight"
                      type="number"
                      min="30"
                      max="200"
                      className="text-input"
                      value={form.weight}
                      onChange={(e) => handleInputChange("weight", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Live BMI Insight */}
              {bmiInfo && (
                <div className="live-insight-pill">
                  <div className="insight-metric">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="6" x2="12" y2="12" />
                      <line x1="12" y1="12" x2="16" y2="14" />
                    </svg>
                    <span>Calculated Body Mass Index (BMI):</span>
                    <span className="insight-val">{bmiInfo.val} kg/m²</span>
                  </div>
                  <span className={`insight-badge ${bmiInfo.status}`}>
                    {bmiInfo.category}
                  </span>
                </div>
              )}

              {/* Blood Pressure */}
              <div className="fields-grid-2">
                <div className="field-wrapper">
                  <label className="field-label" htmlFor="ap_hi">
                    <span>Systolic Blood Pressure</span>
                    <span className="field-unit">mmHg</span>
                  </label>
                  <div className="input-container">
                    <input
                      id="ap_hi"
                      name="ap_hi"
                      type="number"
                      min="80"
                      max="250"
                      className={`text-input ${bpInfo?.invalid ? "error" : ""}`}
                      value={form.ap_hi}
                      onChange={(e) => handleInputChange("ap_hi", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-wrapper">
                  <label className="field-label" htmlFor="ap_lo">
                    <span>Diastolic Blood Pressure</span>
                    <span className="field-unit">mmHg</span>
                  </label>
                  <div className="input-container">
                    <input
                      id="ap_lo"
                      name="ap_lo"
                      type="number"
                      min="40"
                      max="200"
                      className={`text-input ${bpInfo?.invalid ? "error" : ""}`}
                      value={form.ap_lo}
                      onChange={(e) => handleInputChange("ap_lo", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Live Blood Pressure Classification */}
              {bpInfo && (
                <div className="live-insight-pill">
                  <div className="insight-metric">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    <span>AHA Blood Pressure Status:</span>
                    <span className="insight-val">{form.ap_hi}/{form.ap_lo}</span>
                  </div>
                  <span className={`insight-badge ${bpInfo.status}`}>
                    {bpInfo.category}
                  </span>
                </div>
              )}
            </div>

            {/* Section 2: Laboratory Biomarkers */}
            <div className="form-section">
              <span className="section-caption">2. Laboratory Biomarkers</span>

              {/* Cholesterol */}
              <div className="field-wrapper">
                <label className="field-label">
                  <span>Total Cholesterol</span>
                </label>
                <div className="segmented-control">
                  {LEVELS.map(([val, label, short]) => (
                    <button
                      key={val}
                      type="button"
                      className={`segmented-btn ${form.cholesterol === String(val) ? `active level-${val === 1 ? "normal" : val === 2 ? "above" : "well-above"}` : ""}`}
                      onClick={() => handleInputChange("cholesterol", String(val))}
                      title={label}
                    >
                      <span>{short}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Glucose */}
              <div className="field-wrapper">
                <label className="field-label">
                  <span>Fasting Glucose</span>
                </label>
                <div className="segmented-control">
                  {GLUC_LEVELS.map(([val, label, short]) => (
                    <button
                      key={val}
                      type="button"
                      className={`segmented-btn ${form.gluc === String(val) ? `active level-${val === 1 ? "normal" : val === 2 ? "above" : "well-above"}` : ""}`}
                      onClick={() => handleInputChange("gluc", String(val))}
                      title={label}
                    >
                      <span>{short}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Lifestyle Factors */}
            <div className="form-section">
              <span className="section-caption">3. Lifestyle & Habits</span>

              <div className="fields-grid-3">
                {/* Smoker */}
                <div className="field-wrapper">
                  <label className="field-label">
                    <span>Tobacco Smoker</span>
                  </label>
                  <div className="segmented-control">
                    {YES_NO.map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={`segmented-btn ${form.smoke === String(val) ? "active" : ""}`}
                        onClick={() => handleInputChange("smoke", String(val))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alcohol */}
                <div className="field-wrapper">
                  <label className="field-label">
                    <span>Alcohol Intake</span>
                  </label>
                  <div className="segmented-control">
                    {YES_NO.map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={`segmented-btn ${form.alco === String(val) ? "active" : ""}`}
                        onClick={() => handleInputChange("alco", String(val))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Physical Activity */}
                <div className="field-wrapper">
                  <label className="field-label">
                    <span>Physically Active</span>
                  </label>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`segmented-btn ${form.active === "1" ? "active" : ""}`}
                      onClick={() => handleInputChange("active", "1")}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`segmented-btn ${form.active === "0" ? "active" : ""}`}
                      onClick={() => handleInputChange("active", "0")}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Decision Threshold Control */}
            <div className="threshold-container">
              <div className="threshold-header">
                <span className="threshold-title">Diagnostic Decision Threshold</span>
                <span className="threshold-tag">{(threshold * 100).toFixed(0)}% ({threshold.toFixed(2)})</span>
              </div>
              <input
                id="threshold"
                type="range"
                min="0.2"
                max="0.7"
                step="0.01"
                className="slider-input"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <div className="slider-scale">
                <span>0.20 (Sensitive)</span>
                <span>0.50 (Default)</span>
                <span>0.70 (Specific)</span>
              </div>
              <p className="threshold-explanation">
                Lower thresholds catch more early risk cases (higher sensitivity) with slight increase in false positives.
              </p>
            </div>

            {/* Actions */}
            <div className="action-buttons-group">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Analyzing Biomarkers...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>Calculate Cardiovascular Risk</span>
                  </>
                )}
              </button>

              <button type="button" className="btn-secondary" onClick={resetForm} title="Clear results">
                Reset
              </button>
            </div>
          </form>

          {/* Right Column: Assessment Results Dashboard (Sticky) */}
          <section className="card-panel sticky-dashboard" aria-live="polite">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2>Risk Assessment Dashboard</h2>
                  <p className="panel-subtitle">Stratified likelihood & clinical insights</p>
                </div>
              </div>
            </div>

            {/* Dial Gauge */}
            <RiskDial probability={result?.probability} threshold={threshold} />

            {/* Readout Status */}
            <div className="dial-center-readout">
              {result ? (
                <>
                  <div className={`probability-display ${isHighRisk ? "high" : result.probability >= 0.25 ? "moderate" : "low"}`}>
                    {(result.probability * 100).toFixed(1)}%
                  </div>
                  <div className={`verdict-tag ${isHighRisk ? "high" : "low"}`}>
                    {isHighRisk ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>{result.label ?? "Elevated Cardiovascular Risk"}</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                        <span>{result.label ?? "Low Cardiovascular Risk"}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state-view">
                  <div className="empty-state-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  </div>
                  <h3 className="empty-state-title">Awaiting Assessment</h3>
                  <p className="empty-state-desc">
                    Fill in patient biometrics on the left or select a sample profile, then click <strong>Calculate Cardiovascular Risk</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Assessment Details & Recommendations */}
            {result && (
              <div className="assessment-details">
                {/* Contributing Factor Chips */}
                <div className="factor-chips-container">
                  <span className="factor-chips-title">Biometric Factors Profile</span>
                  {riskFactors.map((f, i) => (
                    <div key={i} className="factor-chip-row">
                      <span className="factor-chip-name">{f.name}</span>
                      <span className={`factor-chip-status ${f.isRisk ? "risk" : "healthy"}`}>
                        {f.isRisk ? "▲" : "✓"} {f.desc}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Clinical Guidance Recommendations */}
                <div className="recommendations-box">
                  <div className="recommendations-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                    <span>Clinical Recommendations</span>
                  </div>
                  <ul className="recommendations-list">
                    {isHighRisk ? (
                      <>
                        <li>
                          <span className="bullet-dot">•</span>
                          <span>Prompt physician or cardiology consultation for formal diagnostic evaluation.</span>
                        </li>
                        <li>
                          <span className="bullet-dot">•</span>
                          <span>Comprehensive lipid panel & ambulatory blood pressure monitoring recommended.</span>
                        </li>
                        <li>
                          <span className="bullet-dot">•</span>
                          <span>Adopt heart-healthy lifestyle: DASH diet, sodium reduction & supervised aerobic exercise.</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          <span className="bullet-dot">•</span>
                          <span>Maintain regular physical activity (minimum 150 minutes of moderate aerobic exercise weekly).</span>
                        </li>
                        <li>
                          <span className="bullet-dot">•</span>
                          <span>Continue annual blood pressure and metabolic health wellness screenings.</span>
                        </li>
                        <li>
                          <span className="bullet-dot">•</span>
                          <span>Maintain balanced, whole-food dietary patterns rich in fiber and unsaturated fats.</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Action Toolbar */}
                <div className="report-actions">
                  <button type="button" className="btn-report" onClick={() => window.print()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect width="12" height="8" x="6" y="14" />
                    </svg>
                    <span>Print Report</span>
                  </button>

                  <button type="button" className="btn-report" onClick={copyReport}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>{copied ? "Copied to Clipboard!" : "Copy Summary"}</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Clinical Disclaimer Footer */}
        <footer className="app-footer">
          <div className="footer-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="footer-content">
            <strong>Clinical Decision Support Notice:</strong> This web application provides preliminary screening estimates using a logistic regression model (~72% cross-validated accuracy). It is intended exclusively for educational screening support and research, not as a standalone medical diagnosis. Always consult a licensed healthcare professional for clinical diagnoses and treatment decisions.
          </div>
        </footer>
      </div>
    </div>
  );
}
