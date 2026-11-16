// Token Radar dashboard (radar-2). Reads window.RADAR — written beside this page by main.ts —
// and renders the ranked board, a live-token view, filters, sorting and a per-protocol detail
// panel with the model's own arithmetic and the protocol's farm plan. No network: every byte
// it shows arrived in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;

  var state = {
    tab: 'board',
    q: '',
    category: 'all',
    chain: 'all',
    watchlistOnly: false,
    hideWrapped: false,
    sort: 'rank',
    shown: 60,
    selected: DATA.rows.length ? DATA.rows[0].slug : null,
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function bySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }

  var categories = [];
  var chains = [];
  (function collect() {
    var seenC = {}, seenH = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Uncategorised';
      if (!seenC[c]) { seenC[c] = 1; categories.push(c); }
      r.chains.forEach(function (h) { if (!seenH[h]) { seenH[h] = 1; chains.push(h); } });
    });
    categories.sort();
    chains.sort();
  })();

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.hideWrapped && r.wrapped_product) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'implied') return b.implied_value_usd - a.implied_value_usd;
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d || 0) - (a.change_7d || 0);
      if (key === 'age') return (b.age_days || 0) - (a.age_days || 0);
      return a.rank - b.rank;
    });
    return rows;
  }

  function badges(r) {
    var out = '';
    if (r.watchlist) out += '<span class="badge wl">WATCHLIST</span>';
    if (r.wrapped_product) out += '<span class="badge wrap">WRAPPED PRODUCT</span>';
    return out;
  }

  function rowHtml(r) {
    var m = r.model;
    var factors = 'x' + m.sector_multiple.toFixed(2) + ' sec · x' + m.momentum.toFixed(2) + ' mom · x' +
      m.maturity.toFixed(2) + ' mat · x' + m.breadth.toFixed(2) + ' brd' +
      (m.product_factor !== 1 ? ' · x' + m.product_factor.toFixed(2) + ' prod' : '');
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td class="l"><span class="pname">' + esc(r.name) + '</span>' + badges(r) +
      '<span class="pslug">' + esc(r.slug) + '</span></td>' +
      '<td class="l cat">' + esc(r.category || '—') + '</td>' +
      '<td class="l chains">' + esc(r.chains.slice(0, 3).join(', ') || '—') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
      '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + fmtPct(r.change_7d) + '</td>' +
      '<td class="num">' + fmtAge(r.age_days) + '</td>' +
      '<td class="implied">' + fmtUsd(r.implied_value_usd) + '</td>' +
      '<td class="l factors">' + factors + '</td></tr>';
  }

  function farmHtml(r) {
    var items = r.farm_steps.map(function (s) {
      var parts = s.split(' Cost: ');
      var head = parts[0];
      var tail = parts.length > 1 ? 'Cost: ' + parts.slice(1).join(' Cost: ') : '';
      return '<li>' + esc(head) + (tail ? '<span class="ct">' + esc(tail) + '</span>' : '') + '</li>';
    }).join('');
    return '<h3>Farm plan — before any launch</h3><ol class="farm">' + items + '</ol>';
  }

  function detailHtml() {
    var r = bySlug(state.selected);
    if (!r) return '<div class="detail"><div class="empty">Select a protocol on the board to see its model and farm plan.</div></div>';
    var m = r.model;
    var arith = fmtUsd(r.tvl_usd) + ' TVL x <b>' + m.sector_multiple.toFixed(2) + '</b> sector (' + esc(r.category || 'default') + ')' +
      ' x <b>' + m.momentum.toFixed(2) + '</b> momentum (' + fmtPct(m.momentum_pct) + ' 7d)' +
      ' x <b>' + m.maturity.toFixed(2) + '</b> maturity (' + fmtAge(r.age_days) + ')' +
      ' x <b>' + m.breadth.toFixed(2) + '</b> breadth (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')' +
      (m.product_factor !== 1 ? ' x <b>' + m.product_factor.toFixed(2) + '</b> wrapped-product discount' : '') +
      ' = <b>' + fmtUsd(r.implied_value_usd) + '</b>';
    var note = r.wrapped_product
      ? '<div class="note">This protocol is a wrapped, staked or bridged product of an asset that already trades. The radar discounts it to x' +
        DATA.product_factor.toFixed(2) + ': a launch of its own would not capture the full TVL, and the house watchlist leaves such products out for the same reason.</div>'
      : '';
    return '<div class="detail"><h2>' + esc(r.name) + badges(r) + '</h2>' +
      '<div class="sub">' + esc(r.slug) + ' · rank #' + r.rank + ' of ' + DATA.board_size + ' · ' + esc(r.category || 'Uncategorised') + '</div>' +
      '<div class="big"><small>IMPLIED VALUE AT LAUNCH</small>' + fmtUsd(r.implied_value_usd) + '</div>' +
      '<div class="kv">' +
      '<div><span>TVL</span><span>' + fmtUsd(r.tvl_usd) + '</span></div>' +
      '<div><span>7d change</span><span>' + fmtPct(r.change_7d) + '</span></div>' +
      '<div><span>Tracked for</span><span>' + fmtAge(r.age_days) + '</span></div>' +
      '<div><span>Token</span><span>none recorded</span></div>' +
      '<div><span>Chains</span><span>' + r.chains.length + '</span></div>' +
      '<div><span>Watchlist</span><span>' + (r.watchlist ? 'yes' : 'below floor') + '</span></div>' +
      '</div>' +
      '<div class="arith">' + arith + '</div>' + note + farmHtml(r) + '</div>';
  }

  function liveHtml() {
    var rows = DATA.live.map(function (r, i) {
      return '<tr><td class="rank">' + (i + 1) + '</td>' +
        '<td class="l"><span class="pname">' + esc(r.name) + '</span><span class="pslug">' + esc(r.slug) + '</span></td>' +
        '<td class="l cat">' + esc(r.category || '—') + '</td>' +
        '<td class="l chains">' + esc(r.chains.slice(0, 3).join(', ')) + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="implied">' + fmtUsd(r.mcap_usd) + '</td><td class="l factors">market value, not a model</td></tr>';
    }).join('');
    return '<div class="boardbox"><table><thead><tr><th class="l">#</th><th class="l">Protocol</th><th class="l">Category</th>' +
      '<th class="l">Chains</th><th>TVL</th><th>7d</th><th>Market cap</th><th class="l">Value</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p style="color:var(--dim);font-size:12.5px">These protocols already have a token: the market prices them, so the radar does not rank them. ' +
      'They are shown so the board\u2019s pre-token ranking is never mistaken for the whole market.</p>';
  }

  function render() {
    var sectorRows = Object.keys(DATA.sector_multiples).sort().map(function (k) {
      return '<div><span>' + esc(k) + '</span><span>x' + DATA.sector_multiples[k].toFixed(2) + '</span></div>';
    }).join('');
    var head =
      '<div class="wrap"><header class="top"><div class="wordmark">TOKEN<span class="dot">·</span>RADAR</div>' +
      '<div class="tagline">Every pre-token protocol in the snapshot, ranked by what its token would be worth at launch — and how to farm it first.</div>' +
      '<div class="meta">model ' + esc(DATA.model_version) + '<br>snapshot ' + esc(DATA.as_of) + '</div></header>' +
      '<div class="stats">' +
      '<span class="chip"><b>' + DATA.scanned + '</b> protocols scanned</span>' +
      '<span class="chip hot"><b>' + DATA.board_size + '</b> ranked pre-token</span>' +
      '<span class="chip"><b>' + DATA.watchlist_size + '/' + DATA.watchlist_size + '</b> watchlist covered</span>' +
      '<span class="chip"><b>' + DATA.wrapped_size + '</b> wrapped products discounted</span>' +
      '<span class="chip"><b>' + DATA.live_size + '</b> live tokens set aside</span></div>' +
      '<section class="model"><div><h2>The model — stated, not hidden</h2>' +
      '<div class="formula">implied = TVL x sector x momentum x maturity x breadth x product</div>' +
      '<p><b>Momentum</b> is the 7-day TVL change, clamped and weighted 0.6. <b>Maturity</b> rises with the protocol\u2019s tracked age. ' +
      '<b>Breadth</b> adds 4% per extra chain, to six. <b>Product</b> is x' + DATA.product_factor.toFixed(2) + ' for wrapped, staked or bridged products of assets that already trade, x1 otherwise. ' +
      'No protocol name is special-cased: the same arithmetic scores every row, and each row\u2019s detail shows its own factors.</p></div>' +
      '<div><h2>Sector multiples — share of TVL a launch plausibly captures</h2><div class="sectors">' + sectorRows +
      '<div><span>Any other sector</span><span>x' + DATA.default_multiple.toFixed(2) + '</span></div></div></div></section>';

    var tabs = '<div class="tabs"><button class="tab' + (state.tab === 'board' ? ' on' : '') + '" data-tab="board">Pre-token board</button>' +
      '<button class="tab' + (state.tab === 'live' ? ' on' : '') + '" data-tab="live">Live tokens — already trading</button></div>';

    var body = '';
    if (state.tab === 'live') {
      body = tabs + liveHtml();
    } else {
      var rows = filtered();
      var visible = rows.slice(0, state.shown);
      var table = '<div class="boardbox"><table><thead><tr><th class="l">#</th><th class="l">Protocol</th><th class="l">Category</th>' +
        '<th class="l">Chains</th><th>TVL</th><th>7d</th><th>Age</th><th>Implied value</th><th class="l">Model factors</th></tr></thead><tbody>' +
        (visible.length ? visible.map(rowHtml).join('') : '<tr><td colspan="9"><div class="empty">No protocol matches these filters.</div></td></tr>') +
        '</tbody></table>' +
        (rows.length > state.shown ? '<div class="more"><button class="act" id="more">Show more — ' + (rows.length - state.shown) + ' of ' + rows.length + ' still hidden</button></div>' : '') +
        '</div>';
      var controls = '<div class="controls">' +
        '<input type="search" id="q" placeholder="Search name or slug" value="' + esc(state.q) + '">' +
        '<select id="cat"><option value="all">All categories</option>' + categories.map(function (c) {
          return '<option' + (state.category === c ? ' selected' : '') + ' value="' + esc(c) + '">' + esc(c) + '</option>';
        }).join('') + '</select>' +
        '<select id="chain"><option value="all">All chains</option>' + chains.map(function (c) {
          return '<option' + (state.chain === c ? ' selected' : '') + ' value="' + esc(c) + '">' + esc(c) + '</option>';
        }).join('') + '</select>' +
        '<select id="sort">' +
        [['rank', 'Sort: radar rank'], ['implied', 'Sort: implied value'], ['tvl', 'Sort: TVL'], ['growth', 'Sort: 7d growth'], ['age', 'Sort: age']]
          .map(function (o) { return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select>' +
        '<label class="tgl"><input type="checkbox" id="wl"' + (state.watchlistOnly ? ' checked' : '') + '> Watchlist only</label>' +
        '<label class="tgl"><input type="checkbox" id="hw"' + (state.hideWrapped ? ' checked' : '') + '> Hide wrapped products</label>' +
        '<span class="count">' + rows.length + ' shown</span></div>';
      body = tabs + controls + '<div class="stage"><div>' + table + '</div>' + detailHtml() + '</div>';
    }

    var foot = '<footer><span>Data: ' + esc(DATA.source) + '</span><span>Implied value is this model\u2019s claim, stated so it can be argued with — not a prediction that a token will launch.</span></footer></div>';
    app.innerHTML = head + body + foot;
    app.setAttribute('aria-busy', 'false');
    wire(rows);
  }

  function wire(rows) {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; state.shown = 60; renderSoft(); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; state.shown = 60; render(); });
    var chain = document.getElementById('chain');
    if (chain) chain.addEventListener('change', function () { state.chain = chain.value; state.shown = 60; render(); });
    var sort = document.getElementById('sort');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; render(); });
    var wl = document.getElementById('wl');
    if (wl) wl.addEventListener('change', function () { state.watchlistOnly = wl.checked; state.shown = 60; render(); });
    var hw = document.getElementById('hw');
    if (hw) hw.addEventListener('change', function () { state.hideWrapped = hw.checked; state.shown = 60; render(); });
    var more = document.getElementById('more');
    if (more) more.addEventListener('click', function () { state.shown += 120; render(); });
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function () { state.tab = this.getAttribute('data-tab'); render(); });
    var trs = document.querySelectorAll('tbody tr[data-slug]');
    for (var j = 0; j < trs.length; j++) trs[j].addEventListener('click', function () {
      state.selected = this.getAttribute('data-slug');
      render();
      var d = document.querySelector('.detail');
      if (d && window.innerWidth <= 1080) d.scrollIntoView({ block: 'start' });
    });
  }

  // Search re-renders the table only, so typing does not lose focus.
  function renderSoft() {
    var rows = filtered();
    var tbody = document.querySelector('tbody');
    if (!tbody) { render(); return; }
    var visible = rows.slice(0, state.shown);
    tbody.innerHTML = visible.length ? visible.map(rowHtml).join('') : '<tr><td colspan="9"><div class="empty">No protocol matches these filters.</div></td></tr>';
    var count = document.querySelector('.controls .count');
    if (count) count.textContent = rows.length + ' shown';
    wire(rows);
  }

  render();
})();
