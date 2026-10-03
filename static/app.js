/**
 * InsightForge - Advanced Frontend Application Logic (v1.2)
 * Features: Source Credibility, Conflicting Information Matrix,
 * Interactive Citation Popovers, Advanced Search History & PDF Export.
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const researchForm = document.getElementById("researchForm");
  const topicInput = document.getElementById("topicInput");
  const focusSelect = document.getElementById("focusSelect");
  const depthSelect = document.getElementById("depthSelect");
  const submitBtn = document.getElementById("submitBtn");
  const chipButtons = document.querySelectorAll(".chip-btn");

  // Progress Elements
  const progressSection = document.getElementById("progressSection");
  const progressBar = document.getElementById("progressBar");
  const progressStageTitle = document.getElementById("progressStageTitle");
  const progressStageSubtitle = document.getElementById("progressStageSubtitle");
  const stepItems = [
    document.getElementById("step1"),
    document.getElementById("step2"),
    document.getElementById("step3"),
    document.getElementById("step4")
  ];

  // Results Header & Stats Elements
  const resultsSection = document.getElementById("resultsSection");
  const resultTopicTitle = document.getElementById("resultTopicTitle");
  const badgeFocus = document.getElementById("badgeFocus");
  const badgeDepth = document.getElementById("badgeDepth");
  const badgeDate = document.getElementById("badgeDate");
  const favoriteBtn = document.getElementById("favoriteBtn");
  const favoriteStarIcon = document.getElementById("favoriteStarIcon");
  const favoriteBtnText = document.getElementById("favoriteBtnText");

  const statSourcesCount = document.getElementById("statSourcesCount");
  const statAvgCredibility = document.getElementById("statAvgCredibility");
  const statConflicts = document.getElementById("statConflicts");
  const statWordCount = document.getElementById("statWordCount");
  const statReadTime = document.getElementById("statReadTime");
  const statDuration = document.getElementById("statDuration");
  const tabSourcesCount = document.getElementById("tabSourcesCount");
  const tabConflictsCount = document.getElementById("tabConflictsCount");

  // Tab & Content Containers
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const executiveSummaryContent = document.getElementById("executiveSummaryContent");
  const keyInsightsGrid = document.getElementById("keyInsightsGrid");
  const thematicSectionsContainer = document.getElementById("thematicSectionsContainer");
  const conflictsContainer = document.getElementById("conflictsContainer");
  const sourcesGrid = document.getElementById("sourcesGrid");
  const bibliographyList = document.getElementById("bibliographyList");
  const rawMarkdownPreview = document.getElementById("rawMarkdownPreview");
  const citationTooltip = document.getElementById("citationTooltip");

  // Action Buttons
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const copyMdInnerBtn = document.getElementById("copyMdInnerBtn");
  const downloadMdBtn = document.getElementById("downloadMdBtn");
  const downloadJsonBtn = document.getElementById("downloadJsonBtn");

  // History Drawer & Filters
  const historyToggleBtn = document.getElementById("historyToggleBtn");
  const historyDrawer = document.getElementById("historyDrawer");
  const closeHistoryBtn = document.getElementById("closeHistoryBtn");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const historyList = document.getElementById("historyList");
  const historyCountBadge = document.getElementById("historyCountBadge");
  const historySearchInput = document.getElementById("historySearchInput");
  const historyFavFilterBtn = document.getElementById("historyFavFilterBtn");
  const clearAllHistoryBtn = document.getElementById("clearAllHistoryBtn");

  // Theme & Toast
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const toast = document.getElementById("toast");

  // State
  let currentReportData = null;
  let progressInterval = null;
  let historyFavoritesOnly = false;
  let historySearchDebounce = null;

  // Initialize
  initTheme();
  loadHistory();

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  // Submit Query
  researchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = topicInput.value.trim();
    if (!topic) return;

    const focus = focusSelect.value;
    const depth = depthSelect.value;
    await executeResearch(topic, focus, depth);
  });

  // Topic Chips
  chipButtons.forEach((chip) => {
    chip.addEventListener("click", () => {
      const topic = chip.getAttribute("data-topic");
      const focus = chip.getAttribute("data-focus");
      topicInput.value = topic;
      if (focus) focusSelect.value = focus;
      executeResearch(topic, focus || "general", depthSelect.value);
    });
  });

  // Tab Switching
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // Export to PDF
  exportPdfBtn.addEventListener("click", () => {
    if (!currentReportData) return;
    const originalTitle = document.title;
    document.title = `InsightForge - ${currentReportData.topic} Research Dossier`;
    showToast("🖨️ Preparing PDF print layout...");
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 250);
  });

  // Favorite Current Dossier
  favoriteBtn.addEventListener("click", async () => {
    if (!currentReportData || !currentReportData.session_id) return;
    const sessionId = currentReportData.session_id;
    try {
      const res = await fetch(`/api/history/${sessionId}/favorite`, { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        currentReportData.is_favorite = data.is_favorite;
        updateFavoriteButtonState(data.is_favorite);
        showToast(data.is_favorite ? "⭐ Added dossier to favorites" : "Removed from favorites");
        loadHistory();
      }
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  });

  // Copy Markdown
  const handleCopyMarkdown = () => {
    if (!currentReportData || !currentReportData.report_markdown) return;
    navigator.clipboard.writeText(currentReportData.report_markdown).then(() => {
      showToast("📋 Report markdown copied to clipboard!");
    }).catch(() => {
      showToast("Unable to copy to clipboard");
    });
  };

  copyMarkdownBtn.addEventListener("click", handleCopyMarkdown);
  copyMdInnerBtn.addEventListener("click", handleCopyMarkdown);

  // Download Markdown File
  downloadMdBtn.addEventListener("click", () => {
    if (!currentReportData) return;
    const filename = `${currentReportData.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-research.md`;
    downloadFile(filename, currentReportData.report_markdown, "text/markdown");
    showToast("💾 Downloaded Markdown report");
  });

  // Download JSON
  downloadJsonBtn.addEventListener("click", () => {
    if (!currentReportData) return;
    const filename = `${currentReportData.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-data.json`;
    downloadFile(filename, JSON.stringify(currentReportData, null, 2), "application/json");
    showToast("💾 Exported raw research JSON");
  });

  // History Drawer Controls
  historyToggleBtn.addEventListener("click", () => toggleHistoryDrawer(true));
  closeHistoryBtn.addEventListener("click", () => toggleHistoryDrawer(false));
  drawerOverlay.addEventListener("click", () => toggleHistoryDrawer(false));

  // History Search & Filter
  historySearchInput.addEventListener("input", () => {
    clearTimeout(historySearchDebounce);
    historySearchDebounce = setTimeout(() => {
      loadHistory();
    }, 300);
  });

  historyFavFilterBtn.addEventListener("click", () => {
    historyFavoritesOnly = !historyFavoritesOnly;
    historyFavFilterBtn.classList.toggle("btn-primary", historyFavoritesOnly);
    historyFavFilterBtn.classList.toggle("btn-secondary", !historyFavoritesOnly);
    loadHistory();
  });

  clearAllHistoryBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear all research history?")) return;
    try {
      const res = await fetch("/api/history/all", { method: "DELETE" });
      const data = await res.json();
      if (data.status === "success") {
        showToast("🧹 All research history cleared");
        loadHistory();
      }
    } catch (err) {
      alert("Failed to clear history: " + err.message);
    }
  });

  // Theme Toggle
  themeToggleBtn.addEventListener("click", () => {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    setTheme(isDark ? "light" : "dark");
  });

  // ==========================================================================
  // Research Execution & Flow
  // ==========================================================================

  async function executeResearch(topic, focus, depth) {
    submitBtn.disabled = true;
    resultsSection.classList.add("hidden");
    progressSection.classList.remove("hidden");
    startProgressAnimation();

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, focus, depth })
      });

      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(result.error || "Failed to generate research dossier");
      }

      currentReportData = result.data;
      stopProgressAnimation(true);

      // Render results
      renderReport(currentReportData);
      resultsSection.classList.remove("hidden");
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

      // Refresh history list
      loadHistory();
      showToast("✨ Research dossier successfully compiled!");
    } catch (err) {
      stopProgressAnimation(false);
      alert(`Research Error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  }

  function startProgressAnimation() {
    progressBar.style.width = "10%";
    stepItems.forEach((item, idx) => {
      item.className = "step-item";
      if (idx === 0) item.classList.add("active");
    });

    const stages = [
      { p: 25, title: "Decomposing query & identifying key facets...", subtitle: "Evaluating domain terminology and formulating search parameters", step: 0 },
      { p: 55, title: "Extracting web sources & verifying credibility ratings...", subtitle: "Analyzing domain authority tiers and factual objectivity", step: 1 },
      { p: 80, title: "Detecting conflicting perspectives & contested timelines...", subtitle: "Evaluating opposing viewpoints and identifying synthesis takeaways", step: 2 },
      { p: 95, title: "Compiling structured dossier & formal academic citations...", subtitle: "Structuring sections and assembling APA/IEEE bibliography", step: 3 }
    ];

    let currentStage = 0;
    progressStageTitle.textContent = stages[0].title;
    progressStageSubtitle.textContent = stages[0].subtitle;

    progressInterval = setInterval(() => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        progressBar.style.width = `${stage.p}%`;
        progressStageTitle.textContent = stage.title;
        progressStageSubtitle.textContent = stage.subtitle;

        stepItems.forEach((item, idx) => {
          if (idx < stage.step) {
            item.className = "step-item completed";
          } else if (idx === stage.step) {
            item.className = "step-item active";
          } else {
            item.className = "step-item";
          }
        });
        currentStage++;
      }
    }, 400);
  }

  function stopProgressAnimation(success) {
    if (progressInterval) clearInterval(progressInterval);
    if (success) {
      progressBar.style.width = "100%";
      stepItems.forEach((item) => (item.className = "step-item completed"));
      setTimeout(() => {
        progressSection.classList.add("hidden");
      }, 300);
    } else {
      progressSection.classList.add("hidden");
    }
  }

  // ==========================================================================
  // Report Rendering
  // ==========================================================================

  function renderReport(data) {
    // Header metadata
    resultTopicTitle.textContent = data.topic;
    badgeFocus.textContent = (data.focus || "general").toUpperCase();
    badgeDepth.textContent = (data.depth || "comprehensive").replace("_", " ").toUpperCase();
    badgeDate.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    updateFavoriteButtonState(Boolean(data.is_favorite));

    // Stats
    const stats = data.stats || {};
    statSourcesCount.textContent = stats.sources_count || (data.sources ? data.sources.length : 0);
    statAvgCredibility.textContent = `${stats.average_credibility || 94}/100`;
    statConflicts.textContent = stats.conflicts_detected || (data.conflicts ? data.conflicts.length : 0);
    statWordCount.textContent = stats.word_count || 0;
    statReadTime.textContent = `${stats.read_time_minutes || 2} min`;
    statDuration.textContent = `${stats.duration_seconds || 1.2}s`;
    tabSourcesCount.textContent = data.sources ? data.sources.length : 0;
    tabConflictsCount.textContent = data.conflicts ? data.conflicts.length : 0;

    // Executive Summary
    executiveSummaryContent.innerHTML = `<p>${escapeHtml(data.summary)}</p>`;

    // Key Insights
    keyInsightsGrid.innerHTML = "";
    if (data.key_insights && data.key_insights.length > 0) {
      data.key_insights.forEach((insight) => {
        const card = document.createElement("div");
        card.className = "insight-card";

        const citationsHtml = (insight.citations || []).map((c) => {
          return createCitationPillHtml(c, data.sources);
        }).join(" ");

        card.innerHTML = `
          <div class="insight-header">
            <h4 class="insight-headline">${escapeHtml(insight.headline)}</h4>
            <div>${citationsHtml}</div>
          </div>
          <p class="insight-body">${escapeHtml(insight.body)}</p>
        `;
        keyInsightsGrid.appendChild(card);
      });
    }

    // Thematic Sections
    thematicSectionsContainer.innerHTML = "";
    if (data.sections && data.sections.length > 0) {
      data.sections.forEach((sec) => {
        const block = document.createElement("div");
        block.className = "thematic-block";
        block.innerHTML = `
          <h4 class="thematic-heading">${escapeHtml(sec.heading)}</h4>
          <div class="thematic-body">${renderMarkdownWithCitations(sec.content, data.sources)}</div>
        `;
        thematicSectionsContainer.appendChild(block);
      });
    }

    // Conflicting Information & Perspectives Matrix
    conflictsContainer.innerHTML = "";
    if (data.conflicts && data.conflicts.length > 0) {
      data.conflicts.forEach((conf) => {
        const card = document.createElement("div");
        card.className = "conflict-card";

        const cA = (conf.perspective_a.citations || []).map((c) => createCitationPillHtml(c, data.sources)).join(" ");
        const cB = (conf.perspective_b.citations || []).map((c) => createCitationPillHtml(c, data.sources)).join(" ");

        card.innerHTML = `
          <div class="conflict-header">
            <h4 class="conflict-facet-title">Dispute: ${escapeHtml(conf.facet)}</h4>
            <span class="consensus-badge">${escapeHtml(conf.consensus_status)}</span>
          </div>
          <div class="conflict-grid">
            <div class="perspective-box stance-a">
              <span class="perspective-label">${escapeHtml(conf.perspective_a.label)} ${cA}</span>
              <p class="perspective-viewpoint">${escapeHtml(conf.perspective_a.viewpoint)}</p>
              <p class="perspective-evidence"><strong>Key Driver:</strong> ${escapeHtml(conf.perspective_a.evidence)}</p>
            </div>
            <div class="perspective-box stance-b">
              <span class="perspective-label">${escapeHtml(conf.perspective_b.label)} ${cB}</span>
              <p class="perspective-viewpoint">${escapeHtml(conf.perspective_b.viewpoint)}</p>
              <p class="perspective-evidence"><strong>Key Driver:</strong> ${escapeHtml(conf.perspective_b.evidence)}</p>
            </div>
          </div>
          <div class="synthesis-verdict-callout">
            <strong>⚖️ Synthesis Takeaway:</strong> ${escapeHtml(conf.synthesis_verdict)}
          </div>
        `;
        conflictsContainer.appendChild(card);
      });
    } else {
      conflictsContainer.innerHTML = `<div class="empty-state">No major conflicting viewpoints detected for this topic. High consensus across surveyed sources.</div>`;
    }

    // Sources Grid with Credibility Indicators
    sourcesGrid.innerHTML = "";
    if (data.sources && data.sources.length > 0) {
      data.sources.forEach((src, idx) => {
        const sourceIndex = idx + 1;
        const cred = src.credibility || { tier: "Standard", score: 85, badge: "Verified", authority: "Web Domain", rationale: "Standard reference" };
        const card = document.createElement("div");
        card.className = "source-card";
        card.id = `source-${sourceIndex}`;

        card.innerHTML = `
          <div class="source-meta">
            <span class="source-num-badge">${sourceIndex}</span>
            <span class="source-domain">${escapeHtml(src.domain || "web")}</span>
          </div>
          <h4 class="source-title">${escapeHtml(src.title)}</h4>
          <div class="source-cred-row">
            <span class="badge ${cred.badge_class || 'badge-tier2'}">${escapeHtml(cred.badge || 'Verified')}</span>
            <span class="trust-score-badge">🛡️ ${cred.score}/100 Trust</span>
          </div>
          <div class="cred-rationale-box">
            <strong>${escapeHtml(cred.authority)}:</strong> ${escapeHtml(cred.rationale)}
          </div>
          <p class="source-snippet">${escapeHtml(src.snippet)}</p>
          <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-link-btn">
            <span>Explore Source</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="14"></line>
            </svg>
          </a>
        `;
        sourcesGrid.appendChild(card);
      });
    }

    // Academic Bibliography
    bibliographyList.innerHTML = "";
    if (data.bibliography && data.bibliography.length > 0) {
      data.bibliography.forEach((bib) => {
        const entry = document.createElement("div");
        entry.className = "bib-entry";
        entry.innerHTML = `
          <div class="bib-citation-text">${escapeHtml(bib.apa_citation)}</div>
          <div class="bib-actions">
            <button class="btn btn-sm btn-secondary copy-bib-btn" data-citation="${escapeHtml(bib.apa_citation)}">
              📋 Copy APA Citation
            </button>
            <a href="${bib.url}" target="_blank" class="btn btn-sm btn-secondary">
              Direct Link
            </a>
          </div>
        `;
        entry.querySelector(".copy-bib-btn").addEventListener("click", () => {
          navigator.clipboard.writeText(bib.apa_citation);
          showToast("📋 Citation copied to clipboard!");
        });
        bibliographyList.appendChild(entry);
      });
    }

    // Raw Markdown Preview
    rawMarkdownPreview.textContent = data.report_markdown || "";

    // Set default active tab
    tabButtons[0].click();

    // Attach citation interactions
    attachCitationInteractions(data.sources);
  }

  function updateFavoriteButtonState(isFav) {
    if (isFav) {
      favoriteBtn.classList.add("favorited");
      favoriteStarIcon.textContent = "★";
      favoriteBtnText.textContent = "Favorited";
    } else {
      favoriteBtn.classList.remove("favorited");
      favoriteStarIcon.textContent = "☆";
      favoriteBtnText.textContent = "Favorite";
    }
  }

  function createCitationPillHtml(index, sources) {
    const src = sources && sources[index - 1];
    const domain = src ? src.domain.split(".")[0] : `Source ${index}`;
    return `<a href="#source-${index}" class="citation-pill" data-source-index="${index}">[${index}: ${domain}]</a>`;
  }

  function renderMarkdownWithCitations(text, sources) {
    if (!text) return "";
    let safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\[(\d+)\]/g, (match, idx) => {
      return createCitationPillHtml(parseInt(idx), sources);
    });
    return safe;
  }

  function attachCitationInteractions(sources) {
    document.querySelectorAll(".citation-pill").forEach((pill) => {
      const idx = parseInt(pill.getAttribute("data-source-index"));
      const src = sources && sources[idx - 1];

      // Hover Tooltip Popover
      pill.addEventListener("mouseenter", (e) => {
        if (!src) return;
        const cred = src.credibility || {};
        citationTooltip.innerHTML = `
          <div class="tooltip-header">
            <span>[${idx}] ${escapeHtml(src.domain)}</span>
            <span>🛡️ ${cred.score || 90}/100</span>
          </div>
          <div style="font-weight:600; margin-bottom: 4px;">${escapeHtml(src.title)}</div>
          <div class="tooltip-snippet">${escapeHtml(src.snippet.slice(0, 140))}...</div>
        `;
        const rect = pill.getBoundingClientRect();
        citationTooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
        citationTooltip.style.left = `${Math.max(10, rect.left + window.scrollX - 40)}px`;
        citationTooltip.classList.add("show");
      });

      pill.addEventListener("mouseleave", () => {
        citationTooltip.classList.remove("show");
      });

      // Click: Switch tab and scroll to source
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        citationTooltip.classList.remove("show");
        const sourcesTabBtn = document.querySelector('[data-tab="sourcesTab"]');
        if (sourcesTabBtn) sourcesTabBtn.click();

        setTimeout(() => {
          const targetCard = document.getElementById(`source-${idx}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.style.outline = "2px solid var(--primary)";
            setTimeout(() => {
              targetCard.style.outline = "none";
            }, 1800);
          }
        }, 150);
      });
    });
  }

  // ==========================================================================
  // History Management & Filtering
  // ==========================================================================

  async function loadHistory() {
    try {
      const query = historySearchInput ? historySearchInput.value.trim() : "";
      const url = `/api/history?q=${encodeURIComponent(query)}&favorites=${historyFavoritesOnly ? "1" : "0"}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "success") {
        renderHistoryList(data.history);
      }
    } catch (err) {
      console.error("Failed to load research history:", err);
    }
  }

  function renderHistoryList(items) {
    historyCountBadge.textContent = items.length;
    if (!items || items.length === 0) {
      historyList.innerHTML = `<div class="empty-state">No matching research records found.</div>`;
      return;
    }

    historyList.innerHTML = "";
    items.forEach((item) => {
      const el = document.createElement("div");
      el.className = "history-item";
      el.innerHTML = `
        <div class="history-item-top">
          <div class="history-item-topic">${escapeHtml(item.topic)}</div>
          <div class="history-item-actions">
            <button class="history-fav-star ${item.is_favorite ? 'active' : ''}" title="Favorite" data-id="${item.id}">
              ${item.is_favorite ? '★' : '☆'}
            </button>
            <button class="history-delete-btn" title="Delete record" data-id="${item.id}">✕</button>
          </div>
        </div>
        <div class="history-item-meta">
          <span>${item.focus.toUpperCase()}</span>
          <span>•</span>
          <span>${item.created_at ? item.created_at.split(" ")[0] : "Recently"}</span>
        </div>
      `;

      el.addEventListener("click", (e) => {
        if (e.target.closest(".history-delete-btn") || e.target.closest(".history-fav-star")) return;
        loadHistoricalSession(item.id);
      });

      const favBtn = el.querySelector(".history-fav-star");
      favBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await toggleItemFavorite(item.id);
      });

      const delBtn = el.querySelector(".history-delete-btn");
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteHistoricalSession(item.id);
      });

      historyList.appendChild(el);
    });
  }

  async function toggleItemFavorite(id) {
    try {
      const res = await fetch(`/api/history/${id}/favorite`, { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        if (currentReportData && currentReportData.session_id === id) {
          currentReportData.is_favorite = data.is_favorite;
          updateFavoriteButtonState(data.is_favorite);
        }
        loadHistory();
      }
    } catch (err) {
      console.error("Favorite toggle error:", err);
    }
  }

  async function loadHistoricalSession(id) {
    try {
      const res = await fetch(`/api/history/${id}`);
      const data = await res.json();
      if (data.status === "success" && data.session) {
        currentReportData = data.session;
        currentReportData.session_id = data.session.id;
        renderReport(currentReportData);
        resultsSection.classList.remove("hidden");
        toggleHistoryDrawer(false);
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("📖 Loaded research report from history");
      }
    } catch (err) {
      alert("Failed to load historical session: " + err.message);
    }
  }

  async function deleteHistoricalSession(id) {
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.status === "success") {
        showToast("🗑️ Research record deleted");
        loadHistory();
      }
    } catch (err) {
      alert("Failed to delete record");
    }
  }

  function toggleHistoryDrawer(open) {
    if (open) {
      historyDrawer.classList.add("open");
      drawerOverlay.classList.add("open");
      if (historySearchInput) historySearchInput.focus();
    } else {
      historyDrawer.classList.remove("open");
      drawerOverlay.classList.remove("open");
    }
  }

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  function initTheme() {
    const saved = localStorage.getItem("insightforge-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    setTheme(theme);
  }

  function setTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("insightforge-theme", theme);
    const themeIcon = document.getElementById("themeIcon");
    if (theme === "dark") {
      themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
    } else {
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    }
  }
});
