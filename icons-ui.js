/* =========================================================================
   Иконки для ПРИЗНАКИ БЕШЕНСТВА 24
   Подключается после supabase-layer.js. Набор — window.PB_ICONS (icons.js).
   Ничего не переопределяет в данных; только добавляет выбор и показ иконок.
   ========================================================================= */
(function () {
  const ICONS = window.PB_ICONS || {};
  const NAMES = Object.keys(ICONS);
  if (!NAMES.length) { console.warn('[icons] набор иконок не загрузился'); return; }

  const PICKER_DEFAULT = 'sparkles';

  // ---------- CSS ----------
  const style = document.createElement('style');
  style.id = 'pbIconsStyle';
  style.textContent = [
    '.pb-icon{width:20px;height:20px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;display:inline-block;vertical-align:-4px}',
    '.pb-icon-lg{width:24px;height:24px}',
    '.pb-icon-sm{width:15px;height:15px}',
    '.pb-icon-inline{width:16px;height:16px;margin-right:7px;color:#a78bfa;vertical-align:-3px}',
    '.pb-tile-icon{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(167,139,250,.12);color:#c4b5fd;margin-bottom:14px}',
    '.pb-tile-icon .pb-icon{width:23px;height:23px}',
    '.pb-dir-icon{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:rgba(167,139,250,.14);color:#c4b5fd;margin-right:10px;vertical-align:-8px}',
    '.pb-icon-field{display:grid;gap:7px;margin:2px 0 4px;align-self:start}',
    '.pb-icon-field>span{font-size:12px;color:#8f8a9c}',
    '.pb-icon-btn{display:flex;align-items:center;gap:10px;min-height:46px;width:100%;padding:9px 12px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.02);color:#e6e2ee;cursor:pointer;font:14px/1.2 inherit;text-align:left;transition:border-color .16s,background .16s}',
    '.pb-icon-btn:hover{border-color:rgba(167,139,250,.45);background:rgba(167,139,250,.07)}',
    '.pb-icon-btn .pb-icon{color:#c4b5fd}',
    '.pb-picker-search{margin-bottom:12px}',
    '.pb-icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:6px;max-height:min(46vh,380px);overflow:auto;padding:4px;border-radius:12px}',
    '.pb-icon-cell{display:grid;place-items:center;width:100%;aspect-ratio:1;border:1px solid transparent;border-radius:11px;background:rgba(255,255,255,.03);color:#cfc9db;cursor:pointer;transition:background .14s,border-color .14s,color .14s,transform .14s}',
    '.pb-icon-cell:hover{background:rgba(167,139,250,.12);color:#e6ddff;transform:translateY(-1px)}',
    '.pb-icon-cell.selected{border-color:rgba(167,139,250,.75);background:rgba(167,139,250,.18);color:#fff}',
    '.pb-icon-cell .pb-icon{width:22px;height:22px}',
    '.pb-icon-grid .pb-empty{grid-column:1/-1;padding:16px;color:#8f8a9c;font-size:13px;text-align:center}',
    '.pb-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}',
    '.pb-modal-title{font-size:19px;font-weight:600;letter-spacing:-.01em;margin:0 0 4px}',
    '.pb-modal-sub{font-size:13px;color:#8f8a9c;margin:0 0 16px}',
    '.pb-draft-icon{display:flex;align-items:center;gap:10px}',
    '.pb-draft-icon .pb-icon-btn{width:auto;flex:1}',
    '@media (max-width:520px){.pb-icon-grid{grid-template-columns:repeat(auto-fill,minmax(42px,1fr));max-height:44vh}}'
  ].join('');
  document.head.appendChild(style);

  // ---------- базовые помощники ----------
  function pbIcon(name, cls) {
    const body = ICONS[name];
    if (!body) return '';
    return '<svg class="pb-icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }
  window.pbIcon = pbIcon;

  function areaIconName(area) {
    const map = window.areaIcons || {};
    return map[area] || '';
  }
  window.directionTileIcon = function (area) {
    const name = areaIconName(area) || 'compass';
    return '<div class="pb-tile-icon">' + pbIcon(name) + '</div>';
  };
  window.directionIconHTML = function (area) {
    const name = areaIconName(area);
    return name ? pbIcon(name) : '';
  };

  // ---------- показ иконок в списках ----------
  function decorateIcons() {
    const lists = {
      task: (typeof tasks !== 'undefined') ? tasks : null,
      goal: (typeof goals !== 'undefined') ? goals : null,
      project: (typeof projects !== 'undefined') ? projects : null
    };
    document.querySelectorAll('[data-kind][data-i]').forEach(function (el) {
      if (el.dataset.pbIcon === '1') return;
      const list = lists[el.dataset.kind];
      if (!list) return;
      const item = list[Number(el.dataset.i)];
      if (!item || !item.icon) return;
      const svg = pbIcon(item.icon, 'pb-icon-inline');
      if (!svg) return;
      const holder = el.querySelector('.task-title') || el.querySelector('h3') || el.querySelector('b');
      if (!holder) return;
      holder.insertAdjacentHTML('afterbegin', svg);
      el.dataset.pbIcon = '1';
    });
  }

  const prevRenderAll = window.renderAll;
  window.renderAll = function () {
    if (typeof prevRenderAll === 'function') prevRenderAll.apply(this, arguments);
    try { decorateIcons(); } catch (e) { console.warn('[icons] decorate', e); }
  };

  // иконка в шапке карточки направления + кнопка «Иконка»
  const prevShowDirection = window.showDirection;
  window.showDirection = function (area) {
    if (typeof prevShowDirection === 'function') prevShowDirection.apply(this, arguments);
    const title = document.getElementById('directionDetailTitle');
    if (!title || !title.parentElement) return;
    const host = title.parentElement;
    let badge = host.querySelector('.pb-dir-icon');
    const name = areaIconName(area);
    if (name) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'pb-dir-icon';
        host.insertBefore(badge, title);
      }
      badge.innerHTML = pbIcon(name);
      badge.style.display = '';
    } else if (badge) {
      badge.style.display = 'none';
    }
    const bar = document.getElementById('dirActions');
    if (bar && !bar.querySelector('[data-pb-icon-edit]')) {
      const b = document.createElement('button');
      b.className = 'btn tiny ghost';
      b.setAttribute('data-pb-icon-edit', '1');
      b.textContent = 'Иконка';
      b.onclick = function () {
        openPicker('Иконка направления', areaIconName(area), async function (icon) {
          if (typeof window.saveDirection !== 'function') { toast('Нужен обновлённый supabase-layer.js'); return; }
          const r = await window.saveDirection(area, icon);
          if (r && r.error) { toast('Не удалось сохранить иконку: ' + r.error.message); return; }
          window.areaIcons = window.areaIcons || {};
          window.areaIcons[area] = icon;
          window.renderAll && window.renderAll();
          window.showDirection && window.showDirection(area);
          toast('Иконка обновлена');
        });
      };
      bar.appendChild(b);
    }
  };

  // ---------- модалка выбора иконки ----------
  let pickerCb = null;
  let pickerSelected = '';

  function ensurePicker() {
    if (document.getElementById('pbIconPicker')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbIconPicker';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true">',
      '<div class="pb-modal-title" id="pbPickerTitle">Иконка</div>',
      '<p class="pb-modal-sub">Выберите из набора. Поиск — по английскому названию: music, mic, users, money…</p>',
      '<input class="field pb-picker-search" id="pbPickerSearch" placeholder="Поиск иконки">',
      '<div class="pb-icon-grid" id="pbPickerGrid"></div>',
      '<div class="pb-modal-actions"><button class="btn ghost" type="button" id="pbPickerCancel">Отмена</button><button class="btn ghost" type="button" id="pbPickerClear">Без иконки</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) closePicker();
    });
    document.getElementById('pbPickerCancel').onclick = closePicker;
    document.getElementById('pbPickerClear').onclick = function () { chooseIcon(''); };
    document.getElementById('pbPickerSearch').addEventListener('input', function () {
      renderGrid(this.value.trim().toLowerCase());
    });
  }

  function renderGrid(query) {
    pickerSelected = pickerSelected || '';
    const grid = document.getElementById('pbPickerGrid');
    if (!grid) return;
    const list = query ? NAMES.filter(function (n) { return n.indexOf(query) !== -1; }) : NAMES;
    grid.innerHTML = list.length
      ? list.map(function (n) {
        return '<button type="button" class="pb-icon-cell' + (n === pickerSelected ? ' selected' : '') +
          '" data-icon="' + n + '" title="' + n + '" aria-label="' + n + '">' + pbIcon(n) + '</button>';
      }).join('')
      : '<div class="pb-empty">Ничего не нашлось. Попробуйте music, mic, users, money.</div>';
  }

  function openPicker(title, current, cb) {
    ensurePicker();
    pickerCb = cb;
    pickerSelected = current || '';
    document.getElementById('pbPickerTitle').textContent = title || 'Иконка';
    const search = document.getElementById('pbPickerSearch');
    search.value = '';
    renderGrid('');
    document.getElementById('pbIconPicker').classList.add('open');
    setTimeout(function () { search.focus(); }, 60);
    document.getElementById('pbPickerGrid').onclick = function (e) {
      const cell = e.target.closest('[data-icon]');
      if (cell) chooseIcon(cell.dataset.icon);
    };
  }

  function chooseIcon(name) {
    const cb = pickerCb;
    closePicker();
    if (typeof cb === 'function') cb(name || '');
  }

  function closePicker() {
    const el = document.getElementById('pbIconPicker');
    if (el) el.classList.remove('open');
    pickerCb = null;
  }
  window.pbPickIconGlobal = openPicker;

  // ---------- карточка создания направления ----------
  let directionDraftIcon = '';

  function ensureDirectionModal() {
    if (document.getElementById('pbDirectionModal')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbDirectionModal';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true">',
      '<div class="pb-modal-title">Новое направление</div>',
      '<p class="pb-modal-sub">Область работы группы: название и иконка. Иконку потом можно менять.</p>',
      '<div class="form">',
      '<label>Название<input class="field" id="pbDirectionName" maxlength="60" placeholder="Например: Мерч и одежда"></label>',
      '<div class="pb-icon-field"><span>Иконка</span>',
      '<button type="button" class="pb-icon-btn" id="pbDirectionIconBtn"><span class="pb-icon-preview" id="pbDirectionIconPreview"></span><span class="pb-icon-name" id="pbDirectionIconName">Выбрать иконку</span></button>',
      '</div>',
      '</div>',
      '<div class="pb-modal-actions"><button class="btn ghost" type="button" id="pbDirectionCancel">Отмена</button><button class="btn red" type="button" id="pbDirectionSave">Создать направление</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeDirectionModal(); });
    document.getElementById('pbDirectionCancel').onclick = closeDirectionModal;
    document.getElementById('pbDirectionIconBtn').onclick = function () {
      openPicker('Иконка направления', directionDraftIcon, function (icon) {
        directionDraftIcon = icon;
        paintDirectionIcon();
      });
    };
    document.getElementById('pbDirectionSave').onclick = saveDirectionFromModal;
    document.getElementById('pbDirectionName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveDirectionFromModal(); }
    });
  }

  function paintDirectionIcon() {
    const p = document.getElementById('pbDirectionIconPreview');
    const n = document.getElementById('pbDirectionIconName');
    if (p) p.innerHTML = pbIcon(directionDraftIcon || PICKER_DEFAULT);
    if (n) n.textContent = directionDraftIcon || 'Выбрать иконку';
  }

  function openDirectionModal() {
    ensureDirectionModal();
    directionDraftIcon = '';
    document.getElementById('pbDirectionName').value = '';
    paintDirectionIcon();
    document.getElementById('pbDirectionModal').classList.add('open');
    setTimeout(function () { document.getElementById('pbDirectionName').focus(); }, 60);
  }

  function closeDirectionModal() {
    const el = document.getElementById('pbDirectionModal');
    if (el) el.classList.remove('open');
  }

  async function saveDirectionFromModal() {
    const input = document.getElementById('pbDirectionName');
    const btn = document.getElementById('pbDirectionSave');
    const name = input.value.trim();
    if (!name) { toast('Введите название направления'); input.focus(); return; }
    if (typeof areas !== 'undefined' && areas.indexOf(name) !== -1) { toast('Такое направление уже есть'); input.focus(); return; }
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Создаём…';
    try {
      let created = false;
      if (typeof window.saveDirection === 'function') {
        const r = await window.saveDirection(name, directionDraftIcon);
        if (r && r.error) { toast('Не удалось создать: ' + r.error.message); return; }
        created = true;
      }
      if (!created && typeof areas !== 'undefined') {
        areas.push(name);
        window.areaIcons = window.areaIcons || {};
        window.areaIcons[name] = directionDraftIcon;
        if (typeof persist === 'function') persist();
      }
      if (typeof persist === 'function' && created) { /* уже сохранено через saveDirection */ }
      window.renderAll && window.renderAll();
      closeDirectionModal();
      if (typeof toast === 'function') toast('Направление «' + name + '» создано');
      if (typeof window.showDirection === 'function') window.showDirection(name);
    } catch (e) {
      toast('Ошибка: ' + (e && e.message ? e.message : e));
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  // заменяем старый prompt-создатель направления на нормальную карточку
  window.openDirectionCreator = openDirectionModal;

  // ---------- иконки в формах задачи и цели ----------
  function fieldMarkup(formKey, title) {
    const id = formKey + 'IconInput';
    return [
      '<div class="pb-icon-field" data-pb-icon-field="' + formKey + '">',
      '<span>' + title + '</span>',
      '<button type="button" class="pb-icon-btn" data-pb-icon-open="' + formKey + '">',
      '<span class="pb-icon-preview">' + pbIcon(PICKER_DEFAULT) + '</span>',
      '<span class="pb-icon-name">Выбрать иконку</span>',
      '</button>',
      '<input type="hidden" name="icon" id="' + id + '" value="">',
      '</div>'
    ].join('');
  }

  function injectField(formId, formKey, title) {
    const form = document.getElementById(formId);
    if (!form || form.querySelector('[data-pb-icon-field="' + formKey + '"]')) return;
    const holder = document.createElement('div');
    holder.innerHTML = fieldMarkup(formKey, title);
    const block = holder.firstElementChild;
    const submit = form.querySelector('button[type="submit"]') || form.querySelector('.btn.red') || form.querySelector('button:not([type])');
    const actions = submit ? (submit.closest('.form-actions') || submit) : null;
    if (actions && actions.parentNode === form) form.insertBefore(block, actions);
    else if (submit && submit.parentNode) submit.parentNode.insertBefore(block, submit);
    else form.appendChild(block);
    const btn = block.querySelector('[data-pb-icon-open]');
    btn.onclick = function () {
      const current = (form.querySelector('input[name="icon"]') || {}).value || '';
      openPicker('Иконка', current, function (icon) { syncField(formId, icon); });
    };
  }

  function syncField(formId, icon) {
    const form = document.getElementById(formId);
    if (!form) return;
    const input = form.querySelector('input[name="icon"]');
    if (input) input.value = icon || '';
    const prev = form.querySelector('[data-pb-icon-field] .pb-icon-preview');
    const label = form.querySelector('[data-pb-icon-field] .pb-icon-name');
    if (prev) prev.innerHTML = pbIcon(icon || PICKER_DEFAULT);
    if (label) label.textContent = icon || 'Выбрать иконку';
  }

  injectField('taskForm', 'task', 'Иконка задачи');
  injectField('goalForm', 'goal', 'Иконка цели');

  // при открытии модалки сбрасываем поле, при редактировании — заполняем
  const prevOpenModal = window.openModal;
  window.openModal = function (id) {
    const res = (typeof prevOpenModal === 'function') ? prevOpenModal.apply(this, arguments) : undefined;
    if (id === 'taskModal') syncField('taskForm', '');
    if (id === 'goalModal') syncField('goalForm', '');
    return res;
  };

  const prevFillForm = window.fillForm;
  window.fillForm = function (form, item) {
    const res = (typeof prevFillForm === 'function') ? prevFillForm.apply(this, arguments) : undefined;
    if (form && form.id === 'taskForm') syncField('taskForm', (item && item.icon) || '');
    if (form && form.id === 'goalForm') syncField('goalForm', (item && item.icon) || '');
    return res;
  };

  // Экспорт задач в CSV (кнопка «Экспорт CSV» на странице задач)
  window.pbExportTasksCsv = function () {
    try {
      const list = (window.pbState && window.pbState().tasks) || [];
      const head = ['Название', 'Направление', 'Проект', 'Ответственный', 'Срок', 'Приоритет', 'Статус', 'Описание'];
      const rows = list.map(function (t) {
        return [t.title, t.area, t.project, t.owner, t.date, t.priority, t.status, t.description].map(function (v) {
          return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        }).join(';');
      });
      const csv = '\ufeff' + head.join(';') + '\r\n' + rows.join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'zadachi-' + new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk' }).format(new Date()) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      if (typeof window.toast === 'function') window.toast('Задачи выгружены в CSV');
    } catch (e) { console.warn('[export]', e); }
  };

  // Финансы доступны только владельцу: у участника прячем соответствующие кнопки
  function hideOwnerOnly() {
    try {
      const me = window.__CURRENT_PROFILE__ || {};
      const isOwner = me.role === 'owner';
      if (isOwner) return;
      ['[onclick*="moneyModal"]', '[onclick*="quickExpense"]', '[onclick*="openBankModal"]'].forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          el.style.display = 'none';
        });
      });
    } catch (e) { }
  }
  if (window.renderAll) {
    const _r = window.renderAll;
    window.renderAll = function () { const res = _r.apply(this, arguments); try { hideOwnerOnly(); } catch (e) { } return res; };
  }
  if (typeof window.deleteItem === 'function') {
    const _d = window.deleteItem;
    window.deleteItem = function (kind, i) {
      if (kind === 'money' && (window.__CURRENT_PROFILE__ || {}).role !== 'owner') { if (typeof window.toast === 'function') window.toast('Финансы меняет только владелец'); return; }
      return _d.apply(this, arguments);
    };
  }
  // При редактировании задачи дата обязательна: если её не было (например, задача создана
  // автоматически), подставляем сегодняшнюю, иначе форма молча не отправляется.
  (function () {
    if (typeof window.openEdit !== 'function') return;
    const _openEdit = window.openEdit;
    window.openEdit = function (kind, i) {
      const res = _openEdit.apply(this, arguments);
      try {
        if (kind === 'task' || kind === 'goal') {
          const form = document.getElementById(kind === 'task' ? 'taskForm' : 'goalForm');
          if (form) {
            [...form.querySelectorAll('[required]')].forEach(function (el) {
              if (!el.value) {
                if (el.type === 'date') {
                  el.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk' }).format(new Date());
                } else if (el.type === 'text') {
                  el.value = (window.__CURRENT_PROFILE__ && window.__CURRENT_PROFILE__.full_name) || 'Без названия';
                }
              }
            });
          }
        }
      } catch (e) { }
      return res;
    };
  })();

  if (typeof window.openEdit === 'function') {
    const _o = window.openEdit;
    window.openEdit = function (kind, i) {
      if (kind === 'money' && (window.__CURRENT_PROFILE__ || {}).role !== 'owner') { if (typeof window.toast === 'function') window.toast('Финансы меняет только владелец'); return; }
      return _o.apply(this, arguments);
    };
  }

  // первый проход после загрузки — на случай, если данные уже отрисованы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      try { decorateIcons(); } catch (e) {}
    });
  } else {
    try { decorateIcons(); } catch (e) {}
  }
})();
