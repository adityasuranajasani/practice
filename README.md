# 🔬 InsightForge • Advanced Web Research Assistant (v1.2)

A clean, modern, and autonomous research assistant web application. Enter any topic to retrieve web-grounded research results, source credibility ratings, conflicting viewpoints detection, interactive citations, academic bibliography, persistent search history, and one-click export to PDF.

![InsightForge](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)
![Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Standard%20Library)-success)
![Status](https://img.shields.io/badge/Tests-All%20Passing-brightgreen)

---

## 🌟 New & Improved Features

### 1. 🛡️ Source Credibility Indicators
- **Authority Tiers:** Automatically assigns sources to credibility tiers:
  - **Tier 1:** Peer-Reviewed / Institutional (`.edu`, `.gov`, `nature.com`, `ieee.org`, `science.org`, etc.)
  - **Tier 2:** Major Editorial & Fact-Checked Reference (`wikipedia.org`, `reuters.com`, `technologyreview.com`, `hbr.org`, etc.)
  - **Tier 3:** Specialized Industry & Technical Whitepapers.
- **Trust Scores:** Calculated metric (80–99/100) based on domain authority, editorial oversight, and citation transparency.
- **Detailed Evaluation Rationale:** Each source card displays an audit explaining why the source is trusted.

### 2. ⚖️ Conflicting-Information Detection
- **Perspective Matrix:** Analyzes extracted sources to isolate contentious viewpoints and disputed claims.
- **Side-by-Side Comparison:** Compares opposing stances (e.g. Near-term commercialization vs Conservative safety bottlenecks, or Performance vs Governance).
- **Consensus Status Badge:** Categorizes controversies as *Active Scientific Debate*, *Divergent Industry Forecasts*, or *Emerging Consensus*.
- **Synthesis Takeaway:** Formulates balanced strategic recommendations resolving conflicting perspectives.

### 3. 📑 Enhanced Citations & Formal Academic Bibliography
- **Interactive Citation Pills:** Inline citation pills formatted with source and domain hints (e.g. `[1: IEEE]`, `[2: Nature]`).
- **Floating Hover Popovers:** Hovering over any citation pill reveals a floating card with source title, publisher, trust score, and excerpt.
- **Auto-Scroll to Source:** Clicking a citation switches directly to the Sources tab and smoothly scrolls to the verified source card with a highlight glow.
- **Formal Academic Bibliography:** Automatically formats entries in both **APA** and **IEEE** standards with instant "Copy Citation" buttons.

### 4. 🔍 Advanced Search History & Favorites
- **Search & Filter:** Search past topics inside the history drawer with live keyword search.
- **Bookmark / Favorites (⭐):** Favorite any dossier from either the report header or the history drawer. Filter drawer by "Favorites Only".
- **Bulk Management:** Clear all history with a single click or delete individual sessions.
- **Instant Retrieval:** Click any past item to load the full dossier without repeating web requests.

### 5. 🖨️ Export to PDF Functionality
- **Dedicated "Export PDF" Button:** Direct button in the action bar.
- **Print Optimization (`@media print`):** Specially crafted print stylesheet that removes UI controls and formats all dossier sections (Executive Summary, Key Insights, Thematic Breakdown, Conflict Matrix, Sources Table, and Bibliography) into an elegant multi-page PDF document.

---

## 🚀 Quick Start

InsightForge has **zero external dependencies** and runs out-of-the-box using standard Python 3.9+.

### 1. Launch the Server

```bash
cd ~/Desktop/practice
python3 server.py
```

Console output:
```text
✨ Research Assistant Web App running at http://localhost:8000
```

### 2. Open in Browser

Visit:
```
http://localhost:8000
```

---

## 🧪 Running the Test Suite

Run the in-memory integration test suite covering database queries, credibility evaluation, conflict detection, API routing, and input sanitization:

```bash
python3 test_app.py -v
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & server status |
| `POST` | `/api/research` | Run research pipeline (Body: `{"topic": "...", "focus": "...", "depth": "..."}`) |
| `GET` | `/api/history?q={query}&favorites={0\|1}` | Retrieve filtered research history |
| `GET` | `/api/history/<id>` | Retrieve full saved dossier by ID |
| `POST` | `/api/history/<id>/favorite` | Toggle favorite status for a session |
| `DELETE` | `/api/history/<id>` | Delete a saved research session |
| `DELETE` | `/api/history/all` | Clear all saved history |
