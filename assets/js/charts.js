/* Hand-rolled inline SVG charts. No library, no CDN — the app stays instant
   and genuinely offline.

   Rules baked in here:
   - At most six colour classes per chart; anything longer folds into "Other".
   - The categorical palette is fixed and ordered; colour follows the category,
     never its rank, so filtering never repaints the survivors.
   - Magnitude bars use one hue, light to dark.
   - Grid lines are recessive; the data is the loudest ink on the card.
   - Over-budget uses the reserved red and is always paired with a label. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util;
  var C = {};

  /* Fixed, ordered categorical palette. Never cycled, never extended. */
  C.PALETTE = ['#6E1230', '#0B5D48', '#C89B3C', '#C4708A', '#405A8A', '#7E9B76'];

  C.INK = '#2A1F23';
  C.MUTED = '#857076';
  C.GRID = '#E7DDD0';
  C.PAPER = '#FFFDF9';
  C.MAROON = '#6E1230';
  C.MAROON_LIGHT = '#D8BDC7';
  C.EMERALD = '#0B5D48';
  C.DANGER = '#B3261E';
  /* The burndown pace line — gold, dashed, always paired with a legend. */
  C.GOLD_LINE = '#C89B3C';

  /* Semantic colours: these follow the category, wherever it appears. */
  C.RSVP_COLOURS = {
    'Attending': '#0B5D48',
    'Pending': '#C89B3C',
    'Not Attending': '#8A7F82',
    'Maybe': '#405A8A'
  };
  C.SIDE_COLOURS = {
    'Bride': '#6E1230',
    'Groom': '#405A8A',
    'Both': '#C89B3C'
  };

  function esc(s) { return U.esc(s); }

  function measure(el) {
    var w = el && el.clientWidth ? el.clientWidth : 0;
    return Math.max(240, Math.round(w || 320));
  }

  function emptyBlock(msg) {
    return '<div class="chart-empty">' + esc(msg || W.t('chart.noData')) + '</div>';
  }

  function tip(text) {
    return ' data-tip="' + esc(text) + '"';
  }

  /* ------------------------------------------------------------- donut -- */

  function arcPath(cx, cy, rO, rI, a0, a1) {
    var p = function (r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    var s0 = p(rO, a0), s1 = p(rO, a1), s2 = p(rI, a1), s3 = p(rI, a0);
    return 'M' + s0[0].toFixed(2) + ' ' + s0[1].toFixed(2) +
      'A' + rO + ' ' + rO + ' 0 ' + large + ' 1 ' + s1[0].toFixed(2) + ' ' + s1[1].toFixed(2) +
      'L' + s2[0].toFixed(2) + ' ' + s2[1].toFixed(2) +
      'A' + rI + ' ' + rI + ' 0 ' + large + ' 0 ' + s3[0].toFixed(2) + ' ' + s3[1].toFixed(2) + 'Z';
  }

  /* spec: {items:[{label,value,color}], centreValue, centreLabel, fmt} */
  function donut(spec) {
    var items = (spec.items || []).slice(0, 6);
    var fmt = spec.fmt || U.fmtNumber;
    var total = U.sum(items, function (i) { return i.value; });
    var live = items.filter(function (i) { return i.value > 0; });

    var cx = 100, cy = 100, rO = 82, rI = 52;
    var svg = '<svg viewBox="0 0 200 200" role="img" aria-label="' +
      esc((spec.title || '') + ' ' + fmt(total) + ' total') + '">';

    if (!live.length) {
      svg += '<circle cx="100" cy="100" r="67" fill="none" stroke="' + C.GRID + '" stroke-width="30"/>';
    } else if (live.length === 1) {
      svg += '<circle cx="100" cy="100" r="67" fill="none" stroke="' + live[0].color +
        '" stroke-width="30"' + tip(live[0].label + ': ' + fmt(live[0].value) + ' (100%)') + '/>';
    } else {
      var a = -Math.PI / 2;
      live.forEach(function (it) {
        var sweep = (it.value / total) * Math.PI * 2;
        var pct = Math.round(it.value / total * 1000) / 10;
        svg += '<path d="' + arcPath(cx, cy, rO, rI, a, a + sweep) + '" fill="' + it.color +
          '" stroke="' + (spec.gap || C.PAPER) + '" stroke-width="2"' +
          tip(it.label + ': ' + fmt(it.value) + ' (' + pct + '%)') + '/>';
        a += sweep;
      });
    }

    /* The hole is ~104px across, so long values (PKR 8.3M) must step down. */
    var centreValue = String(spec.centreValue !== undefined ? spec.centreValue : fmt(total));
    var len = centreValue.length;
    var centreSize = len <= 4 ? 34 : (len <= 6 ? 26 : (len <= 8 ? 20 : 16));
    svg += '<text x="100" y="' + (97 - (34 - centreSize) * 0.3).toFixed(0) +
      '" text-anchor="middle" font-family="Palatino Linotype, Georgia, serif" ' +
      'font-size="' + centreSize + '" fill="' + C.MAROON + '">' + esc(centreValue) + '</text>';
    if (spec.centreLabel) {
      svg += '<text x="100" y="118" text-anchor="middle" font-size="12" fill="' + C.MUTED + '">' +
        esc(spec.centreLabel) + '</text>';
    }
    svg += '</svg>';

    var legend = '<ul class="legend">';
    items.forEach(function (it) {
      var pct = total > 0 ? Math.round(it.value / total * 1000) / 10 : 0;
      legend += '<li><span class="sw" style="background:' + it.color + '"></span>' +
        '<span class="lg-label">' + esc(it.label) + '</span>' +
        '<span class="lg-val">' + esc(fmt(it.value)) + '</span>' +
        '<span class="lg-pct">' + pct + '%</span></li>';
    });
    legend += '</ul>';

    return '<div class="chart-flex"><div class="chart-holder">' + svg + '</div>' + legend + '</div>';
  }

  /* -------------------------------------------------------------- ring -- */

  /* spec: {percent, centreLabel, caption} */
  function ring(spec) {
    var pct = Math.round(U.clamp(U.num(spec.percent), 0, 100));
    var r = 68, cx = 90, cy = 90;
    var circ = 2 * Math.PI * r;
    var dash = circ * (pct / 100);
    var svg = '<svg viewBox="0 0 180 180" role="img" aria-label="' +
      esc((spec.title || 'Progress') + ' ' + pct + ' percent') + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + C.GRID + '" stroke-width="16"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + C.EMERALD +
      '" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) +
      '" transform="rotate(-90 ' + cx + ' ' + cy + ')"' + tip((spec.title || 'Progress') + ': ' + pct + '%') + '/>' +
      '<text x="' + cx + '" y="' + (cy + 8) + '" text-anchor="middle" font-family="Palatino Linotype, Georgia, serif" ' +
      'font-size="42" fill="' + C.MAROON + '">' + pct + '%</text>';
    if (spec.centreLabel) {
      svg += '<text x="' + cx + '" y="' + (cy + 30) + '" text-anchor="middle" font-size="12" fill="' + C.MUTED + '">' +
        esc(spec.centreLabel) + '</text>';
    }
    svg += '</svg>';

    var caption = spec.caption ? '<p class="card-sub" style="text-align:center">' + esc(spec.caption) + '</p>' : '';
    return '<div class="chart-holder" style="max-width:220px;margin:0 auto">' + svg + '</div>' + caption;
  }

  /* ------------------------------------------------------------- meter -- */

  /* Horizontal meter with a limit marker. Never a two-slice pie.
     spec: {value, limit, fmt, valueLabel, limitLabel} */
  function meter(spec, el) {
    var w = measure(el);
    var h = 62;
    var value = Math.max(0, U.num(spec.value));
    var limit = Math.max(0, U.num(spec.limit));
    var fmt = spec.fmt || U.fmtMoney;

    if (limit <= 0 && value <= 0) return emptyBlock(spec.emptyText || W.t('chart.noData'));

    var domain = Math.max(limit, value) * (value > limit ? 1.06 : 1.0);
    if (domain <= 0) domain = 1;
    var padR = 4;
    var barW = w - padR;
    var scale = function (v) { return U.clamp(v / domain, 0, 1) * barW; };
    var over = value > limit && limit > 0;
    var fill = over ? C.DANGER : C.EMERALD;

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + esc(fmt(value) + ' of ' + fmt(limit)) + '">';
    svg += '<rect x="0" y="18" width="' + barW + '" height="20" rx="10" fill="#F1E8DA" stroke="' + C.GRID + '"/>';
    if (value > 0) {
      svg += '<rect x="0" y="18" width="' + Math.max(6, scale(value)).toFixed(1) + '" height="20" rx="10" fill="' + fill + '"' +
        tip((spec.valueLabel || 'Spent') + ': ' + fmt(value)) + '/>';
    }
    if (limit > 0) {
      var lx = scale(limit);
      svg += '<line x1="' + lx.toFixed(1) + '" y1="10" x2="' + lx.toFixed(1) + '" y2="46" stroke="' + C.INK +
        '" stroke-width="2"' + tip((spec.limitLabel || 'Limit') + ': ' + fmt(limit)) + '/>';
      var anchor = lx > barW - 70 ? 'end' : 'middle';
      var tx = lx > barW - 70 ? barW : lx;
      svg += '<text x="' + tx.toFixed(1) + '" y="58" text-anchor="' + anchor + '" font-size="11" fill="' + C.MUTED + '">' +
        esc((spec.limitLabel || 'Limit') + ' ' + fmt(limit)) + '</text>';
    }
    svg += '<text x="0" y="12" font-size="12" font-weight="600" fill="' + (over ? C.DANGER : C.INK) + '">' +
      esc(fmt(value)) + esc(over ? ' — ' + W.t('chart.overBudgetFlag') : '') + '</text>';
    svg += '</svg>';
    return '<div class="chart-holder">' + svg + '</div>';
  }

  /* -------------------------------------------------------- paired bars -- */

  /* Ranked horizontal bars, planned against spent, one hue light to dark.
     spec: {items:[{label, planned, spent}], fmt} */
  function pairedBars(spec, el) {
    var items = (spec.items || []).slice();
    if (!items.length) return emptyBlock(spec.emptyText);
    var fmt = spec.fmt || U.fmtMoney;
    var w = measure(el);
    var rowH = 46;
    var h = items.length * rowH + 6;
    var max = 0;
    items.forEach(function (i) { max = Math.max(max, U.num(i.planned), U.num(i.spent)); });
    if (max <= 0) max = 1;
    var barW = w - 2;
    var scale = function (v) { return U.clamp(v / max, 0, 1) * barW; };

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + esc(spec.title || 'Planned against spent by category') + '">';

    items.forEach(function (it, idx) {
      var y = idx * rowH + 4;
      var over = it.spent > it.planned && it.planned > 0;
      var spentFill = over ? C.DANGER : C.MAROON;
      svg += '<text x="0" y="' + (y + 10) + '" font-size="12.5" font-weight="600" fill="' + C.INK + '">' +
        esc(it.label) + (over ? ' ⚠' : '') + '</text>';
      svg += '<text x="' + barW + '" y="' + (y + 10) + '" text-anchor="end" font-size="11.5" fill="' +
        (over ? C.DANGER : C.MUTED) + '">' + esc(fmt(it.spent)) + ' / ' + esc(fmt(it.planned)) + '</text>';
      svg += '<rect x="0" y="' + (y + 16) + '" width="' + Math.max(2, scale(it.planned)).toFixed(1) +
        '" height="8" rx="4" fill="' + C.MAROON_LIGHT + '"' +
        tip(it.label + ' planned: ' + fmt(it.planned)) + '/>';
      svg += '<rect x="0" y="' + (y + 28) + '" width="' + Math.max(2, scale(it.spent)).toFixed(1) +
        '" height="8" rx="4" fill="' + spentFill + '"' +
        tip(it.label + ' spent: ' + fmt(it.spent) + (over ? ' — ' + W.t('chart.overBudgetFlag') : '')) + '/>';
    });
    svg += '</svg>';

    var legend = '<ul class="legend" style="flex-direction:row;flex-wrap:wrap;gap:14px">' +
      '<li><span class="sw" style="background:' + C.MAROON_LIGHT + '"></span><span class="lg-label">Planned</span></li>' +
      '<li><span class="sw" style="background:' + C.MAROON + '"></span><span class="lg-label">Spent</span></li>' +
      '<li><span class="sw" style="background:' + C.DANGER + '"></span><span class="lg-label">⚠ Over budget</span></li>' +
      '</ul>';
    return '<div class="chart-holder">' + svg + '</div>' + legend;
  }

  /* --------------------------------------------------------- plain bars -- */

  /* One hue, light to dark by magnitude. Used where a pie would need 17 slices.
     spec: {items:[{label,value}], fmt, hue:'maroon'|'emerald'} */
  function bars(spec, el) {
    var items = (spec.items || []).filter(function (i) { return true; });
    if (!items.length) return emptyBlock(spec.emptyText);
    var fmt = spec.fmt || U.fmtNumber;
    var w = measure(el);
    var rowH = 30;
    var h = items.length * rowH + 4;
    var max = 0;
    items.forEach(function (i) { max = Math.max(max, U.num(i.value)); });
    if (max <= 0) max = 1;

    var labelW = Math.min(150, Math.max(78, Math.round(w * 0.36)));
    var valueW = 52;
    var trackX = labelW + 8;
    var trackW = Math.max(20, w - trackX - valueW);

    var base = spec.hue === 'emerald' ? [11, 93, 72] : [110, 18, 48];
    /* One hue, light to dark, quantised to five steps. With the recessive
       track that is six fills on the card — the cap, whatever you count. */
    var shade = function (v) {
      var step = U.clamp(Math.ceil((v / max) * 5), 1, 5);
      var ratio = 0.30 + (step / 5) * 0.70;
      var mix = function (channel) { return Math.round(255 - (255 - channel) * ratio); };
      return 'rgb(' + mix(base[0]) + ',' + mix(base[1]) + ',' + mix(base[2]) + ')';
    };

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + esc(spec.title || 'Bar chart') + '">';
    items.forEach(function (it, idx) {
      var y = idx * rowH + 2;
      svg += '<text x="0" y="' + (y + 18) + '" font-size="12.5" fill="' + C.INK + '">' +
        esc(it.label.length > 22 ? it.label.slice(0, 21) + '…' : it.label) + '</text>';
      svg += '<rect x="' + trackX + '" y="' + (y + 8) + '" width="' + trackW + '" height="14" rx="7" fill="#F4EDE1"/>';
      svg += '<rect x="' + trackX + '" y="' + (y + 8) + '" width="' +
        Math.max(it.value > 0 ? 3 : 0, (it.value / max) * trackW).toFixed(1) +
        '" height="14" rx="7" fill="' + shade(it.value) + '"' +
        tip(it.label + ': ' + (it.tipText || fmt(it.value))) + '/>';
      svg += '<text x="' + w + '" y="' + (y + 19) + '" text-anchor="end" font-size="12" font-weight="600" fill="' +
        C.INK + '">' + esc(it.valueLabel || fmt(it.value)) + '</text>';
    });
    svg += '</svg>';
    return '<div class="chart-holder">' + svg + '</div>';
  }

  /* -------------------------------------------------------------- line -- */

  /* One y-axis. Never two.
     spec: {labels:[...], series:[{name, color, values:[n|null], dashed}],
            limit, limitLabel, fmt, minPoints, markIndex}
     The older {points:[{x, value, tipText}]} shape still works. */
  function line(spec, el) {
    var fmt = spec.fmt || U.fmtNumber;
    var labels = spec.labels;
    var series = spec.series;

    if (!labels && spec.points) {
      labels = spec.points.map(function (p) { return p.x; });
      series = [{
        name: spec.name || '',
        color: spec.color || C.EMERALD,
        values: spec.points.map(function (p) { return p.value; }),
        tips: spec.points.map(function (p) { return p.tipText; })
      }];
    }
    if (!labels || !labels.length || !series || !series.length) {
      return emptyBlock(spec.emptyText || W.t('chart.noData'));
    }

    var live = series[0].values.filter(function (v) {
      return v !== null && v !== undefined;
    }).length;
    if (live < (spec.minPoints === undefined ? 3 : spec.minPoints)) {
      return emptyBlock(W.t('chart.needMore'));
    }

    var w = measure(el);
    var h = spec.height || 230;
    var padL = 58, padR = 12, padT = 14, padB = 26;
    var innerW = Math.max(20, w - padL - padR);
    var innerH = h - padT - padB;

    var max = 0;
    series.forEach(function (ser) {
      ser.values.forEach(function (v) { if (v !== null && v !== undefined) max = Math.max(max, U.num(v)); });
    });
    if (spec.limit) max = Math.max(max, U.num(spec.limit));
    if (max <= 0) max = 1;
    var niceMax = max * 1.08;

    var X = function (i) {
      return padL + (labels.length === 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
    };
    var Y = function (v) { return padT + innerH - (U.clamp(v / niceMax, 0, 1) * innerH); };

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + esc(spec.title || 'Line chart') + '">';

    /* recessive grid */
    for (var g = 0; g <= 4; g++) {
      var gv = niceMax * (g / 4);
      var gy = Y(gv);
      svg += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) +
        '" stroke="' + C.GRID + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' +
        C.MUTED + '">' + esc(fmt(Math.round(gv))) + '</text>';
    }

    if (spec.limit) {
      var ly = Y(spec.limit);
      svg += '<line x1="' + padL + '" y1="' + ly.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + ly.toFixed(1) +
        '" stroke="' + C.MAROON + '" stroke-width="1.5" stroke-dasharray="5 4"' +
        tip((spec.limitLabel || 'Limit') + ': ' + fmt(spec.limit)) + '/>';
    }

    /* Nulls break the line rather than dropping it to zero. */
    series.forEach(function (ser) {
      var d = '', open = false;
      ser.values.forEach(function (v, i) {
        if (v === null || v === undefined) { open = false; return; }
        d += (open ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
        open = true;
      });
      if (d) {
        svg += '<path d="' + d + '" fill="none" stroke="' + (ser.color || C.EMERALD) +
          '" stroke-width="' + (ser.dashed ? 1.8 : 2.2) + '" stroke-linejoin="round" stroke-linecap="round"' +
          (ser.dashed ? ' stroke-dasharray="6 5"' : '') + '/>';
      }
    });

    var every = Math.max(1, Math.ceil(labels.length / 12));
    series.forEach(function (ser, si) {
      if (ser.dashed) return;
      ser.values.forEach(function (v, i) {
        if (v === null || v === undefined) return;
        var show = labels.length <= 14 || i === 0 || i === labels.length - 1 || i % every === 0;
        if (!show) return;
        var tipText = (ser.tips && ser.tips[i]) ||
          ((ser.name ? ser.name + ' — ' : '') + labels[i] + ': ' + fmt(v));
        svg += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (si ? 2.8 : 3.4) +
          '" fill="' + (ser.color || C.EMERALD) + '"' + tip(tipText) + '/>';
      });
    });

    var labelIdx = [0, Math.floor((labels.length - 1) / 2), labels.length - 1];
    labelIdx.forEach(function (i, n) {
      if (i < 0 || i >= labels.length) return;
      if (n === 1 && labels.length < 4) return;
      var anchor = n === 0 ? 'start' : (n === 2 ? 'end' : 'middle');
      svg += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="' + anchor +
        '" font-size="10.5" fill="' + C.MUTED + '">' + esc(labels[i]) + '</text>';
    });

    svg += '</svg>';

    var legend = '';
    var named = series.filter(function (ser) { return !!ser.name; });
    if (named.length && (series.length > 1 || spec.limitLabel)) {
      legend = '<ul class="legend" style="flex-direction:row;flex-wrap:wrap;gap:14px">';
      named.forEach(function (ser) {
        legend += '<li><span class="sw" style="background:' + (ser.color || C.EMERALD) +
          (ser.dashed ? ';opacity:.55' : '') + '"></span><span class="lg-label">' +
          esc(ser.name) + (ser.dashed ? ' (dashed)' : '') + '</span></li>';
      });
      if (spec.limitLabel) {
        legend += '<li><span class="sw" style="background:' + C.MAROON + ';opacity:.6"></span>' +
          '<span class="lg-label">' + esc(spec.limitLabel) + '</span></li>';
      }
      legend += '</ul>';
    }

    return '<div class="chart-holder">' + svg + '</div>' + legend;
  }

  /* -------------------------------------------------------------- dots -- */

  /* spec: {days:[{date, done}]} — filled means the day was completed. */
  function dots(spec, el) {
    var days = spec.days || [];
    if (!days.length) return emptyBlock(spec.emptyText);
    var w = measure(el);
    var n = days.length;
    var cell = w / n;
    var r = U.clamp(cell / 2 - 1.6, 3, 7);
    var h = Math.round(r * 2 + 18);

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + esc(spec.title || 'Daily consistency') + '">';
    days.forEach(function (d, i) {
      var cx = cell * i + cell / 2;
      /* Three states, not two: done, partly done, nothing. */
      var fill = d.done ? C.EMERALD : (d.partial ? '#C4DCD3' : '#EFE6D8');
      var stroke = d.done || d.partial ? C.EMERALD : C.GRID;
      var detail = d.progress
        ? W.t('today.dayProgress', { done: d.progress.done, total: d.progress.total })
        : (d.done ? 'done' : 'not done');
      svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + (r + 2).toFixed(1) + '" r="' + r.toFixed(1) +
        '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (d.partial ? 1.6 : 1) + '"' +
        tip(U.fmtDate(d.date, 'medium') + ': ' + detail) + '/>';
    });
    svg += '<text x="0" y="' + (h - 3) + '" font-size="10.5" fill="' + C.MUTED + '">' +
      esc(U.fmtDate(days[0].date, 'short')) + '</text>';
    svg += '<text x="' + w + '" y="' + (h - 3) + '" text-anchor="end" font-size="10.5" fill="' + C.MUTED + '">' +
      esc(W.t('common.today')) + '</text>';
    svg += '</svg>';
    return '<div class="chart-holder">' + svg + '</div>';
  }

  /* ------------------------------------------------------------ render -- */

  var builders = {
    donut: function (spec) { return donut(spec); },
    ring: function (spec) { return ring(spec); },
    meter: meter,
    pairedBars: pairedBars,
    bars: bars,
    line: line,
    dots: dots
  };

  C.render = function (el, spec) {
    if (!el) return;
    el.setAttribute('data-chart', spec.type);
    el.__spec = spec;
    var build = builders[spec.type];
    el.innerHTML = build ? build(spec, el) : emptyBlock();
  };

  /* Charts are measured, so a resize has to redraw them. */
  var redraw = U.debounce(function () {
    var nodes = document.querySelectorAll('[data-chart]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].__spec) C.render(nodes[i], nodes[i].__spec);
    }
  }, 140);
  window.addEventListener('resize', redraw);

  /* Shared tooltip. One node, delegated listeners. */
  var tipEl = null;
  function showTip(text, x, y) {
    if (!tipEl) tipEl = document.getElementById('chartTip');
    if (!tipEl) return;
    tipEl.textContent = text;
    tipEl.hidden = false;
    var box = tipEl.getBoundingClientRect();
    var left = U.clamp(x + 12, 6, window.innerWidth - box.width - 6);
    var top = y - box.height - 12;
    if (top < 6) top = y + 18;
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  function hideTip() {
    if (!tipEl) tipEl = document.getElementById('chartTip');
    if (tipEl) tipEl.hidden = true;
  }
  C.hideTip = hideTip;

  document.addEventListener('mousemove', function (e) {
    var node = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (node) showTip(node.getAttribute('data-tip'), e.clientX, e.clientY);
    else hideTip();
  });
  document.addEventListener('mouseleave', hideTip);
  window.addEventListener('scroll', hideTip, true);

  W.Charts = C;
})(window.WCC);
