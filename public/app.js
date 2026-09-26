/* Bookimed Sales Dashboard - repaired app.js */
(() => {
  "use strict";

  const YEAR = 2026;
  const MONTHS = ["Genel", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const state = {
    view: localStorage.getItem("bookimedActiveView") || "dashboard",
    period: localStorage.getItem("bookimedPeriod") || String(new Date().getFullYear() === YEAR ? new Date().getMonth() + 1 : "genel"),
    coordinatorPeriod: localStorage.getItem("bookimedCoordinatorPeriod") || "genel",
    filters: { seller: "Tümü", coordinator: "Tümü", department: "Tümü", doctor: "Tümü", source: "Tümü" },
    coordinatorFilters: { coordinator: "Tümü", seller: "Tümü", department: "Tümü", status: "Tümü" },
    dashboard: null,
    coordinator: null,
    user: null,
    loading: false,
    openCaseSeller: "genel",
    openCaseMin: 0,
    openCaseStart: "",
    openCaseEnd: "",
    agingBucket: "all",
    agingSeller: "genel",
    leadSeller: "genel",
    expandedSellerSales: "",
    coordinatorSearch: "",
    coordinatorSort: { key: "cards", dir: "desc" },
    dashboardKey: "",
    coordinatorKey: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const number = value => new Intl.NumberFormat("tr-TR").format(Number(value || 0));
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
  const pct = value => `${(Number(value || 0) * 100).toFixed(1)}%`;
  const localDateIso = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const displayDate = value => {
    if (!value) return "-";
    const parts = String(value).slice(0, 10).split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(value);
  };
  const duration = minutes => {
    const n = Number(minutes || 0);
    if (!Number.isFinite(n) || n < 0) return "-";
    if (n < 1) return "<1 dk";
    if (n < 60) return `${Math.round(n)} dk`;
    if (n < 1440) return `${Math.floor(n / 60)} sa ${Math.round(n % 60)} dk`;
    return `${Math.floor(n / 1440)} gün ${Math.floor((n % 1440) / 60)} sa`;
  };

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      if (response.status === 401) {
        location.reload();
        throw new Error("Oturum süresi doldu.");
      }
      throw new Error(data.error || `İşlem başarısız (HTTP ${response.status})`);
    }
    return data;
  }

  function addStyles() {
    if ($("#bookimed-fixed-styles")) return;
    const style = document.createElement("style");
    style.id = "bookimed-fixed-styles";
    style.textContent = `
      :root{--navy:#173957;--blue:#2f70ad;--ink:#17324f;--muted:#68798a;--line:#dce5ec;--bg:#f3f6f9;--green:#21865d;--orange:#d47a20;--red:#c84a4a;--purple:#7558b5}
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:var(--bg);color:var(--ink)}button,input,select{font:inherit}button{cursor:pointer}
      .topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:15px 24px;background:var(--navy);color:#fff;box-shadow:0 3px 14px #17395733}
      .brand h1{margin:0;font-size:21px}.brand small{display:block;margin-top:3px;color:#cbd9e5}.top-actions{display:flex;gap:8px;align-items:center}.nav-btn,.logout-btn,.refresh-btn{border:1px solid #ffffff40;border-radius:9px;padding:9px 13px;background:#ffffff12;color:#fff;font-weight:700}.nav-btn.active{background:#fff;color:var(--navy)}
      .content{max-width:1580px;margin:auto;padding:22px}.panel{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 4px 14px #16324f0b;margin-bottom:18px}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #edf1f4}.panel-head h2,.panel-head h3{margin:0;font-size:17px}.panel-body{padding:18px}
      .filters{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:10px;padding:14px}.filters label{display:block;font-size:11px;font-weight:800;color:var(--muted);margin:0 0 5px 2px;text-transform:uppercase}.filters select{width:100%;height:40px;border:1px solid #cbd7e1;border-radius:8px;background:#fff;color:var(--ink);padding:0 9px}.filter-actions{display:flex;align-items:end;gap:8px}.primary{height:40px;border:0;border-radius:8px;background:var(--blue);color:#fff;padding:0 16px;font-weight:800}.secondary{height:40px;border:1px solid #cbd7e1;border-radius:8px;background:#fff;color:var(--ink);padding:0 14px;font-weight:700}
      .kpis{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:12px;margin-bottom:18px}.kpi{position:relative;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:13px;padding:15px 16px;min-height:91px}.kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent,var(--blue))}.kpi span{display:block;color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase}.kpi strong{display:block;margin-top:9px;font-size:24px;color:var(--ink)}.kpi small{display:block;margin-top:3px;color:var(--muted)}
      .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.scroll{overflow:auto;max-height:610px}table{border-collapse:collapse;width:100%;font-size:12px}th{position:sticky;top:0;z-index:2;background:#f6f9fb;color:#526779;text-align:left;padding:10px;border-bottom:1px solid var(--line);white-space:nowrap}td{padding:10px;border-bottom:1px solid #edf1f4;white-space:nowrap}tbody tr:hover{background:#f7fbff}.rank{display:inline-flex;width:23px;height:23px;align-items:center;justify-content:center;border-radius:50%;background:#e8eff5;font-weight:900}.rank.gold{background:#ffe8a3;color:#765600}.money{font-weight:800;color:#1e7553}.muted{color:var(--muted)}
      .bars{display:grid;gap:10px}.bar-row{display:grid;grid-template-columns:125px 1fr 75px;gap:10px;align-items:center;font-size:12px}.bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.bar-track{height:12px;background:#edf2f6;border-radius:99px;overflow:hidden}.bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--blue),#68a9d7);min-width:2px}.bar-value{text-align:right;font-weight:800}
      .status{padding:3px 7px;border-radius:99px;background:#eaf2f8;font-size:11px;font-weight:800}.notice,.error-box{padding:14px 16px;border-radius:10px;margin-bottom:16px}.notice{background:#edf6ff;color:#275f8c}.error-box{background:#fff0f0;color:#a82b2b}.loading{display:grid;place-items:center;min-height:340px;color:var(--muted);font-weight:700}.spinner{width:34px;height:34px;border:4px solid #dbe6ee;border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite;margin:auto auto 12px}@keyframes spin{to{transform:rotate(360deg)}}
      .progress{height:10px;border-radius:99px;background:#e8eef3;overflow:hidden;margin-top:8px}.progress>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#2f70ad,#49a576)}.view-title{display:flex;align-items:end;justify-content:space-between;margin-bottom:14px}.view-title h2{margin:0}.updated{font-size:11px;color:var(--muted)}.empty{text-align:center;color:var(--muted);padding:28px}.pill{display:inline-block;padding:4px 8px;border-radius:99px;background:#edf4f8;color:#375e7a;font-weight:800;font-size:11px}
      .period-strip{display:flex;gap:7px;overflow-x:auto;padding:12px 14px}.period-btn{flex:1;min-width:72px;border:1px solid #cdd9e3;border-radius:9px;background:#fff;color:#456079;padding:10px 8px;font-size:12px;font-weight:900}.period-btn:hover{border-color:var(--blue);color:var(--blue)}.period-btn.active{background:var(--navy);border-color:var(--navy);color:#fff;box-shadow:0 4px 10px #1739572f}
      .kpi.tone-green{background:linear-gradient(145deg,#f1fbf5,#fff);--accent:#23875c}.kpi.tone-yellow{background:linear-gradient(145deg,#fffbe6,#fff);--accent:#d4a72c}.kpi.tone-orange{background:linear-gradient(145deg,#fff5e9,#fff);--accent:#da7a1d}.kpi.tone-red{background:linear-gradient(145deg,#fff0ef,#fff);--accent:#c94a4a}.kpi.tone-blue{background:linear-gradient(145deg,#edf6fc,#fff);--accent:#2f70ad}.kpi.tone-purple{background:linear-gradient(145deg,#f4f0fc,#fff);--accent:#7558b5}
      .case-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fafcfd}.case-tabs,.amount-tabs{display:flex;gap:6px;overflow-x:auto}.case-tab,.amount-tab{border:1px solid #d5e0e8;border-radius:999px;background:#fff;color:#51697d;padding:7px 11px;font-size:11px;font-weight:900;white-space:nowrap}.case-tab.active,.amount-tab.active{background:var(--blue);border-color:var(--blue);color:#fff}.case-date-filter{display:flex;flex-wrap:wrap;align-items:end;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line);background:#f4f8fb}.case-date-filter label{display:grid;gap:5px;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.case-date-filter input{min-width:150px;border:1px solid #cbd9e4;border-radius:8px;background:#fff;color:var(--ink);padding:8px 10px}.case-date-filter button{border:1px solid #c8d7e2;border-radius:8px;background:#fff;color:#315b7d;padding:8px 11px;font-size:11px;font-weight:900}.case-date-filter button.primary-date{border-color:var(--blue);background:var(--blue);color:#fff}.case-date-filter button.export-date{border-color:#21865d;background:#21865d;color:#fff}.case-date-filter button:disabled{cursor:not-allowed;opacity:.48}.case-date-note{margin-left:auto;color:var(--muted);font-size:11px;font-weight:700}
      tr.case-premium{background:linear-gradient(90deg,#ece5ff,#fff 45%)}tr.case-high{background:linear-gradient(90deg,#e8f7ee,#fff 45%)}tr.case-mid{background:linear-gradient(90deg,#fff9df,#fff 45%)}tr.case-low{background:linear-gradient(90deg,#fff1e5,#fff 45%)}tr.case-normal{background:#fff}.amount-pill{display:inline-block;min-width:92px;padding:6px 9px;border-radius:8px;text-align:right;font-weight:900}.amount-premium{background:#6f4bb2;color:#fff}.amount-high{background:#23875c;color:#fff}.amount-mid{background:#f5d66e;color:#6b5200}.amount-low{background:#f2a85f;color:#6d3500}.amount-normal{background:#edf1f4;color:#526779}
      .cell-good{background:#dff2df!important;color:#17603c;font-weight:800}.cell-mid{background:#fff2bf!important;color:#765600;font-weight:800}.cell-bad{background:#f7d2d2!important;color:#922f2f;font-weight:800}.sub-row td:first-child{padding-left:28px}.sub-row td:first-child:before{content:"↳";margin-right:7px;color:#7590a6;font-weight:900}.section-band{padding:8px 12px;color:#fff;font-size:11px;font-weight:900;letter-spacing:.2px}.band-blue{background:#4276bd}.band-green{background:#4b7f35}.band-gold{background:#a77b00}.band-purple{background:#76539b}.compact-table td,.compact-table th{padding:8px}
      .dashboard-hero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:22px;margin-bottom:16px;padding:22px 24px;border-radius:18px;background:linear-gradient(120deg,#173957 0%,#245d88 58%,#2f70ad 100%);color:#fff;box-shadow:0 10px 25px #1739572b}.dashboard-hero:after{content:"";position:absolute;right:-60px;top:-95px;width:280px;height:280px;border-radius:50%;border:55px solid #ffffff12}.dashboard-hero h2{position:relative;z-index:1;margin:0 0 5px;font-size:25px}.dashboard-hero p{position:relative;z-index:1;margin:0;color:#dceaf4;font-size:13px}.hero-badge{position:relative;z-index:1;min-width:175px;padding:11px 14px;border:1px solid #ffffff35;border-radius:12px;background:#ffffff14;text-align:right}.hero-badge span{display:block;color:#dceaf4;font-size:10px;font-weight:800;text-transform:uppercase}.hero-badge b{display:block;margin-top:4px;font-size:15px}.dashboard-kpis{grid-template-columns:repeat(5,minmax(150px,1fr))}.dashboard-kpis .kpi{min-height:105px;padding:17px 18px;box-shadow:0 7px 17px #1739570d;transition:transform .18s ease,box-shadow .18s ease}.dashboard-kpis .kpi:hover{transform:translateY(-2px);box-shadow:0 10px 22px #1739571c}.dashboard-kpis .kpi strong{font-size:25px}.featured-kpi{grid-column:span 2;background:linear-gradient(135deg,#eaf8f0,#fff)!important}.featured-kpi strong{color:#176b48;font-size:29px!important}.dashboard-panel{overflow:hidden}.dashboard-panel>.panel-head{background:linear-gradient(90deg,#f7fafc,#fff)}.dashboard-panel>.panel-head h3:before{content:"";display:inline-block;width:4px;height:17px;margin-right:8px;border-radius:9px;background:var(--panel-accent,#2f70ad);vertical-align:-3px}.accent-green{--panel-accent:#23875c}.accent-purple{--panel-accent:#7558b5}.accent-gold{--panel-accent:#c69217}.accent-orange{--panel-accent:#d47a20}.summary-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-bottom:18px;overflow:hidden;border:1px solid var(--line);border-radius:13px;background:var(--line)}.summary-item{background:#fff;padding:13px 16px}.summary-item span{display:block;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase}.summary-item b{display:block;margin-top:5px;font-size:17px;color:var(--ink)}.summary-item.good b{color:#21865d}.summary-item.warn b{color:#b67512}.dashboard-panel tbody tr:nth-child(even){background:#fafcfd}.dashboard-panel th{background:#eaf1f6;color:#38546b;font-size:11px;text-transform:uppercase;letter-spacing:.2px}.dashboard-panel td{height:42px}.period-strip{background:linear-gradient(90deg,#f8fbfd,#fff)}
      .chart-wrap{padding:14px 18px 18px}.lead-chart{height:245px;display:flex;align-items:flex-end;gap:5px;padding:18px 8px 28px;border-left:1px solid var(--line);border-bottom:1px solid var(--line);background:linear-gradient(#edf2f650 1px,transparent 1px);background-size:100% 25%}.chart-col{position:relative;flex:1;min-width:7px;height:100%;display:flex;align-items:flex-end;justify-content:center}.chart-bar{width:72%;min-width:5px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#52a2da,#2f70ad);box-shadow:0 3px 8px #2f70ad2a;transition:.2s}.chart-col:hover .chart-bar{filter:brightness(.9)}.chart-value{position:absolute;bottom:calc(var(--bar-height) + 5px);font-size:10px;font-weight:900;color:#31536d}.chart-label{position:absolute;bottom:-22px;font-size:9px;color:var(--muted)}.seller-bars{display:grid;gap:11px}.seller-bar-row{display:grid;grid-template-columns:100px 1fr 46px;gap:10px;align-items:center;font-size:12px}.seller-bar-name{font-weight:800;overflow:hidden;text-overflow:ellipsis}.seller-bar-track{height:14px;border-radius:99px;background:#edf2f6;overflow:hidden}.seller-bar-fill{height:100%;background:linear-gradient(90deg,#7558b5,#aa8fe0);border-radius:99px}.seller-bar-value{text-align:right;font-weight:900}.action-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.action-card{border:1px solid var(--line);border-radius:13px;background:#fff;padding:14px;text-align:left;color:var(--ink);box-shadow:0 4px 12px #1739570b}.action-card span{display:block;font-size:10px;font-weight:900;text-transform:uppercase;color:var(--muted)}.action-card b{display:block;margin-top:7px;font-size:23px}.action-card.active{outline:3px solid #2f70ad26;border-color:var(--blue)}.action-card.red{border-left:5px solid #c84a4a}.action-card.orange{border-left:5px solid #d47a20}.action-card.yellow{border-left:5px solid #d4a72c}.action-card.blue{border-left:5px solid #2f70ad}.age-pill{display:inline-block;min-width:80px;padding:5px 8px;border-radius:99px;text-align:center;font-weight:900}.age-ok{background:#e4f4e9;color:#17603c}.age-warn{background:#fff2bf;color:#765600}.age-hot{background:#ffe0c2;color:#8b4c0a}.age-critical{background:#f7d2d2;color:#922f2f}.table-toolbar{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);background:#fafcfd}.table-search{width:min(340px,100%);height:38px;border:1px solid #cad7e1;border-radius:9px;padding:0 12px}.sortable{cursor:pointer;user-select:none}.sortable:hover{background:#dfeaf2}.sort-indicator{margin-left:4px;color:#2f70ad}.case-detail{font-size:11px;color:var(--muted)}
      .insight-tabs{display:flex;gap:7px;overflow-x:auto;padding:12px 16px;border-bottom:1px solid var(--line);background:#f8fbfd}.insight-tab{flex:0 0 auto;border:1px solid #cddae4;border-radius:999px;background:#fff;color:#4f6679;padding:8px 13px;font-size:11px;font-weight:900}.insight-tab.active{border-color:var(--navy);background:var(--navy);color:#fff;box-shadow:0 4px 10px #17395728}.flow{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:18px}.flow-step{position:relative;min-height:116px;border:1px solid var(--line);border-radius:14px;padding:15px;background:linear-gradient(145deg,#fff,#f8fbfd)}.flow-step:not(:last-child):after{content:"›";position:absolute;right:-11px;top:39px;z-index:2;width:21px;height:30px;display:grid;place-items:center;border-radius:99px;background:var(--navy);color:#fff;font-size:20px}.flow-step span{display:block;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase}.flow-step strong{display:block;margin:10px 0 6px;font-size:24px}.flow-step small{color:var(--muted)}.flow-step.expected{background:linear-gradient(145deg,#fff8da,#fff);border-color:#ecd777}.flow-step.success{background:linear-gradient(145deg,#e8f8ef,#fff);border-color:#a9dec0}.flow-progress{height:6px;margin-top:10px;border-radius:99px;background:#e5ebf0;overflow:hidden}.flow-progress i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#2f70ad,#49a576)}.coord-chart{display:grid;gap:13px;padding:18px}.coord-row{display:grid;grid-template-columns:160px 1fr 130px;gap:12px;align-items:center}.coord-name{font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.coord-stack{height:18px;display:flex;overflow:hidden;border-radius:99px;background:#edf2f6}.coord-stack i{height:100%;min-width:0}.coord-stack .booked{background:#d6a72c}.coord-stack .arrived{background:#438dcc}.coord-stack .success{background:#289266}.coord-values{text-align:right;font-size:11px;font-weight:800;color:var(--muted)}.share-ring{--p:0;display:grid;place-items:center;width:150px;height:150px;margin:auto;border-radius:50%;background:conic-gradient(#23875c calc(var(--p)*1%),#e7edf2 0)}.share-ring:after{content:"";grid-area:1/1;width:108px;height:108px;border-radius:50%;background:#fff}.share-ring b,.share-ring span{grid-area:1/1;z-index:1}.share-ring b{transform:translateY(-8px);font-size:23px}.share-ring span{transform:translateY(17px);font-size:10px;color:var(--muted);font-weight:800}.legend{display:flex;flex-wrap:wrap;gap:12px;padding:0 18px 18px;font-size:11px}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.loading-skeleton{opacity:.65}
      .summary-table td,.summary-table th{padding:12px 14px}.summary-table .summary-value{font-size:17px;font-weight:900;color:var(--ink)}.summary-stage{display:inline-block;min-width:92px;padding:6px 9px;border-radius:8px;background:#eaf1f6;color:#38546b;font-weight:900}.summary-expected{background:#fffaf0!important}.summary-success{background:#eef9f3!important}.summary-success .summary-stage{background:#23875c;color:#fff}.summary-expected .summary-stage{background:#d6a72c;color:#fff}.ops-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--line);border-bottom:1px solid var(--line)}.ops-summary>div{padding:14px;background:#fff}.ops-summary span{display:block;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase}.ops-summary b{display:block;margin-top:7px;font-size:18px}.ops-summary .warn{background:#fffdf2}.ops-summary .hot{background:#fff6ed}.ops-summary .critical{background:#fff0f0}.signal-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.signal-panel{overflow:hidden}.signal-head{padding:12px 16px;color:#fff;font-weight:900}.signal-head.red{background:#b94343}.signal-head.green{background:#23875c}.signal-list{display:grid}.signal-item{display:grid;grid-template-columns:1fr repeat(3,90px);gap:10px;align-items:center;padding:11px 16px;border-bottom:1px solid #edf1f4;font-size:12px}.signal-item:last-child{border-bottom:0}.signal-item strong{font-size:13px}.signal-metric{text-align:right}.signal-metric span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;font-weight:800}.signal-metric b{display:block;margin-top:3px}.signal-empty{padding:24px;text-align:center;color:var(--muted)}
      @media(max-width:1100px){.filters{grid-template-columns:repeat(3,1fr)}.kpis,.dashboard-kpis{grid-template-columns:repeat(3,1fr)}.featured-kpi{grid-column:span 1}.grid-2,.grid-3,.signal-grid{grid-template-columns:1fr}.summary-strip{grid-template-columns:repeat(2,1fr)}.flow{grid-template-columns:repeat(3,1fr)}.flow-step:after{display:none}.ops-summary{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:650px){.topbar{align-items:flex-start;padding:13px;flex-direction:column}.top-actions{width:100%;overflow:auto}.content{padding:12px}.filters{grid-template-columns:1fr 1fr}.kpis,.dashboard-kpis{grid-template-columns:1fr 1fr}.kpi strong{font-size:19px}.bar-row{grid-template-columns:90px 1fr 60px}.dashboard-hero{align-items:flex-start;flex-direction:column;padding:18px}.hero-badge{width:100%;text-align:left}.summary-strip{grid-template-columns:1fr 1fr}.action-strip{grid-template-columns:1fr 1fr}.lead-chart{height:190px;gap:2px}.chart-value{display:none}.seller-bar-row{grid-template-columns:75px 1fr 38px}.flow{grid-template-columns:1fr 1fr;padding:12px}.coord-row{grid-template-columns:90px 1fr}.coord-values{display:none}.ops-summary{grid-template-columns:1fr 1fr}.signal-item{grid-template-columns:1fr repeat(3,65px);padding:10px}.signal-metric span{display:none}}
      .sales-overview{padding:18px}.sales-scorecards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.sales-scorecard{position:relative;overflow:hidden;min-height:118px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 5px 14px #1739570b}.sales-scorecard:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--score-color)}.sales-scorecard.real{--score-color:#23875c;background:linear-gradient(145deg,#eefaf3,#fff)}.sales-scorecard.expected{--score-color:#d6a72c;background:linear-gradient(145deg,#fff9e5,#fff)}.sales-scorecard.target{--score-color:#2f70ad;background:linear-gradient(145deg,#eef6fc,#fff)}.sales-scorecard.gap{--score-color:#c84a4a;background:linear-gradient(145deg,#fff1f1,#fff)}.sales-scorecard.gap.complete{--score-color:#23875c;background:linear-gradient(145deg,#eefaf3,#fff)}.sales-score-label{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase}.sales-score-label i{width:9px;height:9px;border-radius:50%;background:var(--score-color);box-shadow:0 0 0 4px #ffffffb8}.sales-scorecard strong{display:block;margin-top:12px;font-size:25px;line-height:1;color:var(--ink)}.sales-scorecard small{display:block;margin-top:9px;color:var(--muted);font-size:11px;font-weight:700}.sales-comparison{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,.8fr);gap:22px;margin-top:18px;padding-top:18px;border-top:1px solid #e7edf2}.sales-bars{display:grid;gap:13px}.sales-bar-row{display:grid;grid-template-columns:95px minmax(120px,1fr) 110px;gap:12px;align-items:center}.sales-bar-name{font-size:11px;font-weight:900}.sales-bar-track{height:18px;overflow:hidden;border-radius:99px;background:#e8eef3}.sales-bar-fill{height:100%;min-width:3px;border-radius:99px;background:var(--bar-color)}.sales-bar-fill.real{--bar-color:linear-gradient(90deg,#23875c,#51b786)}.sales-bar-fill.expected{--bar-color:linear-gradient(90deg,#d3a126,#efd067)}.sales-bar-fill.target{--bar-color:linear-gradient(90deg,#2f70ad,#66a9d5)}.sales-bar-amount{text-align:right;font-size:13px;font-weight:900}.sales-funnel{display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border:1px solid var(--line);border-radius:12px;background:#f8fafc}.sales-funnel-step{padding:13px 9px;text-align:center}.sales-funnel-step:not(:last-child){border-right:1px solid var(--line)}.sales-funnel-step span{display:block;color:var(--muted);font-size:9px;font-weight:900;text-transform:uppercase}.sales-funnel-step b{display:block;margin-top:6px;font-size:17px}.sales-funnel-step small{display:block;margin-top:4px;color:var(--muted);font-size:9px}.sales-note{margin:0 0 10px;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase}@media(max-width:1100px){.sales-scorecards{grid-template-columns:repeat(2,1fr)}.sales-comparison{grid-template-columns:1fr}}@media(max-width:650px){.sales-scorecard{min-height:105px}.sales-scorecard strong{font-size:20px}.sales-bar-row{grid-template-columns:78px 1fr 82px;gap:7px}.sales-funnel{grid-template-columns:1fr 1fr}.sales-funnel-step:nth-child(2){border-right:0}.sales-funnel-step:nth-child(-n+2){border-bottom:1px solid var(--line)}}
      .seller-overview{padding:16px}.seller-totals{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:16px;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--line)}.seller-totals>div{padding:13px;background:#f9fbfd}.seller-totals span{display:block;color:var(--muted);font-size:9px;font-weight:900;text-transform:uppercase}.seller-totals b{display:block;margin-top:6px;font-size:17px}.seller-performance-table th{text-align:center}.seller-performance-table th:nth-child(2){text-align:left}.seller-performance-table td{text-align:center}.seller-performance-table td:nth-child(2){text-align:left}.seller-count{display:inline-grid;place-items:center;min-width:42px;padding:6px 9px;border-radius:8px;font-weight:900}.seller-count.lead{background:#e8f2fa;color:#285f89}.seller-count.quote{background:#fff4d3;color:#80600b}.seller-count.won{background:#dff3e8;color:#17613f}.seller-sales-button{border:0;transition:.16s ease;box-shadow:inset 0 0 0 1px #b8ddc8}.seller-sales-button:not(:disabled):hover,.seller-sales-button.active{background:#21865d;color:#fff;transform:translateY(-1px);box-shadow:0 4px 10px #21865d2e}.seller-sales-button:disabled{cursor:default;opacity:.65}.seller-sales-detail>td{padding:0!important;background:#f5faf7!important;text-align:left!important;white-space:normal}.seller-sales-detail-wrap{padding:13px 18px 17px;border-top:2px solid #21865d}.seller-sales-detail-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;color:#17613f;font-weight:900}.seller-sales-detail-title small{color:var(--muted);font-weight:700}.seller-sales-detail-table{border:1px solid #d8e8df;border-radius:9px;overflow:hidden}.seller-sales-detail-table table{background:#fff}.seller-sales-detail-table th{position:static;background:#e9f5ee;text-align:left!important}.seller-sales-detail-table td{text-align:left!important;height:auto}.seller-sales-detail-table td.amount{text-align:right!important;color:#176b48;font-weight:900}.seller-quote-amount{color:#80600b;font-size:14px;font-weight:900}.seller-sales{color:#176b48;font-size:14px;font-weight:900}.seller-rate{min-width:105px}.seller-rate b{display:block;margin-bottom:5px}.seller-rate i{display:block;height:5px;overflow:hidden;border-radius:99px;background:#e4eaf0}.seller-rate em{display:block;height:100%;border-radius:99px;background:var(--rate-color)}.seller-rate-good{--rate-color:#23875c;color:#17613f}.seller-rate-mid{--rate-color:#d6a72c;color:#765600}.seller-rate-low{--rate-color:#c84a4a;color:#922f2f}@media(max-width:1100px){.seller-totals{grid-template-columns:repeat(4,1fr)}}@media(max-width:650px){.seller-totals{grid-template-columns:repeat(2,1fr)}.seller-overview{padding:10px}.seller-sales-detail-wrap{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  const optionHtml = (items, selected) => [`<option value="Tümü">Tümü</option>`, ...(items || []).map(item => {
    const value = typeof item === "object" ? item.value : item;
    const label = typeof item === "object" ? item.label : item;
    return `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
  })].join("");

  function shell() {
    document.body.innerHTML = `
      <header class="topbar">
        <div class="brand"><h1>RU Aracı Takımı Satış Dashboard’u</h1><small>2026 satış ve performans dashboard’u</small></div>
        <div class="top-actions">
          <button class="nav-btn ${state.view === "dashboard" ? "active" : ""}" data-view="dashboard">Satış Dashboard</button>
          <button class="nav-btn ${state.view === "coordinator" ? "active" : ""}" data-view="coordinator">Aracı Dashboard</button>
          <button class="refresh-btn" id="refreshBtn">↻ Yenile</button>
          <button class="logout-btn" id="logoutBtn">Çıkış</button>
        </div>
      </header>
      <main id="appContent" class="content"><div class="loading"><div><div class="spinner"></div>Veriler yükleniyor...</div></div></main>`;
    document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
    $("#refreshBtn").addEventListener("click", refresh);
    $("#logoutBtn").addEventListener("click", logout);
  }

  function setLoading(message = "Veriler yükleniyor...") {
    $("#appContent").innerHTML = `<div class="loading"><div><div class="spinner"></div>${esc(message)}</div></div>`;
  }

  function showError(error) {
    $("#appContent").innerHTML = `<div class="error-box"><b>Dashboard yüklenemedi.</b><br>${esc(error?.message || error || "Bilinmeyen hata")}</div><button class="primary" id="retryBtn">Tekrar Dene</button>`;
    $("#retryBtn")?.addEventListener("click", refresh);
  }

  function dashboardUrl() {
    const params = new URLSearchParams({ period: state.period, ...state.filters });
    return `/api/dashboard?${params}`;
  }

  function coordinatorUrl() {
    return `/api/coordinator?${new URLSearchParams({ period: state.coordinatorPeriod, ...state.coordinatorFilters })}`;
  }

  async function loadDashboard(force = false) {
    if (state.loading) return;
    const url = dashboardUrl();
    if (!force && state.dashboard && state.dashboardKey === url) { renderDashboard(); return; }
    state.loading = true;
    setLoading();
    const slowNotice = setTimeout(() => {
      if (state.loading) setLoading("Google Sheets verileri hazırlanıyor; ilk bağlantı biraz sürebilir...");
    }, 8000);
    try {
      if (force) await api("/api/cache/clear", { method: "POST", body: "{}" });
      state.dashboard = await api(url);
      state.dashboardKey = url;
      renderDashboard();
      prefetchView("coordinator");
    } catch (error) { showError(error); }
    finally { clearTimeout(slowNotice); state.loading = false; }
  }

  async function loadCoordinator(force = false) {
    if (state.loading) return;
    const url = coordinatorUrl();
    if (!force && state.coordinator && state.coordinatorKey === url) { renderCoordinator(); return; }
    state.loading = true;
    setLoading("Aracı verileri yükleniyor...");
    const slowNotice = setTimeout(() => {
      if (state.loading) setLoading("Google Sheets verileri hazırlanıyor; ilk bağlantı biraz sürebilir...");
    }, 8000);
    try {
      if (force) await api("/api/cache/clear", { method: "POST", body: "{}" });
      state.coordinator = await api(url);
      state.coordinatorKey = url;
      renderCoordinator();
      prefetchView("dashboard");
    } catch (error) { showError(error); }
    finally { clearTimeout(slowNotice); state.loading = false; }
  }

  function prefetchView(view) {
    const run = async () => {
      try {
        if (view === "coordinator" && !state.coordinator) { const url=coordinatorUrl(); state.coordinator=await api(url); state.coordinatorKey=url; }
        if (view === "dashboard" && !state.dashboard) { const url=dashboardUrl(); state.dashboard=await api(url); state.dashboardKey=url; }
      } catch { /* Ön yükleme hatası aktif ekranı etkilemez. */ }
    };
    /* İlk dashboard çizimini ve düşük hızlı cihazları ön yüklemeyle meşgul etme. */
    setTimeout(() => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 }); else run();
    }, 3000);
  }

  function kpi(label, value, small = "", tone = "tone-blue") {
    return `<article class="kpi ${tone}"><span>${esc(label)}</span><strong>${value}</strong>${small ? `<small>${esc(small)}</small>` : ""}</article>`;
  }

  function conversionTone(value) {
    const rate = Number(value || 0);
    if (rate >= 0.10) return "tone-green";
    if (rate >= 0.06) return "tone-blue";
    if (rate >= 0.03) return "tone-yellow";
    if (rate > 0) return "tone-orange";
    return "tone-red";
  }

  function targetTone(value) {
    const rate = Number(value || 0);
    if (rate >= 1) return "tone-green";
    if (rate >= 0.70) return "tone-blue";
    if (rate >= 0.40) return "tone-yellow";
    if (rate > 0) return "tone-orange";
    return "tone-red";
  }

  function caseTone(amount) {
    const value = Number(amount || 0);
    if (value >= 30000) return { row: "case-premium", pill: "amount-premium" };
    if (value >= 20000) return { row: "case-high", pill: "amount-high" };
    if (value >= 10000) return { row: "case-mid", pill: "amount-mid" };
    if (value >= 5000) return { row: "case-low", pill: "amount-low" };
    return { row: "case-normal", pill: "amount-normal" };
  }

  function periodTabs() {
    return `<section class="panel"><div class="period-strip">${MONTHS.map((name, i) => {
      const value = i === 0 ? "genel" : String(i);
      return `<button class="period-btn ${String(state.period) === value ? "active" : ""}" data-period="${value}">${name}</button>`;
    }).join("")}</div></section>`;
  }

  function coordinatorPeriodTabs() {
    return `<section class="panel"><div class="period-strip">${MONTHS.map((name, i) => {
      const value = i === 0 ? "genel" : String(i);
      return `<button class="period-btn ${String(state.coordinatorPeriod) === value ? "active" : ""}" data-coordinator-period="${value}">${name}</button>`;
    }).join("")}</div></section>`;
  }

  function dashboardFilters(data) {
    const o = data.options || {};
    return `<section class="panel"><div class="filters">
      <div><label>Satıcı</label><select id="sellerFilter">${optionHtml(o.sellers, state.filters.seller)}</select></div>
      <div><label>Aracı</label><select id="coordinatorFilter">${optionHtml(o.coordinators, state.filters.coordinator)}</select></div>
      <div><label>Bölüm</label><select id="departmentFilter">${optionHtml(o.departments, state.filters.department)}</select></div>
      <div><label>Doktor</label><select id="doctorFilter">${optionHtml(o.doctors, state.filters.doctor)}</select></div>
      <div><label>Kaynak</label><select id="sourceFilter">${optionHtml(o.sources, state.filters.source)}</select></div>
      <div class="filter-actions"><button class="primary" id="applyFilters">Uygula</button><button class="secondary" id="clearFilters">Temizle</button></div>
    </div></section>`;
  }

  function sellerTable(rows) {
    if (!rows?.length) return `<div class="empty">Bu filtrelerde satıcı verisi bulunamadı.</div>`;
    const totals=rows.reduce((a,r)=>({lead:a.lead+Number(r.lead||0),quote:a.quote+Number(r.quote||0),quoteAmount:a.quoteAmount+Number(r.quoteAmount||0),won:a.won+Number(r.won||0),sales:a.sales+Number(r.sales||0)}),{lead:0,quote:0,quoteAmount:0,won:0,sales:0});
    const rateTone=value=>Number(value||0)>=.10?"seller-rate-good":Number(value||0)>=.05?"seller-rate-mid":"seller-rate-low";
    const salesDetail = row => {
      const details = Array.isArray(row.salesDetails) ? row.salesDetails : [];
      const detailRows = details.map((sale, index) => `<tr><td>${index + 1}</td><td><b>${esc(sale.id || "-")}</b></td><td>${esc(sale.patientName || "İsimsiz vaka")}</td><td>${esc(displayDate(sale.dealWonDate))}</td><td class="amount">${money(sale.amountUsd)}</td><td>${esc(sale.coordinator || "-")}</td><td>${esc(sale.department || "-")}</td><td>${esc(sale.doctor || "-")}</td></tr>`).join("");
      return `<tr class="seller-sales-detail"><td colspan="10"><div class="seller-sales-detail-wrap"><div class="seller-sales-detail-title"><span>${esc(row.sellerLabel || row.seller)} tarafından satılan vakalar</span><small>${number(details.length)} vaka · ${money(details.reduce((sum, sale) => sum + Number(sale.amountUsd || 0), 0))}</small></div><div class="seller-sales-detail-table scroll"><table><thead><tr><th>#</th><th>Bitrix ID</th><th>Hasta Adı</th><th>Satış Tarihi</th><th>Satış Tutarı</th><th>Aracı</th><th>Bölüm</th><th>Doktor</th></tr></thead><tbody>${detailRows || `<tr><td colspan="8" class="empty">Bu satıcı için satış detayı bulunamadı.</td></tr>`}</tbody></table></div></div></td></tr>`;
    };
    const sellerRows = rows.map((r,i) => {
      const isOpen = state.expandedSellerSales === r.seller;
      const hasSales = Number(r.won || 0) > 0;
      const mainRow = `<tr><td><span class="rank ${i===0?"gold":""}">${i+1}</span></td><td><b>${esc(r.sellerLabel||r.seller)}</b></td><td><span class="seller-count lead">${number(r.lead)}</span></td><td><span class="seller-count quote">${number(r.quote)}</span></td><td class="seller-quote-amount">${money(r.quoteAmount)}</td><td><button class="seller-count won seller-sales-button ${isOpen?"active":""}" data-seller-sales="${esc(r.seller)}" ${hasSales?"":"disabled"} title="${hasSales?"Satılan vakaları göster":"Satış bulunmuyor"}" aria-expanded="${isOpen}">${number(r.won)} ${hasSales?`<span aria-hidden="true">${isOpen?"▲":"▼"}</span>`:""}</button></td><td class="seller-sales">${money(r.sales)}</td><td><div class="seller-rate ${rateTone(r.quoteToWon)}"><b>${pct(r.quoteToWon)}</b><i><em style="width:${Math.min(100,Math.max(0,Number(r.quoteToWon||0)*100))}%"></em></i></div></td><td><div class="seller-rate ${rateTone(r.conversion)}"><b>${pct(r.conversion)}</b><i><em style="width:${Math.min(100,Math.max(0,Number(r.conversion||0)*100))}%"></em></i></div></td><td>${money(r.avgSale)}</td></tr>`;
      return mainRow + (isOpen ? salesDetail(r) : "");
    }).join("");
    return `<div class="seller-overview">
      <div class="seller-totals"><div><span>Toplam Gelen Lead</span><b>${number(totals.lead)}</b></div><div><span>Teklif Adedi</span><b>${number(totals.quote)}</b></div><div><span>Toplam Teklif Tutarı</span><b>${money(totals.quoteAmount)}</b></div><div><span>Toplam Satış</span><b>${number(totals.won)}</b></div><div><span>Satış Tutarı</span><b>${money(totals.sales)}</b></div><div><span>Teklif → Satış</span><b>${pct(totals.quote?totals.won/totals.quote:0)}</b></div><div><span>Lead → Satış</span><b>${pct(totals.lead?totals.won/totals.lead:0)}</b></div></div>
      <div class="scroll"><table class="seller-performance-table"><thead><tr><th>#</th><th>Satıcı</th><th>Gelen Lead</th><th>Teklif Adedi</th><th>Toplam Teklif Tutarı</th><th>Satış Adedi</th><th>Satış Tutarı</th><th>Teklif → Satış</th><th>Lead → Satış</th><th>Ort. Satış</th></tr></thead><tbody>${sellerRows}</tbody></table></div>
    </div>`;
  }

  function departmentTable(data) {
    const rows = data?.general?.rows || [];
    if (!rows.length) return `<div class="empty">Bölüm verisi bulunamadı.</div>`;
    return `<div class="scroll"><table><thead><tr><th>Bölüm</th><th>Lead</th><th>Teklif Adedi</th><th>Toplam Teklif Tutarı</th><th>Satış Adedi</th><th>Satış Tutarı</th><th>Teklif→Satış</th><th>Lead→Satış</th><th>Satış Payı</th></tr></thead><tbody>${rows.map(r => `<tr><td><span class="pill">${esc(r.department)}</span></td><td>${number(r.lead)}</td><td>${number(r.quote)}</td><td class="seller-quote-amount">${money(r.quoteAmount)}</td><td><b>${number(r.salesCount)}</b></td><td class="money">${money(r.salesAmount)}</td><td class="${conversionCellTone(r.quoteToSale)}">${pct(r.quoteToSale)}</td><td>${pct(r.leadToSale)}</td><td>${pct(r.salesShare)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function doctorTable(data) {
    const rows = data?.rows || [];
    if (!rows.length) return `<div class="empty">Doktor verisi bulunamadı.</div>`;
    return `<div class="scroll"><table><thead><tr><th>Doktor</th><th>Lead</th><th>Teklif Adedi</th><th>Toplam Teklif Tutarı</th><th>Satış Adedi</th><th>Satış Tutarı</th><th>Teklif→Satış</th><th>Lead→Satış</th><th>Satış Payı</th></tr></thead><tbody>${rows.map(r => `<tr><td><span class="pill">${esc(r.doctor)}</span></td><td>${number(r.lead)}</td><td>${number(r.quote)}</td><td class="seller-quote-amount">${money(r.quoteAmount)}</td><td><b>${number(r.salesCount)}</b></td><td class="money">${money(r.salesAmount)}</td><td class="${conversionCellTone(r.quoteToSale)}">${pct(r.quoteToSale)}</td><td>${pct(r.leadToSale)}</td><td>${pct(r.salesShare)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function monthlyBars(rows) {
    const max = Math.max(1, ...(rows || []).map(r => Number(r.sales || 0)));
    return `<div class="bars">${(rows || []).map(r => `<div class="bar-row"><div class="bar-label">${esc(r.monthName)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1, Number(r.sales || 0) / max * 100)}%"></div></div><div class="bar-value">${money(r.sales)}</div></div>`).join("")}</div>`;
  }

  function leadDistributionPanel(data) {
    const sellerRows=data?.sellers||[];
    if(state.leadSeller!=="genel"&&!sellerRows.some(r=>r.seller===state.leadSeller)) state.leadSeller="genel";
    const selected=state.leadSeller==="genel"?null:sellerRows.find(r=>r.seller===state.leadSeller);
    const values = selected?.values || data?.general || [];
    const labels = data?.labels || [];
    const max = Math.max(1, ...values.map(Number));
    const labelStep = values.length > 16 ? Math.ceil(values.length / 10) : 1;
    const chart = values.map((value, i) => {
      const height = Math.max(2, Number(value || 0) / max * 100);
      const showLabel = i % labelStep === 0 || i === values.length - 1;
      return `<div class="chart-col" title="${esc(labels[i])}: ${number(value)} lead"><span class="chart-value" style="--bar-height:${height}%">${number(value)}</span><i class="chart-bar" style="height:${height}%"></i>${showLabel ? `<span class="chart-label">${esc(labels[i])}</span>` : ""}</div>`;
    }).join("");
    const sellers = sellerRows.map(row => ({ ...row, total: (row.values || []).reduce((sum, value) => sum + Number(value || 0), 0) })).sort((a, b) => b.total - a.total);
    const sellerMax = Math.max(1, ...sellers.map(row => row.total));
    const sellerBars = sellers.map(row => `<div class="seller-bar-row"><div class="seller-bar-name" title="${esc(row.sellerLabel || row.seller)}">${esc(row.sellerLabel || row.seller)}</div><div class="seller-bar-track"><div class="seller-bar-fill" style="width:${row.total / sellerMax * 100}%"></div></div><div class="seller-bar-value">${number(row.total)}</div></div>`).join("");
    const tabs=`<div class="insight-tabs"><button class="insight-tab ${state.leadSeller==="genel"?"active":""}" data-lead-seller="genel">Genel</button>${sellers.map(r=>`<button class="insight-tab ${state.leadSeller===r.seller?"active":""}" data-lead-seller="${esc(r.seller)}">${esc(r.sellerLabel||r.seller)} · ${number(r.total)}</button>`).join("")}</div>`;
    return `<section class="panel dashboard-panel accent-green"><div class="panel-head"><h3>${data?.mode === "daily" ? "Günlük" : "Aylık"} Lead Akışı</h3><span class="muted">${selected?esc(selected.sellerLabel||selected.seller):"Genel toplam"} · ${number(values.reduce((a,b)=>a+Number(b||0),0))} lead</span></div>${tabs}<div class="grid-2"><div class="chart-wrap"><div class="lead-chart">${chart}</div></div><div class="panel-body"><h3 style="margin-top:0">Satıcı Lead Dağılımı</h3><div class="seller-bars">${sellerBars||`<div class="empty">Lead verisi bulunamadı.</div>`}</div></div></div></section>`;
  }

  function salesFlow(k) {
    const sales=Number(k.sales||0), expected=Number(k.expectedAmount||0), target=Number(k.target||0), remaining=Number(k.remaining||0);
    const scale=Math.max(1,sales,expected,target);
    const barWidth=value=>Math.min(100,Math.max(0,Number(value||0)/scale*100));
    const gapComplete=remaining<=0&&target>0;
    return `<section class="panel dashboard-panel accent-green"><div class="panel-head"><h3>Satış Özeti ve Akışı</h3><span class="muted">Gerçekleşen · Expected · Hedef · Fark</span></div><div class="sales-overview">
      <div class="sales-scorecards">
        <article class="sales-scorecard real"><div class="sales-score-label"><span>Gerçekleşen</span><i></i></div><strong>${money(sales)}</strong><small>${number(k.dealWon)} Deal Won · Hedefin ${pct(k.targetPct)}</small></article>
        <article class="sales-scorecard expected"><div class="sales-score-label"><span>Expected</span><i></i></div><strong>${money(expected)}</strong><small>${number(k.expectedDealWon)} beklenen satış · Won dönüşümü ${pct(k.expectedToWon)}</small></article>
        <article class="sales-scorecard target"><div class="sales-score-label"><span>Hedef</span><i></i></div><strong>${money(target)}</strong><small>Seçili dönemin satış hedefi</small></article>
        <article class="sales-scorecard gap ${gapComplete?"complete":""}"><div class="sales-score-label"><span>Fark</span><i></i></div><strong>${gapComplete?"Hedef Tamamlandı":money(remaining)}</strong><small>${gapComplete?"Hedefe kalan fark bulunmuyor":"Hedefe ulaşmak için kalan"}</small></article>
      </div>
      <div class="sales-comparison">
        <div><p class="sales-note">Tutar karşılaştırması · ortak ölçek</p><div class="sales-bars">
          <div class="sales-bar-row"><span class="sales-bar-name">Gerçekleşen</span><div class="sales-bar-track"><div class="sales-bar-fill real" style="width:${barWidth(sales)}%"></div></div><span class="sales-bar-amount">${money(sales)}</span></div>
          <div class="sales-bar-row"><span class="sales-bar-name">Expected</span><div class="sales-bar-track"><div class="sales-bar-fill expected" style="width:${barWidth(expected)}%"></div></div><span class="sales-bar-amount">${money(expected)}</span></div>
          <div class="sales-bar-row"><span class="sales-bar-name">Hedef</span><div class="sales-bar-track"><div class="sales-bar-fill target" style="width:${barWidth(target)}%"></div></div><span class="sales-bar-amount">${money(target)}</span></div>
        </div>
        <div><p class="sales-note">Satış akışı</p><div class="sales-funnel">
          <div class="sales-funnel-step"><span>Lead</span><b>${number(k.lead)}</b><small>Başlangıç</small></div>
          <div class="sales-funnel-step"><span>Teklif</span><b>${number(k.quoteCount)}</b><small>${pct(k.lead?k.quoteCount/k.lead:0)}</small></div>
          <div class="sales-funnel-step"><span>Expected</span><b>${number(k.expectedDealWon)}</b><small>Beklenen</small></div>
          <div class="sales-funnel-step"><span>Won</span><b>${number(k.dealWon)}</b><small>${pct(k.conversion)}</small></div>
        </div></div>
      </div>
    </div></section>`;
  }

  function ageClass(minutes) { const n = Number(minutes || 0); return n >= 10080 ? "age-critical" : n >= 4320 ? "age-critical" : n >= 2880 ? "age-hot" : n >= 1440 ? "age-warn" : "age-ok"; }
  function ageLabel(minutes) { const n = Number(minutes || 0); if (n < 1440) return `${Math.max(0, Math.floor(n / 60))} saat`; const days = Math.floor(n / 1440); return `${days} gün`; }
  function agingBucket(minutes) { const n = Number(minutes || 0); if (n >= 10080) return "7d"; if (n >= 4320) return "3d"; if (n >= 2880) return "48h"; if (n >= 1440) return "24h"; return "under24"; }

  function agingSummary(rows) {
    const counts = { all: rows.length, "24h": 0, "48h": 0, "3d": 0, "7d": 0 };
    rows.forEach(row => { const n = Number(row.ageMinutes || 0); if (n >= 1440) counts["24h"]++; if (n >= 2880) counts["48h"]++; if (n >= 4320) counts["3d"]++; if (n >= 10080) counts["7d"]++; });
    const cards = [["all","Tüm Açık Vakalar",counts.all,"blue"],["24h","24+ Saat",counts["24h"],"yellow"],["48h","48+ Saat",counts["48h"],"orange"],["7d","7+ Gün",counts["7d"],"red"]];
    return `<section class="action-strip">${cards.map(([key,label,count,tone]) => `<button class="action-card ${tone} ${state.agingBucket === key ? "active" : ""}" data-aging-bucket="${key}"><span>${label}</span><b>${number(count)}</b></button>`).join("")}</section>`;
  }

  function sellerAgingTable(rows) {
    const map = new Map();
    rows.forEach(row => { const key = row.seller || "Belirsiz"; const item = map.get(key) || { seller:key, label:row.sellerLabel || key, count:0, over48:0, over72:0, over7d:0, totalAge:0, oldest:0 }; const age=Number(row.ageMinutes||0); item.count++; item.totalAge+=age; item.oldest=Math.max(item.oldest,age); if(age>=2880)item.over48++; if(age>=4320)item.over72++; if(age>=10080)item.over7d++; map.set(key,item); });
    const items=[...map.values()].sort((a,b)=>b.over72-a.over72||b.oldest-a.oldest);
    if(!items.length) return `<div class="empty">Bekleyen vaka bulunamadı.</div>`;
    return `<div class="scroll"><table><thead><tr><th>Satıcı</th><th>Açık Vaka</th><th>48+ Saat</th><th>72+ Saat</th><th>7+ Gün</th><th>Ort. Bekleme</th><th>En Eski Vaka</th></tr></thead><tbody>${items.map(r=>`<tr><td><b>${esc(r.label)}</b></td><td>${number(r.count)}</td><td>${number(r.over48)}</td><td class="${r.over72 ? "cell-bad" : "cell-good"}">${number(r.over72)}</td><td>${number(r.over7d)}</td><td><span class="age-pill ${ageClass(r.totalAge/r.count)}">${ageLabel(r.totalAge/r.count)}</span></td><td><span class="age-pill ${ageClass(r.oldest)}">${ageLabel(r.oldest)}</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  function actionCases(data) {
    let rows=[...(data?.rows||[])];
    if(state.agingSeller!=="genel") rows=rows.filter(row=>row.seller===state.agingSeller);
    if(state.agingBucket!=="all") rows=rows.filter(row=>{ const n=Number(row.ageMinutes||0); return state.agingBucket==="24h"?n>=1440:state.agingBucket==="48h"?n>=2880:state.agingBucket==="3d"?n>=4320:n>=10080; });
    rows.sort((a,b)=>Number(b.ageMinutes||0)-Number(a.ageMinutes||0)||Number(b.amountUsd||0)-Number(a.amountUsd||0));
    return rows.length?`<div class="scroll"><table><thead><tr><th>#</th><th>Bitrix ID</th><th>Hasta Adı</th><th>Satıcı</th><th>Aracı</th><th>Bölüm</th><th>Doktor</th><th>Son İşlem</th><th>Bekleme</th><th>Teklif</th></tr></thead><tbody>${rows.slice(0,8).map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.id||"-")}</b></td><td><b>${esc(r.patientName||"İsimsiz vaka")}</b></td><td><b>${esc(r.sellerLabel||r.seller||"-")}</b></td><td>${esc(r.coordinator||"-")}</td><td>${esc(r.department||"-")}</td><td>${esc(r.doctor||"-")}</td><td>${esc(r.quoteDate||"-")}</td><td><span class="age-pill ${ageClass(r.ageMinutes)}">${ageLabel(r.ageMinutes)}</span></td><td class="money">${money(r.amountUsd)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Bu bekleme aralığında vaka bulunamadı.</div>`;
  }

  function slowResponseCases(rows) {
    const items = [...(rows || [])]
      .sort((a,b)=>Number(b.durationMinutes||0)-Number(a.durationMinutes||0))
      .slice(0,8);
    return items.length?`<div class="scroll"><table><thead><tr><th>#</th><th>Bitrix ID</th><th>Hasta Adı</th><th>Satıcı</th><th>Bölüm</th><th>Doktor</th><th>New Lead</th><th>Quoted</th><th>Cevap Süresi</th></tr></thead><tbody>${items.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.id||"-")}</b></td><td><b>${esc(r.patientName||"İsimsiz vaka")}</b></td><td><b>${esc(r.sellerLabel||r.seller||"-")}</b></td><td>${esc(r.department||"-")}</td><td>${esc(r.doctor||"-")}</td><td>${esc(r.newLeadAt||"-")}</td><td>${esc(r.quotedAt||"-")}</td><td><span class="age-pill ${ageClass(r.durationMinutes)}">${duration(r.durationMinutes)}</span></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Seçili ayda hem New Lead hem Quoted tarihi bulunan ölçülebilir vaka yok.</div>`;
  }

  function waitingWorkspace(data, speedData) {
    const sellers=[...new Map([...(speedData?.sellers||[]).map(r=>[r.seller,r.sellerLabel||r.seller])]).entries()];
    if(state.agingSeller!=="genel"&&!sellers.some(([key])=>key===state.agingSeller)) state.agingSeller="genel";
    const speed=state.agingSeller==="genel"?(speedData?.general||{}):((speedData?.sellers||[]).find(r=>r.seller===state.agingSeller)||{});
    const buckets=speed?.buckets||{};
    const over24=Number(buckets.d1to3||0)+Number(buckets.d3to7||0)+Number(buckets.over7d||0);
    const over3=Number(buckets.d3to7||0)+Number(buckets.over7d||0);
    const over7=Number(buckets.over7d||0);
    const generalMeasured=Number(speedData?.general?.count||0);
    const sellerMeasured=key=>Number((speedData?.sellers||[]).find(item=>item.seller===key)?.count||0);
    const quality=speedData?.quality||{};
    const diagnostic=Number(speed.count||0)===0?`<div class="empty">Ham Teklif kontrolü: ${number(quality.quotedRowsConsidered)} satır · New Lead tarihi eksik: ${number(quality.missingNewLeadDate)} · Quoted tarihi eksik: ${number(quality.missingQuotedDate)} · Farklı ay: ${number(quality.excludedDifferentMonth)} · Farklı yıl: ${number(quality.excludedDifferentYear)} · Negatif süre: ${number(quality.negativeDuration)}</div>`:"";
    const tabs=`<div class="insight-tabs"><button class="insight-tab ${state.agingSeller==="genel"?"active":""}" data-aging-seller="genel">Genel · ${number(generalMeasured)} ölçüm</button>${sellers.map(([key,label])=>`<button class="insight-tab ${state.agingSeller===key?"active":""}" data-aging-seller="${esc(key)}">${esc(label)} · ${number(sellerMeasured(key))} ölçüm</button>`).join("")}</div>`;
    return `<section class="panel dashboard-panel accent-orange"><div class="panel-head"><h3>Teklif Cevap Hızı</h3><span class="muted">${state.agingSeller==="genel"?"Tüm ekip":esc(sellers.find(([k])=>k===state.agingSeller)?.[1]||state.agingSeller)} · New Lead ve Quoted aynı ay</span></div>${tabs}<div class="ops-summary"><div><span>Ölçülen teklif</span><b>${number(speed.count)}</b></div><div><span>Medyan cevap hızı</span><b>${duration(speed.medianMinutes)}</b></div><div><span>24 saat altında</span><b>${pct(speed.under24hPct)}</b></div><div class="warn"><span>24+ saat</span><b>${number(over24)}</b></div><div class="hot"><span>3+ gün</span><b>${number(over3)}</b></div><div class="critical"><span>7+ gün</span><b>${number(over7)}</b></div></div>${diagnostic}<div class="panel-head"><h3>En Yavaş Cevaplanan 8 Vaka</h3><span class="muted">New Lead → Quoted gerçek süre</span></div>${slowResponseCases(speed.longestCases||[])}</section>`;
  }

  function filteredOpenCaseRows(data) {
    return [...(data?.rows || [])]
      .filter(row => state.openCaseSeller === "genel" || row.seller === state.openCaseSeller)
      .filter(row => Number(row.amountUsd || 0) >= state.openCaseMin)
      .filter(row => !state.openCaseStart || String(row.quoteDate || "") >= state.openCaseStart)
      .filter(row => !state.openCaseEnd || String(row.quoteDate || "") <= state.openCaseEnd)
      .sort((a, b) => Number(b.amountUsd || 0) - Number(a.amountUsd || 0))
      .slice(0, 10);
  }

  async function downloadOpenCasesReport() {
    const data = state.dashboard?.openCases;
    const rows = filteredOpenCaseRows(data);
    if (!rows.length) {
      window.alert("Seçili filtrelerde indirilecek büyük vaka bulunamadı.");
      return;
    }

    const button = $("[data-case-export]");
    const originalText = button?.textContent || "Filtreli Raporu İndir (.xlsx)";
    if (button) {
      button.disabled = true;
      button.textContent = "Excel hazırlanıyor...";
    }

    try {
      const params = new URLSearchParams({
        period: state.period,
        ...state.filters,
        openCaseSeller: state.openCaseSeller,
        openCaseMin: String(state.openCaseMin || 0),
        startDate: state.openCaseStart,
        endDate: state.openCaseEnd
      });
      const response = await fetch(`/api/reports/open-cases.xlsx?${params}`, { credentials: "same-origin" });
      if (!response.ok) {
        let message = "Excel raporu hazırlanamadı.";
        try {
          const error = await response.json();
          message = error.error || message;
        } catch { /* JSON olmayan hata yanıtı */ }
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const matchedName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      const datePart = state.openCaseStart || state.openCaseEnd || localDateIso();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = matchedName || `RU_Araci_Takimi_Filtreli_Buyuk_Vakalar_${datePart}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error?.message || "Excel raporu hazırlanamadı.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function openCases(data) {
    const allRows = data?.rows || [];
    const sellerMap = new Map();
    allRows.forEach(row => {
      if (!sellerMap.has(row.seller)) sellerMap.set(row.seller, row.sellerLabel || row.seller);
    });
    if (state.openCaseSeller !== "genel" && !sellerMap.has(state.openCaseSeller)) state.openCaseSeller = "genel";
    const rows = filteredOpenCaseRows(data);
    const total = rows.reduce((sum, row) => sum + Number(row.amountUsd || 0), 0);
    const sellerTabs = [`<button class="case-tab ${state.openCaseSeller === "genel" ? "active" : ""}" data-case-seller="genel">Genel</button>`, ...[...sellerMap.entries()].map(([value, label]) => `<button class="case-tab ${state.openCaseSeller === value ? "active" : ""}" data-case-seller="${esc(value)}">${esc(label)}</button>`)].join("");
    const amounts = [[0,"Tümü"],[5000,"5K+"],[10000,"10K+"],[20000,"20K+"],[30000,"30K+"]];
    return `<div class="case-tools"><div class="case-tabs">${sellerTabs}</div><div class="amount-tabs">${amounts.map(([value,label]) => `<button class="amount-tab ${state.openCaseMin === value ? "active" : ""}" data-case-min="${value}">${label}</button>`).join("")}</div></div>
      <div class="case-date-filter">
        <label>Başlangıç Tarihi<input id="openCaseStart" type="date" value="${esc(state.openCaseStart)}"></label>
        <label>Bitiş Tarihi<input id="openCaseEnd" type="date" value="${esc(state.openCaseEnd)}"></label>
        <button class="primary-date" data-case-date-apply>Uygula</button>
        <button data-case-date-today>Bugün</button>
        <button data-case-date-clear>Tarihleri Temizle</button>
        <button class="export-date" data-case-export ${rows.length ? "" : "disabled"}>Filtreli Raporu İndir (.xlsx)</button>
        <span class="case-date-note">${esc(state.period === "genel" ? "2026 genel verisi içinde filtreler" : `${MONTHS[Number(state.period)] || "Seçili ay"} verisi içinde filtreler`)}</span>
      </div>
      <div class="panel-head"><span class="muted">En yüksek tutarlı ilk 10 açık dosya</span><b>${number(rows.length)} dosya · ${money(total)}</b></div>
      ${rows.length ? `<div class="scroll"><table><thead><tr><th>#</th><th>Bitrix ID</th><th>Hasta Adı</th><th>Satıcı</th><th>Bölüm</th><th>Doktor</th><th>Aracı</th><th>Teklif Tarihi</th><th>Tutar</th></tr></thead><tbody>${rows.map((r, i) => { const tone = caseTone(r.amountUsd); return `<tr class="${tone.row}"><td><span class="rank ${i === 0 ? "gold" : ""}">${i + 1}</span></td><td><b>${esc(r.id || "-")}</b></td><td><b>${esc(r.patientName || "İsimsiz vaka")}</b></td><td><b>${esc(r.sellerLabel || r.seller)}</b></td><td>${esc(r.department || "-")}</td><td>${esc(r.doctor || "-")}</td><td>${esc(r.coordinator || "-")}</td><td>${esc(r.quoteDate || "-")}</td><td><span class="amount-pill ${tone.pill}">${money(r.amountUsd)}</span></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">Seçilen kriterlerde açık dosya bulunamadı.</div>`}`;
  }

  function speedPanel(data) {
    const g = data?.general || {};
    const sellers = (data?.sellers || []).filter(r => Number(r.count || 0) > 0);
    return `<div class="grid-3">${kpi("Ölçülen teklif", number(g.count), "Aynı ay içindeki kayıtlar", "tone-purple")}${kpi("Medyan süre", duration(g.medianMinutes), "Lead → teklif", Number(g.medianMinutes || 0) < 240 ? "tone-green" : Number(g.medianMinutes || 0) < 1440 ? "tone-yellow" : "tone-red")}${kpi("24 saat altında", pct(g.under24hPct), `${number(g.outlierCount)} aykırı kayıt`, Number(g.under24hPct || 0) >= .7 ? "tone-green" : "tone-orange")}</div>
      ${sellers.length ? `<div class="scroll" style="margin-top:14px"><table class="compact-table"><thead><tr><th>Satıcı</th><th>Ölçülen</th><th>Medyan Süre</th><th>Ortalama Süre</th><th>24 Saat Altı</th><th>3 Gün Üzeri</th><th>Aykırı Kayıt</th></tr></thead><tbody>${sellers.map(r => `<tr><td><b>${esc(r.sellerLabel || r.seller)}</b></td><td>${number(r.count)}</td><td class="${durationCellTone(r.medianMinutes)}">${duration(r.medianMinutes)}</td><td class="${durationCellTone(r.avgMinutes)}">${duration(r.avgMinutes)}</td><td class="${highRateTone(r.under24hPct)}">${pct(r.under24hPct)}</td><td class="${lowRateTone(r.over3dPct)}">${pct(r.over3dPct)}</td><td class="${Number(r.outlierCount || 0) === 0 ? "cell-good" : "cell-bad"}">${number(r.outlierCount)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Satıcı bazında süre verisi bulunamadı.</div>`}`;
  }

  function durationCellTone(minutes) { const value = Number(minutes || 0); return value <= 240 ? "cell-good" : value <= 1440 ? "cell-mid" : "cell-bad"; }
  function highRateTone(rate) { const value = Number(rate || 0); return value >= .70 ? "cell-good" : value >= .40 ? "cell-mid" : "cell-bad"; }
  function lowRateTone(rate) { const value = Number(rate || 0); return value <= .10 ? "cell-good" : value <= .25 ? "cell-mid" : "cell-bad"; }

  function renderDashboard() {
    const d = state.dashboard;
    const k = d.kpis || {};
    $("#appContent").innerHTML = `
      <section class="dashboard-hero">
        <div><h2>RU Aracı Takımı Satış Dashboard’u</h2><p>Lead, teklif, satış, hedef ve ekip performansının tek ekranda güncel görünümü</p></div>
        <div class="hero-badge"><span>Son güncelleme</span><b>${esc(new Date(d.updatedAt).toLocaleString("tr-TR"))}</b></div>
      </section>
      ${periodTabs()}
      ${dashboardFilters(d)}
      <section class="summary-strip">
        <div class="summary-item"><span>Seçili dönem</span><b>${esc(state.period === "genel" ? "2026 Genel" : MONTHS[Number(state.period)] || "2026")}</b></div>
        <div class="summary-item good"><span>Gerçekleşen satış</span><b>${money(k.sales)}</b></div>
        <div class="summary-item warn"><span>Hedefe kalan</span><b>${money(k.remaining)}</b></div>
        <div class="summary-item"><span>Toplam teklif tutarı</span><b>${money(k.quoteAmount)}</b></div>
      </section>
      ${salesFlow(k)}
      <section class="panel dashboard-panel accent-purple"><div class="panel-head"><h3>Satıcı Teklif ve Satış Performansı</h3><span class="muted">Gelen lead → teklif → satış · satış tutarına göre sıralı</span></div>${sellerTable(d.sellerPerformance)}</section>
      <section class="panel dashboard-panel accent-green"><div class="panel-head"><h3>Hedef İlerlemesi</h3><b>${pct(k.targetPct)}</b></div><div class="panel-body"><div class="progress"><i style="width:${Math.min(100, Math.max(0, Number(k.targetPct || 0) * 100))}%"></i></div></div></section>
      <section class="panel dashboard-panel accent-green"><div class="panel-head"><h3>Aylık Satış</h3><span class="muted">USD bazında</span></div><div class="panel-body">${monthlyBars(d.monthlySummary)}</div></section>
      ${leadDistributionPanel(d.leadDistribution)}
      ${waitingWorkspace(d.openCases, d.leadToQuoted)}
      <section class="panel dashboard-panel accent-gold"><div class="panel-head"><h3>Bölüm Bazlı Teklif ve Satış Performansı</h3><span class="muted">Teklif adedi · teklif tutarı · satış · konversiyon</span></div>${departmentTable(d.departmentSales)}</section>
      <section class="panel dashboard-panel accent-purple"><div class="panel-head"><h3>Doktor Bazlı Teklif ve Satış Performansı</h3><span class="muted">Teklif adedi · teklif tutarı · satış · konversiyon</span></div>${doctorTable(d.doctorSales)}</section>
      <section class="panel dashboard-panel accent-orange"><div class="panel-head"><h3>Açık Teklifler</h3><b>${number(d.openCases?.count)} vaka · ${money(d.openCases?.totalAmount)}</b></div>${openCases(d.openCases)}</section>`;
    bindDashboardFilters();
  }

  function bindDashboardFilters() {
    document.querySelectorAll("[data-period]").forEach(button => button.addEventListener("click", () => {
      state.period = button.dataset.period;
      state.expandedSellerSales = "";
      state.openCaseSeller = "genel";
      state.openCaseStart = "";
      state.openCaseEnd = "";
      localStorage.setItem("bookimedPeriod", state.period);
      loadDashboard();
    }));
    $("#applyFilters").addEventListener("click", () => {
      state.filters = {
        seller: $("#sellerFilter").value,
        coordinator: $("#coordinatorFilter").value,
        department: $("#departmentFilter").value,
        doctor: $("#doctorFilter").value,
        source: $("#sourceFilter").value
      };
      state.expandedSellerSales = "";
      loadDashboard();
    });
    $("#clearFilters").addEventListener("click", () => {
      state.filters = { seller: "Tümü", coordinator: "Tümü", department: "Tümü", doctor: "Tümü", source: "Tümü" };
      state.expandedSellerSales = "";
      loadDashboard();
    });
    document.querySelectorAll("[data-seller-sales]").forEach(button => button.addEventListener("click", () => {
      const seller = button.dataset.sellerSales || "";
      state.expandedSellerSales = state.expandedSellerSales === seller ? "" : seller;
      renderDashboard();
    }));
    document.querySelectorAll("[data-case-seller]").forEach(button => button.addEventListener("click", () => {
      state.openCaseSeller = button.dataset.caseSeller;
      renderDashboard();
    }));
    document.querySelectorAll("[data-case-min]").forEach(button => button.addEventListener("click", () => {
      state.openCaseMin = Number(button.dataset.caseMin || 0);
      renderDashboard();
    }));
    $("[data-case-date-apply]")?.addEventListener("click", () => {
      const start = $("#openCaseStart")?.value || "";
      const end = $("#openCaseEnd")?.value || "";
      state.openCaseStart = start && end && start > end ? end : start;
      state.openCaseEnd = start && end && start > end ? start : end;
      renderDashboard();
    });
    $("[data-case-date-today]")?.addEventListener("click", () => {
      const today = localDateIso();
      state.openCaseStart = today;
      state.openCaseEnd = today;
      renderDashboard();
    });
    $("[data-case-date-clear]")?.addEventListener("click", () => {
      state.openCaseStart = "";
      state.openCaseEnd = "";
      renderDashboard();
    });
    $("[data-case-export]")?.addEventListener("click", downloadOpenCasesReport);
    document.querySelectorAll("[data-aging-bucket]").forEach(button => button.addEventListener("click", () => {
      state.agingBucket = button.dataset.agingBucket;
      renderDashboard();
    }));
    document.querySelectorAll("[data-aging-seller]").forEach(button => button.addEventListener("click", () => { state.agingSeller=button.dataset.agingSeller; state.agingBucket="all"; renderDashboard(); }));
    document.querySelectorAll("[data-lead-seller]").forEach(button => button.addEventListener("click", () => { state.leadSeller=button.dataset.leadSeller; renderDashboard(); }));
  }

  function coordinatorFilters(data) {
    const o = data.options || {};
    return `<section class="panel"><div class="filters">
      <div><label>Aracı</label><select id="cCoordinator">${optionHtml(o.coordinators, state.coordinatorFilters.coordinator)}</select></div>
      <div><label>Satıcı</label><select id="cSeller">${optionHtml(o.sellers, state.coordinatorFilters.seller)}</select></div>
      <div><label>Bölüm</label><select id="cDepartment">${optionHtml(o.departments, state.coordinatorFilters.department)}</select></div>
      <div><label>Statü</label><select id="cStatus">${optionHtml(o.statuses, state.coordinatorFilters.status)}</select></div>
      <div class="filter-actions"><button class="primary" id="applyCoordinator">Uygula</button><button class="secondary" id="clearCoordinator">Temizle</button></div>
    </div></section>`;
  }

  function coordinatorTable(rows) {
    if (!rows?.length) return `<div class="empty">Aracı verisi bulunamadı.</div>`;
    const query=state.coordinatorSearch.trim().toLocaleLowerCase("tr-TR");
    const key=state.coordinatorSort.key, dir=state.coordinatorSort.dir==="asc"?1:-1;
    const filtered=rows.filter(r=>!query||[r.coordinator,r.topSeller,r.topDepartment].some(v=>String(v||"").toLocaleLowerCase("tr-TR").includes(query))).sort((a,b)=>{const av=a[key],bv=b[key];return (typeof av==="number"&&typeof bv==="number"?av-bv:String(av||"").localeCompare(String(bv||""),"tr"))*dir;});
    const head=(label,field)=>`<th class="sortable" data-coordinator-sort="${field}">${label}${key===field?`<span class="sort-indicator">${dir===1?"▲":"▼"}</span>`:""}</th>`;
    return `<div class="table-toolbar"><input id="coordinatorSearch" class="table-search" value="${esc(state.coordinatorSearch)}" placeholder="Aracı, satıcı veya bölüm ara..."><span class="muted">${number(filtered.length)} kayıt</span></div><div class="scroll"><table><thead><tr><th>#</th>${head("Aracı","coordinator")}${head("Lead","cards")}${head("Teklif Adedi","appointmentBooked")}${head("Teklif Tutarı","quoteAmount")}${head("Deal Won Adedi","salesCards")}${head("Deal Won Tutarı","salesAmount")}${head("Dönüşüm","conversionRate")}<th>En Çok Çalıştığı Satıcı</th><th>En Çok Bölüm</th>${head("Atanmamış","unassignedCards")}</tr></thead><tbody>${filtered.map((r, i) => `<tr><td><span class="rank ${i === 0 ? "gold" : ""}">${i + 1}</span></td><td><b>${esc(r.coordinator)}</b></td><td>${number(r.cards)}</td><td>${number(r.appointmentBooked)}</td><td class="money">${money(r.quoteAmount)}</td><td><b>${number(r.salesCards)}</b></td><td class="money">${money(r.salesAmount)}</td><td class="${conversionCellTone(r.conversionRate)}">${pct(r.conversionRate)}</td><td>${esc(r.topSeller)} <span class="muted">(${number(r.topSellerCards)})</span></td><td>${esc(r.topDepartment)} <span class="muted">(${number(r.topDepartmentCards)})</span></td><td>${number(r.unassignedCards)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function conversionCellTone(rate) { const value = Number(rate || 0); return value >= .07 ? "cell-good" : value >= .03 ? "cell-mid" : "cell-bad"; }

  function coordinatorLeadTable(rows) {
    const sorted = [...(rows || [])].sort((a, b) => Number(b.cards || 0) - Number(a.cards || 0));
    if (!sorted.length) return `<div class="empty">Aracı verisi bulunamadı.</div>`;
    return `<div class="scroll"><table class="compact-table"><thead><tr><th>Aracı</th><th>Lead</th><th>Teklif Adedi</th><th>Teklif Tutarı</th><th>Satış Adedi</th><th>Satış Tutarı</th><th>Dönüşüm</th></tr></thead><tbody>${sorted.map(r => `<tr><td><b>${esc(r.coordinator)}</b></td><td>${number(r.cards)}</td><td>${number(r.appointmentBooked)}</td><td class="money">${money(r.quoteAmount)}</td><td>${number(r.salesCards)}</td><td class="money">${money(r.salesAmount)}</td><td class="${conversionCellTone(r.conversionRate)}">${pct(r.conversionRate)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function coordinatorSalesTable(rows) {
    const sorted = [...(rows || [])].sort((a, b) => Number(b.salesCards || 0) - Number(a.salesCards || 0) || Number(b.conversionRate || 0) - Number(a.conversionRate || 0));
    if (!sorted.length) return `<div class="empty">Aracı verisi bulunamadı.</div>`;
    return `<div class="scroll"><table class="compact-table"><thead><tr><th>Aracı</th><th>Lead</th><th>Teklif Adedi</th><th>Teklif Tutarı</th><th>Satış Adedi</th><th>Satış Tutarı</th><th>Dönüşüm</th></tr></thead><tbody>${sorted.map(r => `<tr><td><b>${esc(r.coordinator)}</b></td><td>${number(r.cards)}</td><td>${number(r.appointmentBooked)}</td><td class="money">${money(r.quoteAmount)}</td><td>${number(r.salesCards)}</td><td class="money">${money(r.salesAmount)}</td><td class="${conversionCellTone(r.conversionRate)}">${pct(r.conversionRate)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function coordinatorSellerTable(rows) {
    const sorted = [...(rows || [])].sort((a, b) => String(a.coordinator || "").localeCompare(String(b.coordinator || ""), "tr") || Number(b.cards || 0) - Number(a.cards || 0));
    if (!sorted.length) return `<div class="empty">Aracı–satıcı eşleşmesi bulunamadı.</div>`;
    return `<div class="scroll"><table class="compact-table"><thead><tr><th>Aracı</th><th>Satıcı</th><th>Lead</th><th>Teklif Adedi</th><th>Teklif Tutarı</th><th>Deal Won Adedi</th><th>Deal Won Tutarı</th><th>Dönüşüm</th></tr></thead><tbody>${sorted.map(r => `<tr class="sub-row"><td><b>${esc(r.coordinator)}</b></td><td>${esc(r.sellerLabel || r.seller)}</td><td>${number(r.cards)}</td><td>${number(r.appointmentBooked)}</td><td class="money">${money(r.quoteAmount)}</td><td>${number(r.salesCards)}</td><td class="money">${money(r.salesAmount)}</td><td class="${conversionCellTone(r.conversionRate)}">${pct(r.conversionRate)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function inboundTable(rows, dimension) {
    if (!rows?.length) return `<div class="empty">Veri bulunamadı.</div>`;
    const isSeller = dimension === "seller";
    return `<div class="scroll"><table><thead><tr><th>${isSeller ? "Satıcı" : "Bölüm"}</th><th>Lead</th><th>Teklif Adedi</th><th>Teklif Tutarı</th><th>Deal Won Adedi</th><th>Deal Won Tutarı</th><th>Conversion</th><th>En Çok Gönderen Aracı</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(isSeller ? (r.sellerLabel || r.seller) : r.department)}</b></td><td>${number(r.cards)}</td><td>${number(r.quoteCount)}</td><td class="money">${money(r.quoteAmount)}</td><td>${number(r.salesCards)}</td><td class="money">${money(r.salesAmount)}</td><td>${pct(r.conversionRate)}</td><td>${esc(r.topCoordinator)} <span class="muted">(${number(r.topCoordinatorCards)})</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  function statusBars(rows) {
    const max = Math.max(1, ...(rows || []).map(r => r.count));
    return `<div class="bars">${(rows || []).map(r => `<div class="bar-row"><div class="bar-label">${esc(r.status)}</div><div class="bar-track"><div class="bar-fill" style="width:${r.count / max * 100}%"></div></div><div class="bar-value">${number(r.count)} · ${pct(r.share)}</div></div>`).join("")}</div>`;
  }

  function coordinatorVisuals(rows, kpis) {
    const top=[...(rows||[])].sort((a,b)=>Number(b.salesCards||0)-Number(a.salesCards||0)||Number(b.cards||0)-Number(a.cards||0)).slice(0,10);
    const max=Math.max(1,...top.map(r=>Number(r.cards||0)));
    const chart=top.map(r=>{const quoted=Number(r.appointmentBooked||0),sales=Number(r.salesCards||0);return `<div class="coord-row"><div class="coord-name" title="${esc(r.coordinator)}">${esc(r.coordinator)}</div><div class="coord-stack" title="Teklif ${quoted} · Satış ${sales}" style="width:${Math.max(8,Number(r.cards||0)/max*100)}%"><i class="booked" style="width:${quoted/Math.max(1,quoted+sales)*100}%"></i><i class="success" style="width:${sales/Math.max(1,quoted+sales)*100}%"></i></div><div class="coord-values">${number(r.salesCards)} satış / ${number(r.cards)} lead</div></div>`;}).join("");
    const conversion=Number(kpis?.conversionRate||0)*100;
    return `<div class="grid-2"><section class="panel"><div class="panel-head"><h3>Aracı Satış Akışı</h3><span class="muted">İlk 10 aracı</span></div><div class="coord-chart">${chart||`<div class="empty">Veri bulunamadı.</div>`}</div><div class="legend"><span><i style="background:#d6a72c"></i>Teklif</span><span><i style="background:#289266"></i>Satış</span></div></section><section class="panel"><div class="panel-head"><h3>Genel Satış Dönüşümü</h3><span class="muted">Satış / toplam lead</span></div><div class="panel-body"><div class="share-ring" style="--p:${Math.min(100,conversion)}"><b>${conversion.toFixed(1)}%</b><span>DÖNÜŞÜM</span></div><div class="bars" style="margin-top:22px"><div class="bar-row"><div class="bar-label">Teklif</div><div class="bar-track"><div class="bar-fill" style="width:${Number(kpis.totalCards)?Number(kpis.appointmentBooked)/Number(kpis.totalCards)*100:0}%"></div></div><div class="bar-value">${number(kpis.appointmentBooked)}</div></div><div class="bar-row"><div class="bar-label">Satış</div><div class="bar-track"><div class="bar-fill" style="width:${Number(kpis.totalCards)?Number(kpis.salesCards)/Number(kpis.totalCards)*100:0}%"></div></div><div class="bar-value">${number(kpis.salesCards)}</div></div></div></div></section></div>`;
  }

  function coordinatorSignals(rows, kpis) {
    const list=rows||[];
    const avgLead=list.length?list.reduce((sum,r)=>sum+Number(r.cards||0),0)/list.length:0;
    const teamRate=Number(kpis?.conversionRate||0);
    const red=list.filter(r=>Number(r.cards||0)>=Math.max(5,avgLead)&&Number(r.salesCards||0)===0).sort((a,b)=>Number(b.cards||0)-Number(a.cards||0)).slice(0,8);
    let strong=list.filter(r=>Number(r.cards||0)>=5&&Number(r.salesCards||0)>0&&Number(r.conversionRate||0)>=Math.max(.08,teamRate)).sort((a,b)=>Number(b.conversionRate||0)-Number(a.conversionRate||0)||Number(b.salesCards||0)-Number(a.salesCards||0)).slice(0,8);
    if(!strong.length) strong=list.filter(r=>Number(r.cards||0)>=3&&Number(r.salesCards||0)>0).sort((a,b)=>Number(b.conversionRate||0)-Number(a.conversionRate||0)).slice(0,8);
    const items=(rows,tone)=>rows.length?`<div class="signal-list">${rows.map(r=>`<div class="signal-item"><strong>${esc(r.coordinator)}</strong><div class="signal-metric"><span>Lead</span><b>${number(r.cards)}</b></div><div class="signal-metric"><span>Satış</span><b>${number(r.salesCards)}</b></div><div class="signal-metric"><span>Dönüşüm</span><b class="${tone==="red"?"cell-bad":"cell-good"}" style="padding:4px 6px;border-radius:6px">${pct(r.conversionRate)}</b></div></div>`).join("")}</div>`:`<div class="signal-empty">Bu kriterde aracı bulunmuyor.</div>`;
    return `<section class="signal-grid"><article class="panel signal-panel"><div class="signal-head red">⚑ Red Flag — Yüksek Lead, Satış Yok</div>${items(red,"red")}</article><article class="panel signal-panel"><div class="signal-head green">★ Güçlü Performans — Yüksek Dönüşüm</div>${items(strong,"green")}</article></section>`;
  }

  function renderCoordinator() {
    const d = state.coordinator;
    const k = d.kpis || {};
    $("#appContent").innerHTML = `
      <div class="view-title"><h2>Aracı Dashboard</h2><span class="updated">${esc(state.coordinatorPeriod === "genel" ? "2026 Genel" : MONTHS[Number(state.coordinatorPeriod)] || "2026")} · ${esc(new Date(d.updatedAt).toLocaleString("tr-TR"))}</span></div>
      <div class="notice"><b>Hesaplama:</b> Aracı bilgisi Source HBYS alanından alınır. Lead, teklif ve satış kayıtları Bitrix ID bazında tekilleştirilir.</div>
      ${coordinatorPeriodTabs()}
      ${coordinatorFilters(d)}
      <section class="kpis">
        ${kpi("Toplam Lead", number(k.totalCards), "Tekilleştirilmiş", "tone-blue")}
        ${kpi("Teklif Adedi", number(k.appointmentBooked), "", "tone-yellow")}
        ${kpi("Toplam Teklif Tutarı", money(k.totalQuoteAmount), "USD karşılığı", "tone-yellow")}
        ${kpi("Satış Adedi", number(k.salesCards), `Dönüşüm ${pct(k.conversionRate)}`, conversionTone(k.conversionRate))}
        ${kpi("Toplam Satış Tutarı", money(k.totalSalesAmount), "USD karşılığı", "tone-green")}
        ${kpi("Dönüşüm", pct(k.conversionRate), "Lead → satış", conversionTone(k.conversionRate))}
        ${kpi("Aktif Aracı", number(k.activeCoordinators), `Atanmamış ${number(k.unassignedCards)}`, "tone-purple")}
      </section>
      ${coordinatorVisuals(d.coordinators, k)}
      ${coordinatorSignals(d.coordinators, k)}
      <section class="panel"><div class="panel-head"><h3>Aracı Performans Tablosu</h3><span class="muted">Başlıklara tıklayarak sıralayın</span></div>${coordinatorTable(d.coordinators)}</section>
      <div class="grid-2">
        <section class="panel"><div class="section-band band-gold">ARACI → SATIŞ EKİBİ KIRILIMI</div>${coordinatorSellerTable(d.coordinatorToSeller)}</section>
        <section class="panel"><div class="section-band band-purple">SATIŞ EKİBİ – ARACI PERFORMANSI</div>${inboundTable(d.sellerInbound, "seller")}</section>
      </div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h3>Statü Dağılımı</h3></div><div class="panel-body">${statusBars(d.statusBreakdown)}</div></section>
        <section class="panel"><div class="panel-head"><h3>Bölüme Gelen Kartlar</h3></div>${inboundTable(d.departmentInbound, "department")}</section>
      </div>`;
    $("#applyCoordinator").addEventListener("click", () => {
      state.coordinatorFilters = { coordinator: $("#cCoordinator").value, seller: $("#cSeller").value, department: $("#cDepartment").value, status: $("#cStatus").value };
      loadCoordinator();
    });
    $("#clearCoordinator").addEventListener("click", () => {
      state.coordinatorFilters = { coordinator: "Tümü", seller: "Tümü", department: "Tümü", status: "Tümü" };
      loadCoordinator();
    });
    document.querySelectorAll("[data-coordinator-period]").forEach(button => button.addEventListener("click", () => {
      state.coordinatorPeriod = button.dataset.coordinatorPeriod;
      localStorage.setItem("bookimedCoordinatorPeriod", state.coordinatorPeriod);
      loadCoordinator();
    }));
    $("#coordinatorSearch")?.addEventListener("input", event => { state.coordinatorSearch=event.target.value; renderCoordinator(); requestAnimationFrame(()=>{const input=$("#coordinatorSearch"); if(input){input.focus(); input.setSelectionRange(input.value.length,input.value.length);}}); });
    document.querySelectorAll("[data-coordinator-sort]").forEach(th=>th.addEventListener("click",()=>{const key=th.dataset.coordinatorSort; state.coordinatorSort={key,dir:state.coordinatorSort.key===key&&state.coordinatorSort.dir==="desc"?"asc":"desc"}; renderCoordinator();}));
  }

  async function switchView(view) {
    if (view !== "dashboard" && view !== "coordinator") return;
    state.view = view;
    localStorage.setItem("bookimedActiveView", view);
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    if (view === "dashboard") await loadDashboard(); else await loadCoordinator();
  }

  async function refresh() {
    if (state.view === "dashboard") await loadDashboard(true); else await loadCoordinator(true);
  }

  async function logout() {
    try { await api("/api/logout", { method: "POST", body: "{}" }); } finally { location.reload(); }
  }

  function startApp() {
    if (window.__bookimedStartPromise) return window.__bookimedStartPromise;
    window.__bookimedStartPromise = (async () => {
      addStyles();
      const me = await api("/api/me");
      if (!me.user) { location.reload(); return; }
      state.user = me.user;
      shell();
      if (state.view === "coordinator") await loadCoordinator(); else await loadDashboard();
    })().catch(error => {
      window.__bookimedStartPromise = null;
      throw error;
    });
    return window.__bookimedStartPromise;
  }

  window.startApp = startApp;
  window.showApp = startApp;
  window.BookimedDashboard = { start: startApp };

  /* login.js dinamik yüklemede global fonksiyonu kaçırsa bile uygulamayı başlatır. */
  startApp().catch(error => console.error("Bookimed dashboard başlangıç hatası:", error));
})();
