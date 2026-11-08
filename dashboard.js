let dashTimeChartInstance = null;
let dashDistChartInstance = null;

function dashExtractMonth(dataStr, id) {
  if (dataStr != null) {
    var s = String(dataStr).trim();
    if (s) {
      var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (m) {
        var dia = parseInt(m[1], 10);
        var mes = parseInt(m[2], 10);
        var ano = parseInt(m[3], 10);
        if (ano < 100) ano += (ano < 70 ? 2000 : 1900);
        if (mes > 12 && dia <= 12) { var tmp = dia; dia = mes; mes = tmp; }
        if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100) {
          return { key: ano + '-' + String(mes).padStart(2,'0'), ano: ano, mes: mes, dia: dia, source: 'data' };
        }
      }
    }
  }
  return { key: null, source: null };
}

function dashToMoney(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).trim().replace(/[R$\s\u00a0\u202f]/g, '');
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g,'').replace(',','.');
  else if (s.indexOf(',') >= 0) s = s.replace(',','.');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function dashFmtMonthLabel(key) {
  if (!key) return '—';
  var parts = key.split('-');
  var y = parts[0], m = parts[1];
  var M = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var idx = parseInt(m,10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return key;
  return M[idx] + '/' + (y||'').slice(-2);
}

function dashInit() {
  const hist = (data && data.historico) ? data.historico : [];
  if (hist.length === 0) {
    document.getElementById('noDataDash').style.display = 'block';
    document.getElementById('dashContent').style.display = 'none';
    return;
  }
  document.getElementById('noDataDash').style.display = 'none';
  document.getElementById('dashContent').style.display = 'block';
  
  dashPopulateEstabs();
  dashApplyFilters();
}

function dashOnPeriodChange() {
  var p = document.getElementById('dashPeriod').value;
  document.getElementById('dashCFrom').style.display = p === 'custom' ? 'flex' : 'none';
  document.getElementById('dashCTo').style.display = p === 'custom' ? 'flex' : 'none';
  dashApplyFilters();
}

function dashGetPeriodRange() {
  var p = document.getElementById('dashPeriod').value;
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  var from = null, to = null;
  if (p === 'thisMonth') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = today; }
  else if (p === 'lastMonth') { from = new Date(now.getFullYear(), now.getMonth()-1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); }
  else if (p === 'last3') { from = new Date(now.getFullYear(), now.getMonth()-2, 1); to = today; }
  else if (p === 'last6') { from = new Date(now.getFullYear(), now.getMonth()-5, 1); to = today; }
  else if (p === 'thisYear') { from = new Date(now.getFullYear(), 0, 1); to = today; }
  else if (p === 'lastYear') { from = new Date(now.getFullYear()-1, 0, 1); to = new Date(now.getFullYear()-1, 11, 31, 23, 59, 59); }
  else if (p === 'custom') {
    var fv = document.getElementById('dashDateFrom').value, tv = document.getElementById('dashDateTo').value;
    if (fv) { var p1 = fv.split('-'); from = new Date(+p1[0], +p1[1]-1, +p1[2]); }
    if (tv) { var p2 = tv.split('-'); to = new Date(+p2[0], +p2[1]-1, +p2[2], 23, 59, 59); }
  }
  return { from: from, to: to };
}

let dashFiltered = [];

function dashApplyFilters() {
  var range = dashGetPeriodRange();
  var from = range.from, to = range.to;
  var estab = document.getElementById('dashEstabFilter').value;
  var pay = document.getElementById('dashPayFilter').value;
  var isAll = !from && !to;
  
  dashFiltered = [];
  (data.historico || []).forEach(function(h) {
    if (!h) return;
    var info = dashExtractMonth(h.data, h.id);
    if (!info.key) {
      if (!isAll) return;
    } else {
      var d = new Date(info.ano, info.mes - 1, info.dia);
      if (from && d < from) return;
      if (to && d > to) return;
    }
    if (estab && h.estabelecimento !== estab) return;
    if (pay && h.metodoPagamento !== pay) return;
    dashFiltered.push(h);
  });
  
  dashRender();
}

function dashRender() {
  dashRenderKPIs();
  dashRenderTimeChart();
  dashRenderDistChart();
  dashRenderMonthComparison();
  dashRenderTopEstabs();
  dashRenderTopProducts();
  dashRenderTable();
}

