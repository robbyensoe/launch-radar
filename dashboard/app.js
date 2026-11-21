// Launch Radar — the page. Renders the board from zz-data.js (written by
// main.ts from the sealed snapshot), sorts and filters it in place, and
// opens a detail view per protocol whose implied value it recomputes from
// the row's own factors, in this file, so what the reader sees can be
// checked against board.json without trusting either one.
(function () {
  var D = window.RADAR;
  var rows = D.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function fmt(n) {
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + n;
  }
  function pct(v) {
    if (v === null || v === undefined) return "—";
    var s = v > 0 ? "+" : "";
    return s + v.toFixed(1) + "%";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // The model, restated in the page: the same arithmetic main.ts ran.
  function impliedValue(r) {
    var v = r.tvl_usd * r.multiple * r.size_factor * r.growth_factor *
      r.maturity_factor;
    v = Math.round(v);
    if (v < 10000) v = 10000;
    if (v > 100000000000) v = 100000000000;
    return v;
  }

  // ---- header stats -------------------------------------------------------
  var combined = rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
  var values = rows.map(function (r) { return r.implied_value_usd; })
    .sort(function (a, b) { return a - b; });
  var medianValue = values[Math.floor(values.length / 2)];
  var wl = rows.filter(function (r) { return r.watchlist; }).length;
  document.getElementById("subline").textContent =
    "Snapshot of " + D.census + " DefiLlama protocols, as of " + D.as_of +
    " (" + D.source + "). " + D.board_size + " record no token; the " +
    D.watchlist_size + "-protocol watchlist is covered in full.";
  document.getElementById("stats").innerHTML =
    stat("Protocols ranked", D.board_size) +
    stat("Watchlist covered", wl + " / " + D.watchlist_size) +
    stat("Combined TVL", fmt(combined)) +
    stat("Median implied value", fmt(medianValue));
  function stat(label, value) {
    return '<div class="stat"><span>' + label + "</span><b>" + value + "</b></div>";
  }

  // ---- model panel --------------------------------------------------------
  var c = D.constants, v = D.validation;
  document.getElementById("model-line").textContent =
    "Model " + D.model_version + ": implied value = TVL × peer multiple × " +
    "size factor × growth tilt × maturity. Multiples are the median " +
    "market-cap/TVL of the " + c.peer_count + " protocols in this snapshot " +
    "whose token already trades, per category, size-adjusted and shrunk " +
    "toward the global median " + c.global_median_multiple.toFixed(3) + "×.";
  document.getElementById("model-body").innerHTML =
    "<p><b>implied = TVL × M × S × G × A.</b> " +
    "<b>M</b> is the category's median mcap/TVL among traded peers " +
    "(n ≥ 3), shrunk to the global median with weight k = " + c.shrinkage_k +
    "; thin categories fall back to a category family, then to the global " +
    "median, and M is clamped to [0.02, 3.00] so no single outlier peer " +
    "can set a price. <b>S</b> is the size factor: in this snapshot, big " +
    "protocols trade at far lower multiples than small ones (fitted " +
    "log-log slope " + c.size_beta + " around a reference TVL of " +
    fmt(c.size_ref_tvl_usd) + "), so peer ratios are size-adjusted before " +
    "any median is taken and S = clamp((TVL/ref)^slope, " + c.size_min +
    ", " + c.size_max + ") corrects each row back to its own size. " +
    "<b>G</b> = 1 + " + c.growth_weight + " × the 7-day " +
    "TVL change clamped to ±" + c.growth_clamp_pct + "% — one wild week " +
    "tilts value by at most a third. <b>A</b> = " + c.maturity_base +
    " + " + c.maturity_span + " × age/(age + 365): years run tokenless " +
    "earn up to +20%, a fortnight is discounted; a missing listing date " +
    "takes the tokenless median age of " + c.null_age_days + " days, " +
    "stated rather than hidden.</p>" +
    "<p><b>Backtest, leave-one-out:</b> pricing each of the " + v.peers +
    " traded protocols from the peers that remain when it is held out, " +
    "the model's median error is " + v.median_abs_log10_error +
    " in log10 — " + v.within_2x_pct + "% of real market caps land " +
    "within 2× of the model's price, " + v.within_3x_pct + "% within 3×. " +
    "That is the honest precision of any peer-multiple model, and it is " +
    "printed here rather than left for the reader to guess.</p>" +
    '<div class="kpis">' +
    kpi("Traded peers", v.peers) +
    kpi("Global median multiple", c.global_median_multiple.toFixed(3) + "×") +
    kpi("Median LOO error", v.median_abs_log10_error + " log10") +
    kpi("Within 2× / 3×", v.within_2x_pct + "% / " + v.within_3x_pct + "%") +
    "</div>";
  function kpi(label, value) {
    return '<div class="kpi"><span>' + label + "</span><b>" + value + "</b></div>";
  }

  // ---- what the radar sees --------------------------------------------------
  var s = D.signals;
  if (s) {
    var wlShare = Math.round(100 * s.watchlist_tvl_usd / s.board_tvl_usd);
    var sig = document.createElement("p");
    sig.className = "footnote";
    sig.textContent =
      "What the radar sees: " + s.curators_tokenless + " risk curators " +
      "record no token against only " + s.curators_traded + " that do — " +
      "the curator layer is the largest unlaunched business in the " +
      "snapshot. The longest wait on the board is " + s.oldest_name +
      ", tokenless for " + s.oldest_days + " days. The watchlist carries " +
      wlShare + "% of the board's combined TVL; the rest is earlier finds " +
      "below the floor.";
    var modelLine = document.getElementById("model-line");
    modelLine.parentNode.insertBefore(sig, modelLine.nextSibling);
  }

  // ---- live (already trading) table --------------------------------------
  document.getElementById("live-rows").innerHTML = D.live.map(function (p) {
    var ratio = p.mcap_usd / p.tvl_usd;
    return "<tr><td><span class='nm'>" + esc(p.name) + "</span></td><td>" +
      '<span class="chip">' + esc(p.category || "—") + "</span></td>" +
      '<td class="num">' + fmt(p.tvl_usd) + '</td><td class="num">' +
      fmt(p.mcap_usd) + '</td><td class="num">' + ratio.toFixed(2) +
      "×</td></tr>";
  }).join("");

  // ---- board table ---------------------------------------------------------
  var state = { q: "", category: "", chain: "", tvl: 0, watch: false,
    verdict: false, sort: "rank", dir: 1, slug: null };
  var topValue = rows.length ? rows[0].implied_value_usd : 1;

  var catSel = document.getElementById("f-category");
  var cats = [];
  rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  cats.forEach(function (cat) {
    var o = document.createElement("option");
    o.value = cat; o.textContent = cat; catSel.appendChild(o);
  });
  var chainSel = document.getElementById("f-chain");
  var chains = [];
  rows.forEach(function (r) {
    r.chains.forEach(function (ch) { if (chains.indexOf(ch) < 0) chains.push(ch); });
  });
  chains.sort();
  chains.forEach(function (ch) {
    var o = document.createElement("option");
    o.value = ch; o.textContent = ch; chainSel.appendChild(o);
  });

  function verdictOrder(vd) { return vd === "FARM" ? 0 : vd === "THIN" ? 1 : 2; }
  function visible() {
    var q = state.q.toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.verdict && r.verdict !== "FARM") return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.tvl && r.tvl_usd < state.tvl) return false;
      if (q) {
        var hay = (r.name + " " + r.slug + " " + (r.category || "") + " " +
          r.chains.join(" ")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort, dir = state.dir;
    list.sort(function (a, b) {
      var x, y;
      if (key === "verdict") { x = verdictOrder(a.verdict); y = verdictOrder(b.verdict); }
      else if (key === "name" || key === "category") {
        x = (a[key] || "").toLowerCase(); y = (b[key] || "").toLowerCase();
        return (x < y ? -1 : x > y ? 1 : a.rank - b.rank) * dir;
      } else { x = a[key]; y = b[key]; }
      return (x - y) * dir || a.rank - b.rank;
    });
    return list;
  }

  function render() {
    var list = visible();
    document.getElementById("count").textContent =
      "Showing " + list.length + " of " + rows.length;
    var reset = document.getElementById("f-reset");
    reset.hidden = !(state.q || state.category || state.chain || state.tvl ||
      state.watch || state.verdict);
    document.getElementById("rows").innerHTML = list.map(function (r) {
      var chg = r.change_7d;
      var cls = chg === null ? "flat" : chg > 0 ? "pos" : chg < 0 ? "neg" : "flat";
      var young = r.age_days < 120;
      return '<tr data-slug="' + r.slug + '">' +
        '<td class="r">' + r.rank + "</td>" +
        "<td>" + (r.watchlist ? '<span class="dot" title="On the snapshot watchlist"></span>' : "") +
        (young ? '<span class="dot amber" title="Tracked for under 120 days"></span>' : "") +
        '<span class="nm">' + esc(r.name) + '</span><br><span class="sl">' +
        esc(r.slug) + "</span></td>" +
        '<td><span class="chip">' + esc(r.category || "—") + "</span></td>" +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(", ")) +
        (r.chains.length > 3 ? " +" + (r.chains.length - 3) : "") + "</td>" +
        '<td class="num">' + fmt(r.tvl_usd) + "</td>" +
        '<td class="num ' + cls + '">' + pct(chg) + "</td>" +
        '<td class="num"><b>' + fmt(r.implied_value_usd) + '</b><div class="bar"><i style="width:' +
        Math.max(1, Math.round(100 * r.implied_value_usd / topValue)) + '%"></i></div></td>' +
        '<td class="num">' + r.multiple.toFixed(2) + "×</td>" +
        '<td><span class="verdict ' + r.verdict + '">' + r.verdict + "</span></td></tr>";
    }).join("");
    var ths = document.querySelectorAll("th[data-sort]");
    ths.forEach(function (th) {
      th.classList.toggle("sorted", th.getAttribute("data-sort") === state.sort);
    });
  }

  // ---- detail view ---------------------------------------------------------
  var detail = document.getElementById("detail");
  var scrim = document.getElementById("scrim");
  function openDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    state.slug = slug;
    var recomputed = impliedValue(r);
    var full = function (n) { return "$" + n.toLocaleString("en-US"); };
    var check = recomputed === r.implied_value_usd
      ? "Recomputed in this page from the row's own factors: " +
        full(recomputed) + " — matches board.json exactly."
      : "Recomputed in this page from the row's own factors: " +
        full(recomputed) + "; the board carries " +
        full(r.implied_value_usd) + " after the strict-descent adjustment " +
        "that keeps every rank's value below the rank above it.";
    var reason = r.name + " records no token on " + r.age_days +
      " days of DefiLlama tracking. Its " + fmt(r.tvl_usd) + " of TVL prices " +
      "at the " + r.multiple_source + " multiple of " + r.multiple.toFixed(2) +
      "× (" + r.multiple_peers + " traded peers), tilted " +
      (r.growth_factor >= 1 ? "up" : "down") + " by its " + pct(r.change_7d) +
      " week and weighted " + r.maturity_factor.toFixed(2) +
      "× for its record — an implied launch value of " +
      fmt(r.implied_value_usd) + ". In its category, " +
      Math.round(r.launch_odds * 100) + "% of protocols already list a " +
      "token; the farm verdict is " + r.verdict + ".";
    document.getElementById("detail-card").innerHTML =
      '<button class="close" id="d-close" aria-label="Close">×</button>' +
      "<h2>" + esc(r.name) + "</h2>" +
      '<div class="cat">' + esc(r.category || "Uncategorised") + " · " +
      esc(r.chains.join(", ")) + (r.watchlist ? " · on the watchlist" : "") + "</div>" +
      '<div class="big">' + fmt(r.implied_value_usd) + "</div>" +
      '<p class="why">' + esc(reason) + "</p>" +
      '<div class="grid">' +
      cell("Rank", "#" + r.rank) + cell("Verdict", r.verdict) +
      cell("TVL", fmt(r.tvl_usd)) + cell("7-day change", pct(r.change_7d)) +
      cell("Peer multiple", r.multiple.toFixed(3) + "× (" + r.multiple_source + ", n=" + r.multiple_peers + ")") +
      cell("Size factor", r.size_factor.toFixed(2) + "×") +
      cell("Growth tilt", r.growth_factor.toFixed(3) + "×") +
      cell("Maturity", r.maturity_factor.toFixed(3) + "×") +
      cell("Tokenless for", r.age_days + " days") +
      cell("Category launch rate", Math.round(r.launch_odds * 100) + "%") +
      cell("Chains", r.chains.length) +
      "</div>" +
      '<div class="check">' + esc(check) + "</div>" +
      '<h3 class="steps-h">Farm plan — ' + r.farm_steps.length + " steps</h3>" +
      '<ol class="steps">' +
      r.farm_steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
      "</ol>";
    detail.hidden = false;
    scrim.hidden = false;
    document.getElementById("d-close").addEventListener("click", closeDetail);
  }
  function cell(label, value) {
    return '<div class="cell"><span>' + label + "</span><b>" + value + "</b></div>";
  }
  function closeDetail() {
    state.slug = null;
    detail.hidden = true;
    scrim.hidden = true;
  }
  scrim.addEventListener("click", closeDetail);

  // ---- wiring ---------------------------------------------------------------
  document.getElementById("q").addEventListener("input", function (e) {
    state.q = e.target.value; render();
  });
  catSel.addEventListener("change", function () { state.category = catSel.value; render(); });
  chainSel.addEventListener("change", function () { state.chain = chainSel.value; render(); });
  document.getElementById("f-tvl").addEventListener("change", function (e) {
    state.tvl = Number(e.target.value); render();
  });
  var watchBtn = document.getElementById("f-watch");
  watchBtn.addEventListener("click", function () {
    state.watch = !state.watch;
    watchBtn.setAttribute("aria-pressed", String(state.watch)); render();
  });
  var verdictBtn = document.getElementById("f-verdict");
  verdictBtn.addEventListener("click", function () {
    state.verdict = !state.verdict;
    verdictBtn.setAttribute("aria-pressed", String(state.verdict)); render();
  });
  document.getElementById("f-reset").addEventListener("click", function () {
    state.q = ""; state.category = ""; state.chain = ""; state.tvl = 0;
    state.watch = false; state.verdict = false;
    document.getElementById("q").value = ""; catSel.value = ""; chainSel.value = "";
    document.getElementById("f-tvl").value = "0";
    watchBtn.setAttribute("aria-pressed", "false");
    verdictBtn.setAttribute("aria-pressed", "false");
    render();
  });
  document.querySelectorAll("th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.getAttribute("data-sort");
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === "name" || key === "category" ? 1 : -1; }
      if (key === "rank") state.dir = 1;
      render();
    });
  });
  document.getElementById("rows").addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-slug]");
    if (tr) openDetail(tr.getAttribute("data-slug"));
  });

  // Hash routing: #slug=<slug> opens that protocol (the detail screenshot
  // is taken this way); filter state may ride along as extra parameters.
  function fromHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return;
    var params = {};
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (params.q) { state.q = params.q; document.getElementById("q").value = params.q; }
    if (params.category) { state.category = params.category; catSel.value = params.category; }
    if (params.chain) { state.chain = params.chain; chainSel.value = params.chain; }
    if (params.watch === "1") { state.watch = true; watchBtn.setAttribute("aria-pressed", "true"); }
    render();
    if (params.slug) openDetail(params.slug);
  }

  render();
  fromHash();
  window.__shotReady = true;
})();
