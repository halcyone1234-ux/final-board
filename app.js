/* 畫面：總覽、組卡（七步驟＋六格表）、留言、老師模式 */
(function () {
  'use strict';

  const { backend, deviceId, LS, classId } = window.FB;
  const CFG = window.FB_CONFIG;
  const TEACHER = CFG.teacherName;

  const STAGES = ['分組・選資料', '定案・探索', '文獻・假設', '清資料・敘述統計', '分析・初版簡報', '修整・演練'];
  const METHODS = ['敘述統計與視覺化', '信度分析（Cronbach α）', '相關分析', 't 檢定', '卡方檢定', '簡單迴歸', '其他'];
  const FACES = ['遺漏變數', '樣本選擇偏誤', '聯立性', '測量誤差'];
  const STRUCTS = ['橫斷面（T = 1）', '追蹤資料（T ≥ 2）', '時間序列'];
  const DEFAULT_GROUPS = [
    { id: 'g1', order: 1, name: 'Ocean', members: ['黃苡銨', '余亞柔'] },
    { id: 'g2', order: 2, name: '這堂課修了不燒心', members: ['簡郁庭', '庄秉勛'] },
    { id: 'g3', order: 3, name: '下禮拜要去日本', members: ['羅心雅', '何宜儒'] },
    { id: 'g4', order: 4, name: '不顯著小組', members: ['吳峻宇', '張瑋容', '謝維'] },
    { id: 'g5', order: 5, name: '50年後諾貝爾', members: ['陳建安', '黃德成'] },
    { id: 'g6', order: 6, name: '歐趴組', members: ['白𥢽溙', '葉曜銘'] },
    { id: 'g7', order: 7, name: '差點顯著', members: ['葉蕙文', '李宜庭'] },
  ];

  const filled = (s) => !!(s && String(s).trim());
  const litLines = (g) => String(g.literature || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const STEPS = [
    { label: '研究問題與假設', done: (g) => filled(g.topic) && (filled(g.question) || filled(g.hypothesis)) },
    { label: '文獻', hint: '建議 5–8 篇', done: (g) => litLines(g).length > 0 },
    { label: '研究設計', done: (g) => filled(g.design) },
    { label: '測量（信度・效度）', done: (g) => filled(g.measurement) },
    { label: '抽樣與資料蒐集', hint: '≥ 1,000 筆', done: (g) => filled(g.dataName) && typeof g.dataN === 'number' },
    { label: '敘述統計與視覺化', done: (g) => filled(g.descriptive) },
    { label: '分析與推論', done: (g) => (g.methods || []).length > 0 || filled(g.methodNote) },
  ];
  const stepsDone = (g) => STEPS.filter((s) => s.done(g)).length;

  const state = { groups: [], comments: [], editing: new Set(), isTeacher: !!LS.get('fb.teacher', false), me: LS.get('fb.me', '') };
  const cardEls = new Map();

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  const fmtN = (n) => (typeof n === 'number' && isFinite(n) ? n.toLocaleString('en-US') : '');
  function fmtTime(ms) {
    if (!ms) return '';
    const d = new Date(ms), diff = (Date.now() - ms) / 1000;
    if (diff < 60) return '剛剛';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分鐘前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小時前';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
  const commentsOf = (gid) => state.comments.filter((c) => c.groupId === gid);
  const hasTopic = (g) => filled(g.topic);
  const currentGroup = (gid) => state.groups.find((x) => x.id === gid);
  const myName = () => (state.isTeacher ? TEACHER : state.me);
  const PX = window.PIXEL_ICONS;
  /* 組徽方塊；沒選的組顯示組名第一個字 */
  function badge(g, cls) {
    const ic = g.icon && PX.byId(g.icon);
    return h('span', { class: 'badge ' + (cls || '') + (ic ? '' : ' none') }, ic ? PX.svg(ic.id, ic.name) : h('span', { 'aria-hidden': 'true' }, Array.from(g.name || '?')[0]));
  }
  const takenBy = (iconId, exceptGid) => state.groups.find((x) => x.icon === iconId && x.id !== exceptGid);

  function notice(text, kind) {
    const n = document.getElementById('notice');
    n.textContent = text || ''; n.hidden = !text; n.dataset.kind = kind || '';
  }

  /* ---------- identity ---------- */
  function allMembers() {
    const names = [];
    for (const g of state.groups) for (const m of (g.members || [])) if (!names.includes(m)) names.push(m);
    return names;
  }
  function renderWho() {
    const box = document.getElementById('who');
    box.replaceChildren();
    if (state.isTeacher) {
      box.append(h('span', null, '老師模式：以 ', h('strong', null, TEACHER), ' 留言，可以改組名與成員、刪除任何留言。'), h('span', { class: 'spacer' }),
        h('a', { class: 'btn', href: '#board' }, '投影模式'), h('button', { class: 'btn', type: 'button', onclick: showQR }, '顯示 QR'),
        h('button', { class: 'btn', type: 'button', onclick: () => setTeacher(false) }, '離開老師模式'));
      return;
    }
    const sel = h('select', { id: 'me-select', 'aria-label': '選擇你的名字', onchange: (e) => { state.me = e.target.value; LS.set('fb.me', state.me); renderAllThreads(); } },
      h('option', { value: '' }, '請選擇你的名字'),
      allMembers().map((m) => h('option', { value: m, selected: m === state.me }, m)));
    box.append(h('span', null, '我是：'), sel, h('span', { class: 'spacer' }), h('span', { class: 'updated' }, '留言和更新組卡時會顯示這個名字'));
  }
  function setTeacher(on) {
    state.isTeacher = on; LS.set('fb.teacher', on);
    state.editing.clear();
    renderWho(); renderGroups();
  }

  /* ---------- overlay: PIN & QR ---------- */
  const overlay = document.getElementById('overlay');
  function closeOverlay() { overlay.hidden = true; overlay.replaceChildren(); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeOverlay(); });
  function askPin() {
    if (state.isTeacher) { setTeacher(false); return; }
    const input = h('input', { type: 'password', id: 'pin', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'PIN' });
    const msg = h('span', { class: 'form-msg', role: 'status' });
    const form = h('form', { class: 'dialog', onsubmit: (e) => {
      e.preventDefault();
      if (input.value === String(CFG.adminPin)) { closeOverlay(); setTeacher(true); }
      else { msg.textContent = 'PIN 不對，再試一次。'; input.select(); }
    } }, h('h3', null, '老師模式'), h('label', { for: 'pin' }, '請輸入 PIN'), input, msg,
      h('div', { class: 'row-btn' }, h('button', { type: 'button', class: 'btn', onclick: closeOverlay }, '取消'), h('button', { type: 'submit', class: 'btn primary' }, '進入')));
    overlay.replaceChildren(form); overlay.hidden = false; input.focus();
  }
  function showQR() {
    const url = location.origin + location.pathname + (classId !== CFG.defaultClassId ? '?c=' + classId : '');
    const qr = h('div', { class: 'qr' });
    overlay.replaceChildren(h('div', { class: 'dialog', role: 'dialog', 'aria-label': '看板 QR code' },
      h('h3', null, '掃 QR 打開看板'), qr, h('div', { class: 'url' }, url),
      h('button', { type: 'button', class: 'btn', onclick: closeOverlay }, '關閉')));
    overlay.hidden = false;
    if (window.QRCode) new QRCode(qr, { text: url, width: 240, height: 240 });
    else qr.textContent = '（QR 載入失敗，請直接分享上面的網址）';
  }
  document.getElementById('teacher-btn').addEventListener('click', askPin);

  /* ---------- stats & ledger ---------- */
  function renderStats() {
    const g = state.groups;
    const vals = [g.length, g.filter(hasTopic).length + ' / ' + g.length, g.filter((x) => x.dataN >= 1000).length + ' / ' + g.length,
      g.filter((x) => stepsDone(x) === 7).length + ' / ' + g.length, state.comments.length];
    document.querySelectorAll('#stats .stat b').forEach((b, i) => { b.textContent = String(vals[i]); });
  }
  function stageBar(stage) {
    const s = typeof stage === 'number' ? stage : -1;
    return h('div', null,
      h('div', { class: 'stages', role: 'img', 'aria-label': s >= 0 ? '進度：' + STAGES[s] : '尚未更新進度' }, STAGES.map((_, i) => h('i', { class: i <= s ? 'on' : '' }))),
      h('div', { class: 'stage-label' }, s >= 0 ? `${s + 1}/6 ${STAGES[s]}` : '尚未更新'));
  }
  function nBadge(n) {
    if (typeof n !== 'number') return null;
    return h('span', { class: 'nbadge ' + (n >= 1000 ? 'ok' : 'low'), title: n >= 1000 ? '已達 1,000 筆' : '未達 1,000 筆' }, 'n = ' + fmtN(n));
  }
  function renderLedger() {
    const tb = document.getElementById('ledger');
    tb.replaceChildren();
    if (!state.groups.length) { tb.append(h('tr', null, h('td', { colspan: 8, class: 'empty' }, '還沒有組別資料。'))); return; }
    for (const g of state.groups) {
      const cnt = commentsOf(g.id).length;
      tb.append(h('tr', { onclick: () => jumpTo(g.id), tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter') jumpTo(g.id); } },
        h('td', { class: 'gname' }, h('span', { class: 'gcell' }, badge(g, 'sm'), g.name)),
        h('td', null, (g.members || []).join('、')),
        h('td', { class: hasTopic(g) ? '' : 'empty' }, hasTopic(g) ? g.topic : '尚未填寫'),
        h('td', null, g.dataName ? h('div', { style: 'display:grid;gap:3px' }, g.dataName, nBadge(g.dataN)) : h('span', { class: 'empty' }, '尚未填寫')),
        h('td', null, (g.methods || []).length ? h('div', { class: 'chips' }, g.methods.map((m) => h('span', { class: 'chip' }, m))) : h('span', { class: 'empty' }, '—')),
        h('td', null, h('div', { style: 'display:grid;gap:4px' },
          h('div', { class: 'prog7', role: 'img', 'aria-label': `七步驟已填 ${stepsDone(g)} 項` }, STEPS.map((s) => h('i', { class: s.done(g) ? 'on' : '', title: s.label }))),
          h('span', { class: 'num', style: 'font-size:12px' }, stepsDone(g) + ' / 7'))),
        h('td', null, stageBar(g.stage)),
        h('td', { class: 'num' }, String(cnt))));
    }
  }
  function jumpTo(gid) {
    const el = cardEls.get(gid) && cardEls.get(gid).root; if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200);
  }

  /* ---------- card view ---------- */
  const kv = (k, v) => h('div', { class: 'kv' }, h('span', null, k), v instanceof Node || filled(v) ? h('span', null, v) : h('span', { class: 'none' }, '—'));
  const para = (v) => (filled(v) ? h('p', null, v) : h('p', { class: 'none' }, '尚未填寫'));
  function viewBody(g) {
    const url = safeUrl(g.dataUrl);
    const lit = litLines(g);
    const contents = [
      [kv('研究問題', g.question), kv('研究假設', g.hypothesis)],
      [lit.length ? h('ol', { class: 'lit' }, lit.map((l) => h('li', null, l))) : para('')],
      [para(g.design)],
      [para(g.measurement)],
      [kv('資料', g.dataName || url ? h('span', null, g.dataName || '', g.dataName && url ? ' ' : '', url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, '連結 ↗') : '') : ''),
        kv('筆數', typeof g.dataN === 'number' ? nBadge(g.dataN) : ''), kv('抽樣方式', g.sampling)],
      [para(g.descriptive)],
      [kv('方法', (g.methods || []).length ? h('span', { class: 'chips' }, g.methods.map((m) => h('span', { class: 'chip' }, m))) : ''), kv('說明', g.methodNote)],
    ];
    const map = [['故事', g.story], ['Y（結果）', g.y], ['X（原因）', g.x], ['Z／M／W', g.zmw], ['資料結構', g.dataStructure],
      ['四張臉', (g.faces || []).length ? h('span', { class: 'chips' }, g.faces.map((f) => h('span', { class: 'chip face' }, f))) : '']];
    return [
      h('p', { class: 'topic' + (hasTopic(g) ? '' : ' placeholder') }, hasTopic(g) ? g.topic : '研究題目尚未填寫'),
      h('p', { class: 'map-title' }, '起手式：六格表'),
      h('dl', { class: 'map6', 'aria-label': '六格表' }, map.map(([k, v]) => {
        const empty = !v; return h('div', null, h('dt', null, k), h('dd', { class: empty ? 'none' : '' }, empty ? '—' : v));
      })),
      h('ol', { class: 'steps', 'aria-label': '七個研究步驟' }, STEPS.map((s, i) => {
        const hint = i === 1 && lit.length ? `${lit.length} 篇（建議 5–8）` : s.hint;
        return h('li', { class: s.done(g) ? 'done' : '' },
          h('span', { class: 'sn', 'aria-hidden': 'true' }, String(i + 1)),
          h('div', { class: 'st' }, s.label, hint ? h('small', null, hint) : null, h('span', { class: 'sr-only' }, s.done(g) ? '（已填）' : '（未填）')),
          h('div', { class: 'sc' }, contents[i]));
      })),
    ];
  }

  /* ---------- edit form ---------- */
  function editForm(g) {
    const id = (k) => `f-${g.id}-${k}`;
    const txt = (k, label, val, ph) => h('label', { class: 'f', for: id(k) }, label, h('input', { type: 'text', id: id(k), value: val || '', placeholder: ph || '' }));
    const area = (k, label, val, ph) => h('label', { class: 'f', for: id(k) }, label, h('textarea', { id: id(k), placeholder: ph || '' }, val || ''));
    const checks = (k, legend, opts, sel) => h('fieldset', null, h('legend', null, legend),
      h('div', { class: 'checks' }, opts.map((o, i) => h('label', null, h('input', { type: 'checkbox', id: `${id(k)}-${i}`, value: o, checked: (sel || []).includes(o) }), o))));
    const msg = h('span', { class: 'form-msg', role: 'status' });
    const form = h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      const el = (k) => form.querySelector('#' + CSS.escape(id(k)));
      const v = (k) => el(k).value.trim();
      const picked = (k) => [...form.querySelectorAll(`input[id^="${CSS.escape(id(k))}-"]:checked`)].map((x) => x.value);
      if (!myName()) { msg.textContent = '請先在頁面上方選擇你的名字。'; return; }
      const nRaw = v('dataN').replace(/[,\s]/g, '');
      const nVal = nRaw === '' ? null : Number(nRaw);
      if (nRaw !== '' && !(Number.isFinite(nVal) && nVal >= 0)) { msg.textContent = '筆數請填數字，例如 12000。'; return; }
      const stageVal = el('stage').value;
      const patch = {
        topic: v('topic'), question: v('question'), hypothesis: v('hypothesis'),
        story: v('story'), y: v('y'), x: v('x'), zmw: v('zmw'), faces: picked('faces'),
        dataStructure: el('struct').value,
        literature: v('literature'), design: v('design'), measurement: v('measurement'),
        dataName: v('dataName'), dataUrl: v('dataUrl'), dataN: nVal, sampling: v('sampling'),
        descriptive: v('descriptive'),
        methods: picked('methods'), methodNote: v('methodNote'),
        stage: stageVal === '' ? null : Number(stageVal),
        updatedAt: Date.now(), updatedBy: myName(),
      };
      const iconPick = form.querySelector(`input[name="${CSS.escape(id('icon'))}"]:checked`);
      if (iconPick) {
        const other = takenBy(iconPick.value, g.id);
        if (other) { msg.textContent = `「${PX.byId(iconPick.value).name}」剛被${other.name}選走了，請換一隻。`; return; }
        patch.icon = iconPick.value;
      }
      if (state.isTeacher) {
        const name = v('gname'); const members = v('gmembers').split(/[、,，\s]+/).filter(Boolean);
        if (!name || !members.length) { msg.textContent = '組名和成員不能空白。'; return; }
        patch.name = name; patch.members = members;
      }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = '';
      try {
        await backend.updateGroup(g.id, patch);
        state.editing.delete(g.id); updateCard(currentGroup(g.id));
      } catch (err) {
        btn.disabled = false; msg.textContent = '儲存失敗，請確認網路後再試一次。';
      }
    } },
      state.isTeacher ? h('fieldset', null, h('legend', null, '老師專用：組名與成員'), h('div', { class: 'row' },
        txt('gname', '組名', g.name), txt('gmembers', '成員（用頓號分隔）', (g.members || []).join('、')))) : null,
      h('fieldset', null, h('legend', null, '組徽：挑一隻小動物（每組一隻，先選先贏）'),
        h('div', { class: 'icon-pick' }, PX.list.map((ic) => {
          const other = takenBy(ic.id, g.id);
          return h('label', { class: 'icon-opt' + (other ? ' taken' : ''), title: other ? `已被${other.name}選走` : ic.name },
            h('input', { type: 'radio', name: id('icon'), value: ic.id, checked: g.icon === ic.id, disabled: !!other }),
            h('span', { class: 'badge md' }, PX.svg(ic.id)),
            h('span', { class: 'icon-name' }, ic.name),
            other ? h('span', { class: 'icon-taken' }, other.name) : null);
        }))),
      txt('topic', '研究題目', g.topic, '例：參加產銷班能不能提高農民收入？'),
      h('fieldset', null, h('legend', null, '起手式：六格表（第 1 週地圖練習表）'), h('div', { class: 'form' },
        txt('story', '故事（一句話）', g.story, '我想講的故事'),
        h('div', { class: 'row' }, txt('y', 'Y（結果）', g.y), txt('x', 'X（原因）', g.x)),
        h('div', { class: 'row' }, txt('zmw', 'Z／M／W（干擾、中介、調節）', g.zmw),
          h('label', { class: 'f', for: id('struct') }, '資料結構', h('select', { id: id('struct') }, h('option', { value: '' }, '—'), STRUCTS.map((s) => h('option', { value: s, selected: g.dataStructure === s }, s))))),
        checks('faces', '四張臉：可能有哪些內生性問題', FACES, g.faces))),
      h('div', { class: 'row' }, area('question', '① 研究問題', g.question), area('hypothesis', '① 研究假設', g.hypothesis, 'H₁：…')),
      area('literature', '② 文獻（一行一篇，建議 5–8 篇）', g.literature, '作者（年份）。篇名。期刊。'),
      area('design', '③ 研究設計', g.design, '探索性／描述性／因果性？比較誰和誰？'),
      area('measurement', '④ 測量（信度・效度）', g.measurement, '關鍵變數怎麼量、尺度為何；信度與效度怎麼確認'),
      h('div', { class: 'row3' }, txt('dataName', '⑤ 資料名稱／來源', g.dataName, '例：SRDA 台灣社會變遷基本調查'),
        h('label', { class: 'f', for: id('dataUrl') }, '資料連結', h('input', { type: 'url', id: id('dataUrl'), value: g.dataUrl || '', placeholder: 'https://…' })),
        h('label', { class: 'f', for: id('dataN') }, '筆數（n）', h('input', { type: 'text', inputmode: 'numeric', id: id('dataN'), value: typeof g.dataN === 'number' ? String(g.dataN) : '', placeholder: '≥ 1000' }))),
      area('sampling', '⑤ 抽樣與資料蒐集方式', g.sampling, '原始資料怎麼抽樣、怎麼蒐集；你們怎麼篩選與清理'),
      area('descriptive', '⑥ 敘述統計與視覺化', g.descriptive, '要報哪些 M、SD、次數；畫哪些圖'),
      checks('methods', '⑦ 分析與推論：使用的方法', METHODS, g.methods),
      area('methodNote', '⑦ 方法說明（要檢定什麼、怎麼做）', g.methodNote),
      h('label', { class: 'f', for: id('stage') }, '目前進度', h('select', { id: id('stage') }, h('option', { value: '' }, '尚未開始'),
        STAGES.map((s, i) => h('option', { value: String(i), selected: g.stage === i }, `倒數 ${6 - i} 週：${s}`)))),
      h('div', { class: 'form-actions' }, msg,
        h('button', { type: 'button', class: 'btn', onclick: () => { state.editing.delete(g.id); updateCard(currentGroup(g.id)); } }, '取消'),
        h('button', { type: 'submit', class: 'btn primary' }, '儲存')));
    return form;
  }

  /* ---------- cards ---------- */
  function ensureCard(g) {
    if (cardEls.has(g.id)) return cardEls.get(g.id);
    const title = h('h3'), members = h('div', { class: 'members' }), updated = h('div', { class: 'updated' }), stage = h('div'), icon = h('span');
    const editBtn = h('button', { class: 'btn', type: 'button', onclick: () => { state.editing.add(g.id); updateCard(currentGroup(g.id)); } }, '編輯組卡');
    const body = h('div', { class: 'card-body' });
    const list = h('div', { class: 'clist' });
    const ta = h('textarea', { id: 'c-' + g.id, placeholder: '給這組的建議、問題或資料線索…', 'aria-label': '留言給 ' + g.name, maxlength: 2000 });
    const sendMsg = h('span');
    const send = h('button', { class: 'btn primary', type: 'submit' }, '送出留言');
    const composer = h('form', { class: 'composer', onsubmit: (e) => { e.preventDefault(); postComment(g.id, ta, send, sendMsg); } },
      ta, h('div', { class: 'bar' }, sendMsg, send));
    const count = h('span');
    const root = h('article', { class: 'card', id: 'g-' + g.id },
      h('div', { class: 'card-head' }, h('div', { class: 'gcell' }, icon, h('div', null, title, members)), h('div', { class: 'meta' }, stage, updated, editBtn)),
      body,
      h('div', { class: 'thread' }, h('h4', null, '建議與留言 ', count), list, composer));
    const refs = { root, title, members, updated, stage, editBtn, body, list, composer, ta, send, sendMsg, count, icon };
    cardEls.set(g.id, refs);
    return refs;
  }
  const updatedText = (g) => (g.updatedAt ? `${fmtTime(g.updatedAt)}由 ${g.updatedBy || '某人'} 更新` : '尚未更新');
  function updateCard(g) {
    if (!g) return;
    const r = ensureCard(g);
    r.title.textContent = g.name;
    r.icon.replaceChildren(badge(g, 'lg'));
    r.members.textContent = (g.members || []).join('、');
    r.updated.textContent = updatedText(g);
    r.stage.replaceChildren(stageBar(g.stage));
    r.editBtn.hidden = state.editing.has(g.id);
    if (state.editing.has(g.id)) {
      if (!r.body.querySelector('form')) r.body.replaceChildren(editForm(g));
    } else {
      r.body.replaceChildren(...viewBody(g));
    }
  }
  function renderThread(gid) {
    const r = cardEls.get(gid); if (!r) return;
    const cs = commentsOf(gid);
    r.count.textContent = cs.length ? `（${cs.length}）` : '';
    r.list.replaceChildren(...(cs.length ? cs.map((c) => {
      const canDel = state.isTeacher || c.deviceId === deviceId;
      const del = canDel ? h('button', { class: 'linkbtn', type: 'button', onclick: async (e) => {
        const b = e.currentTarget;
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '確定刪除？'; setTimeout(() => { b.dataset.armed = ''; b.textContent = '刪除'; }, 3000); return; }
        b.disabled = true; try { await backend.deleteComment(c.id); } catch (err) { b.disabled = false; b.textContent = '刪除失敗'; }
      } }, '刪除') : null;
      return h('div', { class: 'c' + (c.isTeacher ? ' teacher' : '') },
        h('div', { class: 'c-head' }, h('b', null, c.authorName || '匿名'), c.isTeacher ? h('span', { class: 'role' }, '老師') : null, h('time', null, fmtTime(c.createdAt)), del),
        h('p', null, c.text));
    }) : [h('p', { class: 'nocomment' }, '還沒有留言。')]));
    const needName = !myName();
    r.ta.disabled = needName; r.send.disabled = needName;
    r.ta.placeholder = needName ? '請先在頁面上方選擇你的名字，再留言。' : '給這組的建議、問題或資料線索…';
    if (!r.sendMsg.dataset.err) r.sendMsg.textContent = needName ? '' : `以「${myName()}」留言`;
  }
  function renderAllThreads() { for (const g of state.groups) renderThread(g.id); }

  async function postComment(gid, ta, btn, msg) {
    const text = ta.value.trim(); if (!text || !myName()) return;
    btn.disabled = true; msg.dataset.err = '';
    try {
      await backend.addComment({ groupId: gid, text, authorName: myName(), isTeacher: state.isTeacher, deviceId, createdAt: Date.now() });
      ta.value = ''; msg.textContent = `以「${myName()}」留言`;
    } catch (err) {
      msg.dataset.err = '1'; msg.textContent = '送出失敗，請確認網路後再試一次。';
    } finally { btn.disabled = false; }
  }

  function renderGroups() {
    const box = document.getElementById('cards');
    if (!state.groups.length) { box.replaceChildren(h('div', { class: 'loading' }, '還沒有組別資料。')); return; }
    for (const g of state.groups) updateCard(g);
    const ids = new Set(state.groups.map((g) => g.id));
    for (const [gid, r] of cardEls) if (!ids.has(gid)) { r.root.remove(); cardEls.delete(gid); }
    box.replaceChildren(...state.groups.map((g) => cardEls.get(g.id).root));
    renderAllThreads();
  }

  /* ---------- 投影模式（#board）：一個畫面看全部組別 ---------- */
  const boardEl = document.getElementById('board');
  const isBoard = () => location.hash === '#board';
  const siteUrl = () => location.origin + location.pathname + (classId !== CFG.defaultClassId ? '?c=' + classId : '');
  let boardQR = null;
  function boardTile(g) {
    const cs = commentsOf(g.id);
    const last = cs[cs.length - 1];
    const done = stepsDone(g);
    return h('article', { class: 'tile' },
      h('div', { class: 'tile-head' }, badge(g, 'xl'),
        h('div', { class: 'tile-id' }, h('h3', null, g.name), h('div', { class: 'members' }, (g.members || []).join('、'))),
        h('div', { class: 'tile-c', title: '留言數' }, h('b', { class: 'num' }, String(cs.length)), h('span', null, '則留言'))),
      h('p', { class: 'tile-topic' + (hasTopic(g) ? '' : ' none') }, hasTopic(g) ? g.topic : '研究題目尚未填寫'),
      h('div', { class: 'tile-data' }, g.dataName ? [h('span', { class: 'tile-dname' }, g.dataName), nBadge(g.dataN)] : h('span', { class: 'none' }, '資料尚未填寫')),
      (g.methods || []).length ? h('div', { class: 'chips' }, g.methods.map((m) => h('span', { class: 'chip' }, m))) : h('div', { class: 'chips none' }, '方法尚未填寫'),
      h('div', { class: 'tile-steps' },
        h('div', { class: 'tile-row' }, h('span', null, '七步驟'), h('b', { class: 'num' }, done + ' / 7')),
        h('ol', { class: 'step7', 'aria-label': `七步驟已填 ${done} 項` }, STEPS.map((s, i) => h('li', { class: s.done(g) ? 'on' : '', title: s.label }, String(i + 1))))),
      h('div', { class: 'tile-stage' }, stageBar(g.stage)),
      h('p', { class: 'tile-last' }, last ? [h('b', { class: last.isTeacher ? 'tch' : '' }, (last.authorName || '匿名') + '：'), last.text] : h('span', { class: 'none' }, '還沒有留言')));
  }
  function renderBoard() {
    if (!isBoard()) return;
    const g = state.groups;
    const n = g.length + 1;
    const cols = n <= 3 ? n : n <= 8 ? 4 : n <= 10 ? 5 : 6;
    const grid = h('div', { class: 'board-grid', style: `grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${Math.ceil(n / cols)},minmax(0,1fr))` },
      g.map(boardTile),
      h('article', { class: 'tile tile-qr' }, boardQR = h('div', { class: 'qr' }),
        h('p', null, '掃 QR 打開看板', h('br'), '更新組卡、給別組留言'), h('div', { class: 'url' }, siteUrl())));
    const stat = (v, l) => h('div', { class: 'bstat' }, h('b', { class: 'num' }, v), h('span', null, l));
    boardEl.replaceChildren(
      h('header', { class: 'board-head' },
        h('div', null, h('div', { class: 'eyebrow' }, '量化研究法（上）・期末資料分析專題'), h('h1', null, '期末專題看板')),
        h('div', { class: 'bstats' },
          stat(g.filter(hasTopic).length + '/' + g.length, '已定題目'),
          stat(g.filter((x) => x.dataN >= 1000).length + '/' + g.length, '資料 ≥ 1,000 筆'),
          stat(g.filter((x) => stepsDone(x) === 7).length + '/' + g.length, '七步驟填完'),
          stat(String(state.comments.length), '則留言')),
        h('a', { class: 'linkbtn board-exit', href: '#' }, '離開投影')),
      grid);
    if (window.QRCode) new QRCode(boardQR, { text: siteUrl(), width: 256, height: 256 });
    else boardQR.textContent = '（QR 載入失敗）';
  }
  function applyRoute() {
    if (location.hash === '#admin') { history.replaceState(null, '', location.pathname + location.search); if (!state.isTeacher) askPin(); }
    const on = isBoard();
    document.body.classList.toggle('board-mode', on);
    boardEl.hidden = !on;
    if (on) renderBoard();
  }
  window.addEventListener('hashchange', applyRoute);

  /* ---------- boot ---------- */
  const modeEl = document.getElementById('mode');
  if (backend.mode === 'mock') { modeEl.textContent = '本機測試模式'; modeEl.className = 'mode-pill off'; notice('本機測試模式：資料只存在這台瀏覽器，別人看不到。', 'info'); }
  else backend.onConnection((ok) => { modeEl.textContent = ok ? '已連線' : '連線中斷，恢復後會自動同步'; modeEl.className = 'mode-pill ' + (ok ? 'live' : 'off'); });

  renderWho(); applyRoute();
  let gotGroups = false;
  const timer = setTimeout(() => { if (!gotGroups) notice('資料還連不上，可能是網路問題。頁面會自動重試。'); }, 10000);
  backend.seedGroups(DEFAULT_GROUPS).catch(() => {});
  let memberKey = '';
  backend.onGroups((list) => {
    state.groups = list;
    if (!gotGroups) { gotGroups = true; clearTimeout(timer); if (backend.mode !== 'mock') notice(''); }
    const k = allMembers().join('|');
    if (k !== memberKey) { memberKey = k; renderWho(); }
    renderStats(); renderLedger(); renderGroups(); renderBoard();
  }, () => { clearTimeout(timer); notice('組別資料讀取失敗，請重新整理頁面。'); });
  backend.onComments((list) => {
    state.comments = list;
    renderStats(); renderLedger(); renderAllThreads(); renderBoard();
  }, () => notice('留言讀取失敗，請重新整理頁面。'));
  setInterval(() => {
    for (const g of state.groups) { const r = cardEls.get(g.id); if (r) r.updated.textContent = updatedText(g); }
    renderAllThreads();
  }, 60000);
})();