function dashRenderKPIs() {
  var total = 0, count = dashFiltered.length, biggest = 0, items = 0;
  dashFiltered.forEach(function(h) {
    var t = dashToMoney(h.total);
    total += t;
    if (t > biggest) biggest = t;
    (h.itens || []).forEach(function(it){ items += (Number(it.qtd) || 0); });
  });
  var avg = count > 0 ? total / count : 0;

  var now = new Date();
  var thisKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  var lastDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  var lastKey = lastDate.getFullYear() + '-' + String(lastDate.getMonth()+1).padStart(2,'0');
  var thisTotal = 0, lastTotal = 0;
  dashFiltered.forEach(function(h) {
    var info = dashExtractMonth(h.data, h.id);
    if (!info.key) return;
    var t = dashToMoney(h.total);
    if (info.key === thisKey) thisTotal += t;
    if (info.key === lastKey) lastTotal += t;
  });
  
  var deltaHtml = '<div class="sub">—</div>';
  if (lastTotal > 0) {
    var d = ((thisTotal - lastTotal) / lastTotal) * 100;
    var arrow = d > 0 ? '▲' : '▼';
    var color = d > 0 ? '#ef4444' : '#059669';
    deltaHtml = '<div class="sub">Mês atual: <b style="color:' + color + '">' + arrow + ' ' + Math.abs(d).toFixed(1) + '%</b> vs anterior</div>';
  }

  var monthly = {};
  dashFiltered.forEach(function(h) {
    var info = dashExtractMonth(h.data, h.id);
    if (!info.key) return;
    if (!monthly[info.key]) monthly[info.key] = 0;
    monthly[info.key] += dashToMoney(h.total);
  });
  var mVals = Object.keys(monthly).map(function(k){ return monthly[k]; });
  var mAvg = mVals.length ? mVals.reduce(function(a,b){return a+b;},0) / mVals.length : 0;

  document.getElementById('dashKpis').innerHTML =
    '<div class="dash-kpi"><div class="lbl">💰 Total</div><div class="val">' + money(total) + '</div>' + deltaHtml + '</div>' +
    '<div class="dash-kpi green"><div class="lbl">🧾 Contas</div><div class="val">' + count + '</div><div class="sub">' + items + ' itens</div></div>' +
    '<div class="dash-kpi yellow"><div class="lbl">🎯 Ticket Médio</div><div class="val">' + money(avg) + '</div></div>' +
    '<div class="dash-kpi purple"><div class="lbl">📈 Maior</div><div class="val">' + money(biggest) + '</div></div>' +
    '<div class="dash-kpi pink"><div class="lbl">📅 Média/Mês</div><div class="val">' + money(mAvg) + '</div></div>';
}

function dashGroupTimeSeries() {
  var grp = document.getElementById('dashTimeGroup').value;
  var groups = {};
  dashFiltered.forEach(function(h) {
    var info = dashExtractMonth(h.data, h.id);
    if (!info.key) return;
    var key, label;
    if (grp === 'month') { key = info.key; label = dashFmtMonthLabel(key); }
    else if (grp === 'week') {
      var d = new Date(info.ano, info.mes-1, info.dia);
      var start = new Date(d.getFullYear(), 0, 1);
      var w = Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
      key = info.ano + '-S' + String(w).padStart(2,'0');
      label = 'Sem ' + w;
    } else {
      key = info.key + '-' + String(info.dia).padStart(2,'0');
      label = String(info.dia).padStart(2,'0') + '/' + String(info.mes).padStart(2,'0');
    }
    if (!groups[key]) groups[key] = { label: label, total: 0, count: 0 };
    groups[key].total += dashToMoney(h.total);
    groups[key].count += 1;
  });
  return Object.keys(groups).sort().map(function(k){ var g = groups[k]; g.key = k; return g; });
}

