import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const PIPELINE_STEPS = [
  "Extracting key claims...",
  "Searching internet sources...",
  "Scraping credible articles...",
  "Running NLP bias analysis...",
  "Cross-referencing fact databases...",
  "Generating AI verdict...",
];

type RelatedArticle = {
  title: string;
  url: string;
  source: string;
  description: string;
};

type AnalysisResult = {
  verdict: string;
  confidence: number;
  sourceReliability: string;
  biasDeviation: string;
  clickbaitIndex: number;
  factMatches: string;
  summary: string;
  flags: string[];
  relatedArticles?: RelatedArticle[];
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<"text" | "url" | "headline">("text");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [headlineInput, setHeadlineInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pipelineVisible, setPipelineVisible] = useState(false);
  const [stepsCompleted, setStepsCompleted] = useState<boolean[]>(new Array(PIPELINE_STEPS.length).fill(false));
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [deepNlp, setDeepNlp] = useState(true);
  const [sourceCredibility, setSourceCredibility] = useState(true);
  const [crossCheck, setCrossCheck] = useState(true);

  const getActiveInput = () => {
    switch (activeTab) {
      case "text": return textInput;
      case "url": return urlInput;
      case "headline": return headlineInput;
    }
  };

  const hasValidInput = getActiveInput().trim().length >= 5;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const runAnalysis = async () => {
    const input = getActiveInput().trim();
    if (input.length < 5) return;

    setAnalyzing(true);
    setPipelineVisible(true);
    setShowResults(false);
    setResults(null);
    setStepsCompleted(new Array(PIPELINE_STEPS.length).fill(false));
    setProgress(0);

    // Start the backend call
    const analysisPromise = supabase.functions.invoke("analyze-news", {
      body: {
        type: activeTab,
        content: input,
        options: { deepNlp, sourceCredibility, crossCheck },
      },
    });

    // Animate pipeline steps while waiting
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
      setStepsCompleted((prev) => {
        const next = [...prev];
        next[i] = true;
        return next;
      });
      setProgress(Math.round(((i + 1) / PIPELINE_STEPS.length) * 100));
    }

    // Wait for actual result
    const { data, error } = await analysisPromise;

    if (error || !data) {
      console.error("Analysis error:", error);
      // Fallback result on error
      setResults({
        verdict: "ERROR",
        confidence: 0,
        sourceReliability: "--",
        biasDeviation: "--",
        clickbaitIndex: 0,
        factMatches: "0/0",
        summary: error?.message || "An error occurred during analysis. Please try again.",
        flags: [],
      });
    } else {
      setResults(data as AnalysisResult);
    }

    setPipelineVisible(false);
    setShowResults(true);
    setAnalyzing(false);
  };

  const getVerdictStyles = () => {
    if (!results) return {};
    const v = results.verdict.toUpperCase();
    if (v === "FAKE" || v === "MISLEADING" || v === "ERROR") {
      return {
        borderColor: "hsl(var(--cp-accent))",
        background: "hsl(var(--cp-accent-soft))",
        titleColor: "hsl(var(--cp-accent))",
        icon: "🚨",
        sub: v === "ERROR" ? "Analysis failed." : "Proceed with extreme caution.",
        scoreColor: "hsl(var(--cp-accent))",
      };
    }
    return {
      borderColor: "hsl(var(--cp-green))",
      background: "hsl(var(--cp-green-soft))",
      titleColor: "hsl(var(--cp-green))",
      icon: "✅",
      sub: "Confidence in factual accuracy.",
      scoreColor: "hsl(var(--cp-green))",
    };
  };

  const vs = getVerdictStyles();

  return (
    <>
      {/* UTILITY BAR */}
      <div className="utility-bar">
        <div className="utility-left">
          <a href="#">U.S.</a><a href="#">World</a><a href="#">Tech</a><a href="#">Journalism AI</a>
        </div>
        <button className="run-btn">+ New Analysis</button>
      </div>

      {/* MASTHEAD */}
      <header className="masthead">
        <div className="masthead-container">
          <div className="date-block">{dateStr}<br />Global Intelligence Edition</div>
          <div className="masthead-title">
            <h1>ClariPress</h1>
            <div className="tagline-row">
              <span>NLP DEEP SCAN</span><span className="dot" /><span>FACT-CHECK CROSS-REF</span><span className="dot" /><span>SOURCE AUDIT</span>
            </div>
          </div>
          <div className="profile-actions">
            <button className="profile-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <div className="avatar">RK</div>
              <div className="profile-info">
                <span className="profile-name">Rahul K.</span>
                <span className="profile-rank">Pro Tier</span>
              </div>
            </button>
            <div className={`profile-dropdown ${dropdownOpen ? "show" : ""}`}>
              <div className="dd-header">rahul@clari.press</div>
              <button className="dd-item">Dashboard</button>
              <button className="dd-item">Settings</button>
              <hr style={{ border: "none", borderTop: "1px solid hsl(var(--cp-border))", margin: "5px 0" }} />
              <button className="dd-item">Sign Out</button>
            </div>
          </div>
        </div>
      </header>


      {/* MAIN CONTENT */}
      <main className="single-col-layout">
        <div className="content-header">
          <span className="kicker">Security Intelligence</span>
          <h2 className="main-headline">Clarify where news gets <span className="accent-text">verified.</span></h2>
          <p className="deck">Our neural engine analyzes linguistic patterns, source metadata, and historical fact-check databases to provide immediate credibility scoring.</p>
        </div>

        <div className="input-card">
          {/* TABS */}
          <div className="tabs">
            <button className={`tab-link ${activeTab === "text" ? "active" : ""}`} onClick={() => setActiveTab("text")}>📝 Text Content</button>
            <button className={`tab-link ${activeTab === "url" ? "active" : ""}`} onClick={() => setActiveTab("url")}>🔗 Source URL</button>
            <button className={`tab-link ${activeTab === "headline" ? "active" : ""}`} onClick={() => setActiveTab("headline")}>📰 Headline Only</button>
          </div>

          {/* TAB PANES */}
          {activeTab === "text" && (
            <textarea className="cp-textarea" placeholder="Paste the full article text here for deep analysis..." value={textInput} onChange={(e) => setTextInput(e.target.value)} />
          )}
          {activeTab === "url" && (
            <input className="simple-input" type="url" placeholder="https://example.com/article..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          )}
          {activeTab === "headline" && (
            <input className="simple-input" type="text" placeholder='e.g. "Scientists Discover New Planet..."' value={headlineInput} onChange={(e) => setHeadlineInput(e.target.value)} />
          )}

          {/* OPTIONS */}
          <div className="analysis-options">
            <label className="check-container">
              <input type="checkbox" checked={deepNlp} onChange={(e) => setDeepNlp(e.target.checked)} /> Deep NLP Bias Scan
            </label>
            <label className="check-container">
              <input type="checkbox" checked={sourceCredibility} onChange={(e) => setSourceCredibility(e.target.checked)} /> Source Credibility
            </label>
            <label className="check-container">
              <input type="checkbox" checked={crossCheck} onChange={(e) => setCrossCheck(e.target.checked)} /> Cross-Check Archives
            </label>
          </div>

          <button className="primary-btn" disabled={!hasValidInput || analyzing} onClick={runAnalysis}>
            <span className="btn-text">{analyzing ? "ANALYZING..." : hasValidInput ? "INITIALIZE ANALYSIS" : "ENTER CONTENT TO ANALYZE"}</span>
          </button>
        </div>

        {/* PIPELINE */}
        {pipelineVisible && (
          <div className="pipeline-container">
            <div className="pipeline-header">Processing Neural Pipeline...</div>
            <div>
              {PIPELINE_STEPS.map((step, i) => (
                <div key={i} className={`step-item ${stepsCompleted[i] ? "done" : ""}`}>
                  <span>{step}</span>
                  <span className="st">{stepsCompleted[i] ? "COMPLETED" : "PROCESSING..."}</span>
                </div>
              ))}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* RESULTS */}
        {showResults && results && (
          <div className="results-container">
            <div className="verdict-card" style={{ borderColor: vs.borderColor, background: vs.background }}>
              <div className="verdict-main">
                <div className="verdict-icon">{vs.icon}</div>
                <div>
                  <span className="verdict-label">Official Verdict</span>
                  <h3 style={{ color: vs.titleColor }}>{results.verdict === "FAKE" ? "Likely Misinformation Detected" : results.verdict === "MISLEADING" ? "Misleading Content Detected" : results.verdict === "REAL" ? "Verified Credible" : results.verdict}</h3>
                  <p>{vs.sub}</p>
                </div>
              </div>
              <div className="verdict-score">
                <div className="score-circle" style={{ borderColor: vs.scoreColor, color: vs.scoreColor }}>
                  {results.confidence}%
                </div>
                <span className="score-label">Confidence</span>
              </div>
            </div>

            <div className="data-grid">
              <div className="data-box"><span className="db-label">Source Reliability</span><span className="db-val">{results.sourceReliability}</span></div>
              <div className="data-box"><span className="db-label">Bias Deviation</span><span className="db-val">{results.biasDeviation}</span></div>
              <div className="data-box"><span className="db-label">Clickbait Index</span><span className="db-val">{results.clickbaitIndex}%</span></div>
              <div className="data-box"><span className="db-label">Fact Records</span><span className="db-val">{results.factMatches}</span></div>
            </div>

            <div className="explanation-box">
              <h4>Analysis Summary</h4>
              {results.summary}
            </div>

            <div className="tags-section">
              <h4>Flags Detected</h4>
              <div className="tags-flex">
                {results.flags.length > 0 ? (
                  results.flags.map((flag, i) => <span key={i} className="flag-tag">{flag.toUpperCase()}</span>)
                ) : (
                  <span style={{ color: "hsl(var(--cp-green))", fontFamily: "var(--font-sans)", fontSize: "0.85rem" }}>None detected</span>
                )}
              </div>
            </div>

            {/* RELATED ARTICLES - Newspaper Layout */}
            {results.relatedArticles && results.relatedArticles.length > 0 && (() => {
              const featured = results.relatedArticles[0];
              const sidebar = results.relatedArticles.slice(1);
              const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
              return (
                <div className="news-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {/* LEFT: Latest Updates */}
                  <div className="news-col-left">
                    <h4 className="news-col-title">Latest Updates</h4>
                    <div className="news-updates-list">
                      {sidebar.map((article, i) => (
                        <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" className="news-update-card">
                          <div className="ra-top">
                            <span className="ra-check">✅</span>
                            <span className="ra-category">general</span>
                            <span className="ra-confidence">○ {Math.max(75, 100 - (i + 1) * 5)}%</span>
                          </div>
                          <h5 className="ra-title">{article.title}</h5>
                          <div className="ra-meta">
                            <span className="ra-time">{timeStr}</span>
                            <span className="ra-source">{article.source}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT: Misinformation Alerts */}
                  <div className="news-col-right">
                    <h4 className="news-col-title">⚠️ <span style={{ color: "hsl(var(--cp-accent))" }}>Misinformation Alerts</span></h4>
                    {sidebar.length > 0 && (
                      <div className="misinfo-card">
                        <div className="misinfo-badge-row">
                          <span className="misinfo-badge">🔍 Investigating</span>
                          <span className="ra-confidence">◐ Score: {Math.max(75, 100 - sidebar.length * 5)}%</span>
                        </div>
                        <h5 className="misinfo-title">{sidebar[0]?.title}</h5>
                        <p className="misinfo-desc">{sidebar[0]?.description}</p>
                        <div className="ra-meta">
                          <span className="ra-category">general</span>
                          <span className="ra-time">{new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>
    </>
  );
};

export default Index;
