/* Utilities: dates, money, ids, escaping.
   No modules — everything hangs off the single window.WCC namespace so the app
   runs straight from file:// with plain <script> tags. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = {};

  /* ---------------------------------------------------------------- ids -- */

  var seq = 0;
  U.uid = function (prefix) {
    seq += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + seq.toString(36) +
      Math.random().toString(36).slice(2, 6);
  };

  /* -------------------------------------------------------------- dates --
     All dates are handled as local-time YYYY-MM-DD strings. Never `new
     Date('2026-09-10')` — that parses as UTC and shifts the day in PKT. */

  var todayOverride = null;

  /* Test seam: WCC.Util.setToday('2026-09-11') lets us verify that a daily task
     ticked today reappears unticked tomorrow with yesterday still recorded. */
  U.setToday = function (iso) {
    todayOverride = iso ? String(iso).slice(0, 10) : null;
  };

  U.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  U.toISO = function (d) {
    if (!d) return '';
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  };

  U.todayISO = function () {
    return todayOverride || U.toISO(new Date());
  };

  /* Timestamp for completedAt, in LOCAL time. Never toISOString(): that is UTC,
     so a task ticked at 2am in Karachi would stamp the previous day and land in
     the wrong week on the velocity chart. Honours the date override too. */
  U.nowISO = function () {
    var real = new Date();
    var clock = 'T' + U.pad2(real.getHours()) + ':' + U.pad2(real.getMinutes()) +
      ':' + U.pad2(real.getSeconds()) + '.000';
    return (todayOverride || U.toISO(real)) + clock;
  };

  U.parseDate = function (iso) {
    if (!iso) return null;
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
    if (!y || !m || !d) return null;
    var dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  U.isValidISODate = function (iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '').slice(0, 10))) return false;
    return !!U.parseDate(iso);
  };

  U.addDays = function (iso, n) {
    var d = U.parseDate(iso);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return U.toISO(d);
  };

  /* Whole days from a -> b. Positive means b is in the future. */
  U.daysBetween = function (aISO, bISO) {
    var a = U.parseDate(aISO), b = U.parseDate(bISO);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  };

  U.startOfWeek = function (iso) {
    var d = U.parseDate(iso);
    if (!d) return '';
    var dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow);
    return U.toISO(d);
  };

  U.endOfWeek = function (iso) {
    var s = U.startOfWeek(iso);
    return s ? U.addDays(s, 6) : '';
  };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* style: 'long' | 'medium' | 'short' | 'weekday' */
  U.fmtDate = function (iso, style) {
    var d = U.parseDate(iso);
    if (!d) return '';
    var m = MONTHS[d.getMonth()];
    if (style === 'short') return d.getDate() + ' ' + m.slice(0, 3);
    if (style === 'medium') return d.getDate() + ' ' + m.slice(0, 3) + ' ' + d.getFullYear();
    if (style === 'weekday') return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + m + ' ' + d.getFullYear();
    return d.getDate() + ' ' + m + ' ' + d.getFullYear();
  };

  U.monthName = function (iso) {
    var d = U.parseDate(iso);
    return d ? MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '';
  };

  U.firstOfMonth = function (iso) {
    var d = U.parseDate(iso);
    if (!d) return '';
    return U.toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  U.addMonths = function (iso, n) {
    var d = U.parseDate(iso);
    if (!d) return '';
    return U.toISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
  };

  U.sameMonth = function (a, b) {
    var da = U.parseDate(a), db = U.parseDate(b);
    return !!da && !!db && da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
  };

  U.DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /* Six Monday-first weeks covering the month that `iso` falls in. */
  U.monthWeeks = function (iso) {
    var d = U.parseDate(U.firstOfMonth(iso));
    if (!d) return [];
    var startDow = (d.getDay() + 6) % 7;
    var start = new Date(d.getFullYear(), d.getMonth(), 1 - startDow);
    var weeks = [];
    for (var w = 0; w < 6; w++) {
      var row = [];
      for (var i = 0; i < 7; i++) {
        var cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
        row.push(U.toISO(cur));
      }
      /* Drop trailing weeks that hold none of this month. */
      var hasMonth = false;
      for (var k = 0; k < row.length; k++) if (U.sameMonth(row[k], iso)) hasMonth = true;
      if (w > 3 && !hasMonth) break;
      weeks.push(row);
    }
    return weeks;
  };

  /* '18:30' -> '6:30 pm' */
  U.fmtTime = function (hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return '';
    var bits = hhmm.split(':');
    var h = parseInt(bits[0], 10), m = bits[1];
    var ap = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + ap;
  };

  /* -------------------------------------------------------------- money -- */

  U.groupNumber = function (n) {
    var num = Math.round(Math.abs(Number(n) || 0));
    var s = String(num), out = '', c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = ',' + out;
    }
    return out;
  };

  U.fmtMoney = function (n) {
    var v = Number(n) || 0;
    return (v < 0 ? '-' : '') + 'PKR ' + U.groupNumber(v);
  };

  /* Compact form for tight chart axes: PKR 1.25M / PKR 250K */
  U.fmtMoneyShort = function (n) {
    var v = Number(n) || 0;
    var a = Math.abs(v), sign = v < 0 ? '-' : '';
    if (a >= 1000000) return sign + 'PKR ' + (Math.round(a / 100000) / 10) + 'M';
    if (a >= 1000) return sign + 'PKR ' + Math.round(a / 1000) + 'K';
    return sign + 'PKR ' + U.groupNumber(a);
  };

  U.fmtNumber = function (n) { return U.groupNumber(n); };

  U.pct = function (part, whole) {
    var w = Number(whole) || 0;
    if (w <= 0) return 0;
    return Math.round((Number(part) || 0) / w * 1000) / 10;
  };

  U.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  U.num = function (v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback || 0);
  };

  U.sum = function (arr, fn) {
    var total = 0;
    for (var i = 0; i < arr.length; i++) total += U.num(fn ? fn(arr[i], i) : arr[i]);
    return total;
  };

  /* -------------------------------------------------------------- strings -- */

  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  U.slug = function (s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  /* Deep clone via JSON — state is plain data by design. */
  U.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  U.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  };

  W.Util = U;
})(window.WCC);