function dashRenderTimeChart() {
  if (typeof Chart === 'undefined') return;
  var metric = document.getElementById('dashTimeMetric').value;
  var type = document.getElementById('dashTimeType').value;
  var series = dashGroupTimeSeries();
  var labels = series.map(function(s){ return s.label; });
  var values;
  if (metric === 'count') values = series.map(function(s){ return s.count; });
  else if (metric === 'avg') values = series.map(function(s){ return s.count > 0 ? s.total / s.count : 0; });
  else values = series.map(function(s){ return s.total; });
  
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var accent = isDark ? '#39c97a' : '#2563eb';
  var gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  var textColor = isDark ? '#aeb8c8' : '#64748b';
  
  if (dashTimeChartInstance) { dashTimeChartInstance.destroy(); dashTimeChartInstance = null; }
  
  var chartType = type === 'area' ? 'line' : type;
  var ctx = document.getElementById('dashTimeChart').getContext('2d');
  dashTimeChartInstance = new Chart(ctx, {
    type: chartType,
    data: { labels: labels, datasets: [{
      label: metric === 'count' ? 'Contas' : metric === 'avg' ? 'Ticket Médio' : 'Total (R$)',
      data: values,
      backgroundColor: (chartType === 'line' || chartType === 'radar') ? (isDark ? 'rgba(57,201,122,.15)' : 'rgba(37,99,235,.15)') : accent,
      borderColor: accent, borderWidth: 2,
      fill: type === 'area', tension: .3,
      pointBackgroundColor: accent, pointBorderColor: isDark ? '#0d1016' : '#fff',
      pointRadius: chartType === 'line' ? 4 : 0, pointHoverRadius: 6,
      borderRadius: chartType === 'bar' ? 6 : 0
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx){ var v = Number(ctx.raw) || 0; return metric === 'count' ? v + ' contas' : money(v); } } }
      },
      scales: chartType === 'radar' ? {
        r: { ticks: { color: textColor, backdropColor: 'transparent' }, grid: { color: gridColor }, angleLines: { color: gridColor }, pointLabels: { color: textColor } }
      } : {
        x: { ticks: { color: textColor, maxRotation: 45 }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor, callback: function(v){ return metric === 'count' ? v : 'R$ ' + v.toLocaleString('pt-BR'); } }, grid: { color: gridColor } }
      }
    }
  });
}

