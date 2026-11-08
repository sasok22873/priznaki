/* =========================================================================
   Календарь: удобный месяц.
   - события в одну строку (название + время), до 3 в дне, дальше «ещё N» со списком
   - наведение расширяет рамку события и дня (видно, что можно тянуть/кликнуть)
   - перетаскивание мышью (и пальцем) на любой день, время сохраняется
   - клик по событию открывает редактор (название, дата, время, место, тип, удалить)
   - клик по пустому месту дня — добавить событие на этот день
   ========================================================================= */
(function () {
  const MAX_ROWS = 3;
  const MONTH_GRID = 'monthGrid';

  const css = document.createElement('style');
  css.id = 'pbCalProStyle';
  css.textContent = [
    '#monthGrid{align-items:stretch}',
    '.month-cell{display:flex!important;flex-direction:column;gap:2px;min-height:124px;height:auto!important;padding:8px 8px 10px;cursor:pointer;position:relative;text-align:left;transition:box-shadow .16s ease,border-color .16s ease,background .16s ease,transform .16s ease;overflow:visible!important}',
    '.month-cell:hover{box-shadow:0 0 0 1px rgba(167,139,250,.55),0 10px 24px rgba(0,0,0,.45);transform:translateY(-1px);z-index:2}',
    '.month-cell.pb-drop-active{box-shadow:0 0 0 2px rgba(167,139,250,.9),0 12px 28px rgba(0,0,0,.5)!important;background:rgba(167,139,250,.14)!important}',
    '.month-cell .month-day-number{align-self:flex-start;margin-bottom:2px}',
    '.cv-rows{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}',
    '.cv-chip{display:flex;align-items:center;gap:6px;min-width:0;padding:3px 6px;border-radius:7px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);cursor:grab;transition:box-shadow .14s ease,border-color .14s ease,transform .14s ease,background .14s ease;user-select:none}',
    '.cv-chip:hover{box-shadow:0 0 0 1px rgba(167,139,250,.75);border-color:rgba(167,139,250,.85);background:rgba(167,139,250,.12);transform:translateY(-1px)}',
    '.cv-chip.is-task{border-color:rgba(248,113,113,.35)}',
    '.cv-chip.is-task:hover{box-shadow:0 0 0 1px rgba(248,113,113,.8);border-color:rgba(248,113,113,.85);background:rgba(248,113,113,.1)}',
    '.cv-chip-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:#e7e2f2}',
    '.cv-chip-time{flex:0 0 auto;font-size:10.5px;color:#a78bfa;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.cv-chip.is-task .cv-chip-time{color:#f87171}',
    '.cv-chip.pb-dragging{opacity:.35}',
    '.cv-more{position:relative;align-self:flex-start;font-size:10.5px;color:#a8a3b3;padding:2px 6px;border-radius:6px;cursor:pointer;white-space:nowrap}',
    '.cv-more:hover{color:#cdbdfd;background:rgba(167,139,250,.12)}',
    '.cv-more-list{position:absolute;left:0;bottom:calc(100% + 4px);z-index:60;min-width:190px;max-width:260px;display:none;flex-direction:column;gap:2px;padding:6px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#17151d;box-shadow:0 16px 34px rgba(0,0,0,.6)}',
    '.cv-more:hover .cv-more-list,.cv-more:focus .cv-more-list,.cv-more:focus-within .cv-more-list{display:flex}',
    '.cv-more-item{display:flex;gap:8px;align-items:baseline;padding:4px 6px;border-radius:6px;font-size:11.5px;color:#e7e2f2;cursor:pointer}',
    '.cv-more-item:hover{background:rgba(167,139,250,.16)}',
    '.cv-more-item b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cv-more-item span{color:#a78bfa;font-size:10.5px;font-variant-numeric:tabular-nums}',
    '.cv-add{align-self:stretch;margin-top:auto;height:16px;display:flex;align-items:center;justify-content:center;color:#6f6a7d;font-size:13px;opacity:0;transition:opacity .14s ease}',
    '.month-cell:hover .cv-add{opacity:1;color:#a78bfa}',
    '.pb-dnd-ghost{position:fixed;z-index:9999;pointer-events:none;padding:4px 8px;border-radius:8px;background:#241f33;border:1px solid rgba(167,139,250,.9);color:#f1ecff;font-size:11.5px;box-shadow:0 12px 28px rgba(0,0,0,.55);transform:translate(8px,8px);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.pb-dnd-hint{display:flex;align-items:center;gap:8px;font-size:12px;color:#8f8a9c;margin:0 0 10px}',
    '.pb-dnd-hint .pb-icon{width:14px;height:14px;color:#a78bfa}',
    '@media (pointer:coarse){.pb-dnd-hint{display:none}.month-cell{min-height:96px}}',
    /* редактор события */
    '#pbEventEditor .modal{max-width:520px}',
    '#pbEventEditor .pb-ed-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
  ].join('');
  document.head.appendChild(css);

  function icon(name, cls) { return (typeof window.pbIcon === 'function') ? window.pbIcon(name, cls) : ''; }
  function toast(m) { if (typeof window.toast === 'function') window.toast(m); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function data() {
    try { return (typeof window.pbState === 'function') ? window.pbState() : null; } catch (e) { return null; }
  }
  function fmtRu(key) {
    try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(key + 'T12:00:00')); }
    catch (e) { return key; }
  }
  function timeLabel(t) { return t && String(t).trim() ? String(t).slice(0, 5) : 'весь день'; }

  // ---------------- данные дня ----------------
  function itemsFor(dateKey) {
    const st = data();
    if (!st) return [];
    const all = (typeof st.allEvents === 'function') ? st.allEvents() : [];
    return all.filter(function (e) { return e.date === dateKey; });
  }

  // ---------------- сетка месяца ----------------
  function enhanceGrid() {
    const grid = document.getElementById(MONTH_GRID);
    if (!grid) return;
    grid.querySelectorAll('.month-cell').forEach(function (cell) {
      if (cell.dataset.pbCell === '1') return;
      const handler = cell.getAttribute('onclick') || '';
      const m = handler.match(/openDayModal\('([\d-]+)'\)/);
      const key = m ? m[1] : cell.dataset.date;
      if (!key) return;

      const div = document.createElement('div');
      div.className = cell.className;
      div.dataset.pbCell = '1';
      div.dataset.date = key;
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.title = 'Клик — добавить событие на ' + fmtRu(key);

      const numEl = cell.querySelector('.month-day-number');
      div.innerHTML = '<span class="month-day-number">' + esc(numEl ? numEl.textContent : '') + '</span>' +
        '<div class="cv-rows"></div><div class="cv-add">＋</div>';

      const rows = div.querySelector('.cv-rows');
      const items = itemsFor(key);
      items.slice(0, MAX_ROWS).forEach(function (it) {
        rows.appendChild(chipEl(it, key));
      });
      if (!items.length) {
        rows.innerHTML = '<div class="cv-chip" style="visibility:hidden;height:0;border:0;padding:0"></div>';
      }
      if (items.length > MAX_ROWS) {
        rows.appendChild(moreEl(items.slice(MAX_ROWS), key, items.length - MAX_ROWS));
      }
      cell.replaceWith(div);
    });
  }

  function chipEl(item, dateKey) {
    const chip = document.createElement('div');
    chip.className = 'cv-chip' + (item.kind === 'task' ? ' is-task' : '');
    chip.dataset.kind = item.kind === 'task' ? 'task' : 'event';
    chip.dataset.index = String(item.kind === 'task' ? item.ti : item.ei);
    chip.dataset.date = dateKey;
    chip.title = (item.title || '') + ' · ' + timeLabel(item.time);
    chip.innerHTML = '<span class="cv-chip-title">' + esc(item.title || '') + '</span>' +
      '<span class="cv-chip-time">' + esc(timeLabel(item.time)) + '</span>';
    return chip;
  }

  function moreEl(rest, dateKey, n) {
    const box = document.createElement('div');
    box.className = 'cv-more';
    box.tabIndex = 0;
    const list = rest.map(function (it) {
      return '<div class="cv-more-item" data-kind="' + (it.kind === 'task' ? 'task' : 'event') + '" data-index="' +
        (it.kind === 'task' ? it.ti : it.ei) + '" data-date="' + esc(dateKey) + '">' +
        '<span>' + esc(timeLabel(it.time)) + '</span><b>' + esc(it.title || '') + '</b></div>';
    }).join('');
    box.innerHTML = '<span>ещё ' + n + '</span><div class="cv-more-list">' + list + '</div>';
    return box;
  }

  // ---------------- перетаскивание мышью ----------------
  let drag = null;

  function moveItem(kind, index, newDate) {
    const st = data();
    if (!st) return false;
    const i = Number(index);
    const list = kind === 'task' ? st.tasks : st.events;
    if (!Array.isArray(list) || !list[i]) return false;
    if (list[i].date === newDate) return false;
    list[i].date = newDate;
    if (typeof st.persist === 'function') st.persist();
    if (typeof st.renderAll === 'function') st.renderAll();
    toast((kind === 'task' ? 'Задача перенесена на ' : 'Событие перенесено на ') + fmtRu(newDate));
    return true;
  }

  function clearMarks() {
    document.querySelectorAll('.month-cell.pb-drop-active').forEach(function (c) { c.classList.remove('pb-drop-active'); });
    document.querySelectorAll('.cv-chip.pb-dragging').forEach(function (c) { c.classList.remove('pb-dragging'); });
    const g = document.querySelector('.pb-dnd-ghost');
    if (g) g.remove();
  }

  function onPointerDown(e) {
    const chip = e.target.closest && e.target.closest('.cv-chip');
    if (!chip || !chip.dataset.kind) return;
    if (e.button != null && e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    const rect = chip.getBoundingClientRect();
    drag = {
      chip: chip,
      kind: chip.dataset.kind,
      index: chip.dataset.index,
      from: chip.dataset.date,
      title: (chip.querySelector('.cv-chip-title') || {}).textContent || '',
      time: (chip.querySelector('.cv-chip-time') || {}).textContent || '',
      started: false,
      px: e.clientX,
      py: e.clientY
    };
    try { chip.setPointerCapture(e.pointerId); } catch (_e) { }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.started) {
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      drag.started = true;
      drag.chip.classList.add('pb-dragging');
      const ghost = document.createElement('div');
      ghost.className = 'pb-dnd-ghost';
      ghost.textContent = drag.time + ' · ' + drag.title;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cell = under && under.closest ? under.closest('.month-cell') : null;
    document.querySelectorAll('.month-cell.pb-drop-active').forEach(function (c) { c.classList.remove('pb-drop-active'); });
    if (cell && cell.dataset.date && cell.dataset.date !== drag.from) cell.classList.add('pb-drop-active');
  }

  function onPointerUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    const wasStarted = d.started;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const cell = target && target.closest ? target.closest('.month-cell') : null;
    clearMarks();
    if (wasStarted) {
      if (cell && cell.dataset.date) {
        moveItem(d.kind, d.index, cell.dataset.date);
      }
      return;
    }
    // клик без перетаскивания — редактор события
    openEditor(d.kind, d.index);
  }

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', function () { drag = null; clearMarks(); });

  // клик по пустому месту дня / по «＋»
  document.addEventListener('click', function (e) {
    const moreItem = e.target.closest && e.target.closest('.cv-more-item');
    if (moreItem) {
      e.preventDefault();
      e.stopPropagation();
      openEditor(moreItem.dataset.kind, moreItem.dataset.index);
      return;
    }
    const cell = e.target.closest && e.target.closest('.month-cell');
    if (!cell || !cell.dataset.date) return;
    if (e.target.closest('.cv-chip') || e.target.closest('.cv-more')) return;
    if (typeof window.openDayModal === 'function') window.openDayModal(cell.dataset.date);
  });

  // ---------------- редактор события ----------------
  function ensureEditor() {
    if (document.getElementById('pbEventEditor')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbEventEditor';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true">',
      '<div class="modal-head"><h2 id="pbEdTitle">Событие</h2><button class="close" type="button" id="pbEdClose">×</button></div>',
      '<div class="form">',
      '<label class="wide">Название<input class="field" id="pbEdName" maxlength="140"></label>',
      '<div class="pb-ed-row"><label>Дата<input class="field" id="pbEdDate" type="date"></label><label>Время<input class="field" id="pbEdTime" type="time"></label></div>',
      '<div class="pb-ed-row"><label>Место<input class="field" id="pbEdPlace" maxlength="120"></label><label>Тип<input class="field" id="pbEdType" maxlength="60"></label></div>',
      '</div>',
      '<div class="form-actions" style="justify-content:space-between">',
      '<button class="btn ghost" type="button" id="pbEdDelete">Удалить</button>',
      '<div style="display:flex;gap:8px"><button class="btn ghost" type="button" id="pbEdCancel">Отмена</button><button class="btn red" type="button" id="pbEdSave">Сохранить</button></div>',
      '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeEditor(); });
    document.getElementById('pbEdClose').onclick = closeEditor;
    document.getElementById('pbEdCancel').onclick = closeEditor;
    document.getElementById('pbEdSave').onclick = saveEditor;
    document.getElementById('pbEdDelete').onclick = deleteEditor;
  }

  let edCtx = null;
  function openEditor(kind, index) {
    const st = data();
    if (!st) return;
    const i = Number(index);
    const item = (kind === 'task' ? st.tasks : st.events)[i];
    if (!item) { toast('Не удалось открыть запись'); return; }
    ensureEditor();
    edCtx = { kind: kind, index: i };
    const isTask = kind === 'task';
    document.getElementById('pbEdTitle').textContent = isTask ? 'Задача' : 'Событие';
    document.getElementById('pbEdName').value = item.title || '';
    document.getElementById('pbEdDate').value = item.date || '';
    document.getElementById('pbEdTime').value = isTask ? '' : (item.time || '');
    document.getElementById('pbEdPlace').value = isTask ? (item.project || '') : (item.place || '');
    document.getElementById('pbEdType').value = isTask ? (item.status || '') : (item.type || '');
    document.getElementById('pbEdTime').disabled = isTask;
    document.getElementById('pbEdPlace').disabled = isTask;
    document.getElementById('pbEdPlace').placeholder = isTask ? 'Место только для событий' : 'Студия, адрес или ссылка';
    document.getElementById('pbEdType').disabled = isTask;
    document.getElementById('pbEventEditor').classList.add('open');
    setTimeout(function () { document.getElementById('pbEdName').focus(); }, 60);
  }
  function closeEditor() {
    const el = document.getElementById('pbEventEditor');
    if (el) el.classList.remove('open');
    edCtx = null;
  }

  function saveEditor() {
    if (!edCtx) return;
    const st = data();
    if (!st) return;
    const isTask = edCtx.kind === 'task';
    const list = isTask ? st.tasks : st.events;
    const item = list[edCtx.index];
    if (!item) return;
    const name = document.getElementById('pbEdName').value.trim();
    const day = document.getElementById('pbEdDate').value;
    if (!name) { toast('Введите название'); return; }
    if (!day) { toast('Выберите дату'); return; }
    item.title = name;
    item.date = day;
    if (!isTask) {
      item.time = document.getElementById('pbEdTime').value || '';
      item.place = document.getElementById('pbEdPlace').value;
      item.type = document.getElementById('pbEdType').value;
    }
    if (typeof st.persist === 'function') st.persist();
    if (typeof st.renderAll === 'function') st.renderAll();
    closeEditor();
    toast('Сохранено');
  }

  function deleteEditor() {
    if (!edCtx) return;
    const st = data();
    if (!st) return;
    const isTask = edCtx.kind === 'task';
    const list = isTask ? st.tasks : st.events;
    const item = list[edCtx.index];
    if (!item) return;
    if (!confirm('Удалить «' + (item.title || '') + '»?')) return;
    list.splice(edCtx.index, 1);
    if (typeof st.persist === 'function') st.persist();
    if (typeof st.renderAll === 'function') st.renderAll();
    closeEditor();
    toast('Удалено');
  }

  // ---------------- подсказка и запуск ----------------
  function addHint() {
    const host = document.getElementById('monthCal');
    if (!host || host.querySelector('.pb-dnd-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'pb-dnd-hint';
    hint.innerHTML = icon('arrow-right') + '<span>Потяните событие на другой день, чтобы изменить дату. Клик по событию — редактирование, по пустому месту — новое событие.</span>';
    const grid = document.getElementById(MONTH_GRID);
    if (grid && grid.parentNode === host) host.insertBefore(hint, grid);
    else host.appendChild(hint);
  }

  function hookRender() {
    if (typeof window.renderCalendar !== 'function' || window.renderCalendar.__pbPro) return;
    const orig = window.renderCalendar;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      try { addHint(); enhanceGrid(); } catch (e) { console.warn('[cal-pro]', e); }
      return r;
    };
    wrapped.__pbPro = true;
    window.renderCalendar = wrapped;
  }

  function boot() {
    hookRender();
    addHint();
    enhanceGrid();
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[onclick*="shiftMonth"], [data-calview]')) {
        setTimeout(function () { addHint(); enhanceGrid(); }, 60);
      }
    });
    const grid = document.getElementById(MONTH_GRID);
    if (grid) {
      let t = 0;
      const obs = new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(function () { try { enhanceGrid(); } catch (_e) { } }, 30);
      });
      obs.observe(grid, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