function dashRenderDistChart() {
  if (typeof Chart === 'undefined') return;
  var grp = document.getElementById('dashDistGroup').value;
  var type = document.getElementById('dashDistType').value;
  var groups = {};
  dashFiltered.forEach(function(h) {
    var k = grp === 'estab' ? (h.estabelecimento || '—') : (h.metodoPagamento || 'Não informado');
    if (!groups[k]) groups[k] = 0;
    groups[k] += dashToMoney(h.total);
  });
  var entries = Object.keys(groups).map(function(k){ return [k, groups[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
  var labels = entries.map(function(e){ return e[0]; });
  var values = entries.map(function(e){ return e[1]; });
  var palette = ['#2563eb','#10b981','#fbbf24','#8b5cf6','#ec4899','#0ea5e9','#f97316','#14b8a6','#a855f7','#ef4444','#84cc16','#06b6d4'];
  
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var textColor = isDark ? '#aeb8c8' : '#64748b';
  var gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  
  if (dashDistChartInstance) { dashDistChartInstance.destroy(); dashDistChartInstance = null; }
  
  var isCircular = ['pie','doughnut','polarArea'].indexOf(type) >= 0;
  var ctx = document.getElementById('dashDistChart').getContext('2d');
  dashDistChartInstance = new Chart(ctx, {
    type: type,
    data: { labels: labels, datasets: [{
      data: values,
      backgroundColor: palette.slice(0, Math.max(labels.length, 1)),
      borderColor: isDark ? '#191e28' : '#fff', borderWidth: 2
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: isCircular ? 'bottom' : 'top', labels: { color: textColor, boxWidth: 12, padding: 10, font: { size: 12 } } },
        tooltip: { callbacks: { label: function(ctx){
          var v = Number(ctx.raw) || 0;
          var total = ctx.dataset.data.reduce(function(a,b){ return a+b; }, 0);
          var pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
          return ctx.label + ': ' + money(v) + ' (' + pct + '%)';
        } } }
      },
      scales: isCircular ? {} : {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor, callback: function(v){ return 'R$ ' + v.toLocaleString('pt-BR'); } }, grid: { color: gridColor } }
      }
    }
  });
}

function dashRenderMonthComparison() {
  var groups = {};
  var invalidTotal = 0, invalidCount = 0;
  dashFiltered.forEach(function(h) {
    var info = dashExtractMonth(h.data, h.id);
    var tot = dashToMoney(h.total);
    if (!info.key) { invalidTotal += tot; invalidCount++; return; }
    if (!groups[info.key]) groups[info.key] = { total: 0, count: 0, items: 0 };
    groups[info.key].total += tot;
    groups[info.key].count++;
    (h.itens || []).forEach(function(it){ groups[info.key].items += (Number(it.qtd) || 0); });
  });
  var keys = Object.keys(groups).sort();
  if (keys.length === 0 && invalidCount === 0) { document.getElementById('dashMonthComparison').innerHTML = '<div class="empty" style="padding:20px">Sem dados no período</div>'; return; }
  var html = '<table><thead><tr><th>Mês</th><th class="money">Total</th><th class="money">Contas</th><th class="money">Itens</th><th class="money">Ticket Médio</th><th class="money">Variação</th></tr></thead><tbody>';
  var prev = null;
  keys.forEach(function(k) {
    var g = groups[k];
    var delta = '<span style="color:var(--muted)">—</span>';
    if (prev !== null && prev > 0) {
      var d = ((g.total - prev) / prev) * 100;
      if (Math.abs(d) < 0.05) delta = '<span style="color:var(--muted)">0%</span>';
      else if (d > 0) delta = '<span style="color:#ef4444">▲ ' + d.toFixed(1) + '%</span>';
      else delta = '<span style="color:#059669">▼ ' + Math.abs(d).toFixed(1) + '%</span>';
    }
    html += '<tr><td><b>' + dashFmtMonthLabel(k) + '</b></td><td class="money">' + money(g.total) + '</td><td class="money">' + g.count + '</td><td class="money">' + g.items + '</td><td class="money">' + money(g.count ? g.total / g.count : 0) + '</td><td class="money">' + delta + '</td></tr>';
    prev = g.total;
  });
  if (invalidCount > 0) {
    html += '<tr style="background:var(--err-bg)"><td><b>⚠️ Sem data</b></td><td class="money">' + money(invalidTotal) + '</td><td class="money">' + invalidCount + '</td><td colspan="3"></td></tr>';
  }
  html += '</tbody></table>';
  document.getElementById('dashMonthComparison').innerHTML = html;
}

function dashRenderTopEstabs() {
  var groups = {};
  dashFiltered.forEach(function(h) {
    var k = h.estabelecimento || '—';
    if (!groups[k]) groups[k] = { total: 0, count: 0 };
    groups[k].total += dashToMoney(h.total);
    groups[k].count++;
  });
  var entries = Object.keys(groups).map(function(k){ return [k, groups[k]]; }).sort(function(a,b){ return b[1].total - a[1].total; }).slice(0, 8);
  if (entries.length === 0) { document.getElementById('dashTopEstabs').innerHTML = '<div class="empty" style="padding:20px">Sem dados</div>'; return; }
  var max = entries[0][1].total || 1;
  var html = '<table><thead><tr><th>#</th><th>Estabelecimento</th><th class="money">Total</th><th class="money">Contas</th></tr></thead><tbody>';
  entries.forEach(function(e, i) {
    html += '<tr><td>' + (i+1) + '</td><td><div>' + escapeHtml(e[0]) + '</div><div style="height:4px;background:var(--panel-2);border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + (e[1].total/max*100).toFixed(0) + '%;background:var(--accent);border-radius:2px"></div></div></td><td class="money">' + money(e[1].total) + '</td><td class="money">' + e[1].count + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('dashTopEstabs').innerHTML = html;
}

function dashRenderTopProducts() {
  var groups = {};
  dashFiltered.forEach(function(h) {
    (h.itens || []).forEach(function(it) {
      var k = it.nome || '—';
      if (!groups[k]) groups[k] = { total: 0, qty: 0 };
      groups[k].total += dashToMoney(it.preco) * (Number(it.qtd) || 0);
      groups[k].qty += (Number(it.qtd) || 0);
    });
  });
  var entries = Object.keys(groups).map(function(k){ return [k, groups[k]]; }).sort(function(a,b){ return b[1].total - a[1].total; }).slice(0, 8);
  if (entries.length === 0) { document.getElementById('dashTopProducts').innerHTML = '<div class="empty" style="padding:20px">Sem dados</div>'; return; }
  var max = entries[0][1].total || 1;
  var html = '<table><thead><tr><th>#</th><th>Produto</th><th class="money">Qtd</th><th class="money">Total</th></tr></thead><tbody>';
  entries.forEach(function(e, i) {
    html += '<tr><td>' + (i+1) + '</td><td><div>' + escapeHtml(e[0]) + '</div><div style="height:4px;background:var(--panel-2);border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + (e[1].total/max*100).toFixed(0) + '%;background:var(--green);border-radius:2px"></div></div></td><td class="money">' + e[1].qty + '</td><td class="money">' + money(e[1].total) + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('dashTopProducts').innerHTML = html;
}

function dashRenderTable() {
  var all = (data.historico || []).map(function(h, i) { return { idx: i, h: h, info: dashExtractMonth(h.data, h.id) }; });
  
  var counts = {
    todos: all.length,
    out: all.filter(function(x){ return x.info.key === '2026-10'; }).length,
    sep: all.filter(function(x){ return x.info.key === '2026-09'; }).length
  };
  
  var btns = '<button class="active" onclick="dashSetFiltro(\'todos\')">Todos (' + counts.todos + ')</button>';
  if (counts.sep > 0) btns += '<button onclick="dashSetFiltro(\'sep\')">Set/26 (' + counts.sep + ')</button>';
  if (counts.out > 0) btns += '<button onclick="dashSetFiltro(\'out\')">Out/26 (' + counts.out + ')</button>';
  document.getElementById('dashFiltros').innerHTML = btns;

  var items = all.slice();
  var currentFilter = document.querySelector('#dashFiltros button.active');
  var filterVal = currentFilter ? currentFilter.textContent : 'Todos';
  
  if (filterVal.indexOf('Out') === 0) items = items.filter(function(x){ return x.info.key === '2026-10'; });
  else if (filterVal.indexOf('Set') === 0) items = items.filter(function(x){ return x.info.key === '2026-09'; });

  items.sort(function(a, b) {
    if (!a.info.key && !b.info.key) return 0;
    if (!a.info.key) return 1;
    if (!b.info.key) return -1;
    return b.info.key.localeCompare(a.info.key) || (b.info.dia - a.info.dia);
  });

  items = items.filter(function(x) {
    return dashFiltered.some(function(df) { return df.id === x.h.id; });
  });

  document.getElementById('dashRecCount').textContent = '(' + items.length + ' registros)';

  var html = '';
  items.forEach(function(x) {
    var mp = x.h.metodoPagamento || 'Não informado';
    var mpClass = mp === 'PIX' ? 'pix' : mp === 'Dinheiro' ? 'dinheiro' : mp === 'Cartão' ? 'cartao' : 'outro';
    var rowStyle = !x.info.source ? 'background:var(--err-bg)' : '';
    html += '<tr style="' + rowStyle + '">' +
      '<td>' + (x.idx + 1) + '</td>' +
      '<td class="mono">' + escapeHtml(x.h.data) + '</td>' +
      '<td><b>' + (x.info.key ? dashFmtMonthLabel(x.info.key) : '—') + '</b></td>' +
      '<td>' + escapeHtml(x.h.estabelecimento || '—') + '</td>' +
      '<td><span class="dash-tag ' + mpClass + '">' + escapeHtml(mp) + '</span></td>' +
      '<td class="money">' + money(dashToMoney(x.h.total)) + '</td>' +
    '</tr>';
  });
  document.getElementById('dashTbodyRec').innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">Nenhum registro</td></tr>';
}

function dashSetFiltro(f) {
  var btns = document.querySelectorAll('#dashFiltros button');
  btns.forEach(function(b) {
    b.classList.remove('active');
    if (f === 'todos' && b.textContent.indexOf('Todos') === 0) b.classList.add('active');
    if (f === 'out' && b.textContent.indexOf('Out') === 0) b.classList.add('active');
    if (f === 'sep' && b.textContent.indexOf('Set') === 0) b.classList.add('active');
  });
  dashRenderTable();
}

function dashPopulateEstabs() {
  var set = {};
  (data.historico || []).forEach(function(h){ if (h && h.estabelecimento) set[h.estabelecimento] = 1; });
  var sel = document.getElementById('dashEstabFilter');
  var cur = sel.value;
  var html = '<option value="">Todos</option>';
  Object.keys(set).sort().forEach(function(o){ html += '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>'; });
  sel.innerHTML = html;
  if (cur) sel.value = cur;
}

function dashExportCSV() {
  if (dashFiltered.length === 0) { alert('Nada para exportar.'); return; }
  var headers = ['data','mes','estabelecimento','cliente','metodoPagamento','subtotal','gorjeta','total'];
  var rows = dashFiltered.map(function(h) {
    var info = dashExtractMonth(h.data, h.id);
    return [h.data || '', info.key || 'SEM_MES', h.estabelecimento || '', h.cliente || '', h.metodoPagamento || '', dashToMoney(h.subtotal).toFixed(2), dashToMoney(h.gorjeta).toFixed(2), dashToMoney(h.total).toFixed(2)];
  });
  var csv = [headers].concat(rows).map(function(r){ return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'fecha_conta_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}