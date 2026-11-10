/* 資料層：裝置匿名碼、Firebase Realtime Database（或本機 mock） */
(function () {
  'use strict';

  const CFG = window.FB_CONFIG;
  const params = new URLSearchParams(location.search);
  const classId = (params.get('c') || CFG.defaultClassId).replace(/[^A-Za-z0-9_-]/g, '') || CFG.defaultClassId;
  const useMock = params.get('mock') === '1' || !CFG.firebase.apiKey || /^YOUR/.test(CFG.firebase.apiKey) || typeof firebase === 'undefined';

  /* ---- localStorage helpers ---- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  let deviceId = LS.get('fb.deviceId', null);
  if (!deviceId) { deviceId = uuid(); LS.set('fb.deviceId', deviceId); }

  const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => Object.assign({ id }, v));
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
  const byTime = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  const strip = (g) => { const o = Object.assign({}, g); delete o.id; return o; };

  /* ---- Firebase ---- */
  function firebaseBackend() {
    firebase.initializeApp(CFG.firebase);
    const db = firebase.database();
    const root = db.ref('board/' + classId);
    return {
      mode: 'firebase',
      onGroups(cb, err) { root.child('groups').on('value', (s) => cb(toList(s.val()).sort(byOrder)), err); },
      onComments(cb, err) { root.child('comments').on('value', (s) => cb(toList(s.val()).sort(byTime)), err); },
      onConnection(cb) { db.ref('.info/connected').on('value', (s) => cb(!!s.val())); },
      updateGroup(gid, patch) { return root.child('groups/' + gid).update(patch); },
      addComment(c) { return root.child('comments').push(c); },
      deleteComment(cid) { return root.child('comments/' + cid).remove(); },
      /* 只在該組還不存在時寫入，不會蓋掉已填的內容 */
      seedGroups(defaults) {
        return Promise.all(defaults.map((g) => root.child('groups/' + g.id).transaction((cur) => (cur === null ? strip(g) : undefined))));
      },
    };
  }

  /* ---- 本機 mock：同一台電腦的分頁互相同步 ---- */
  function mockBackend() {
    const KEY = 'fb.mock.' + classId;
    const subs = { groups: [], comments: [] };
    const load = () => LS.get(KEY, { groups: {}, comments: {} });
    const emit = () => {
      const d = load();
      subs.groups.forEach((cb) => cb(toList(d.groups).sort(byOrder)));
      subs.comments.forEach((cb) => cb(toList(d.comments).sort(byTime)));
    };
    const save = (d) => { LS.set(KEY, d); emit(); };
    window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });
    const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === null || (Array.isArray(o[k]) && !o[k].length)) delete o[k]; return o; };
    return {
      mode: 'mock',
      onGroups(cb) { subs.groups.push(cb); setTimeout(emit, 0); },
      onComments(cb) { subs.comments.push(cb); setTimeout(emit, 0); },
      onConnection(cb) { setTimeout(() => cb(true), 0); },
      updateGroup(gid, patch) { const d = load(); d.groups[gid] = clean(Object.assign({}, d.groups[gid], patch)); save(d); return Promise.resolve(); },
      addComment(c) { const d = load(); d.comments['m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)] = c; save(d); return Promise.resolve(); },
      deleteComment(cid) { const d = load(); delete d.comments[cid]; save(d); return Promise.resolve(); },
      seedGroups(defaults) {
        const d = load(); let changed = false;
        defaults.forEach((g) => { if (!d.groups[g.id]) { d.groups[g.id] = strip(g); changed = true; } });
        if (changed) save(d);
        return Promise.resolve();
      },
    };
  }

  window.FB = { classId, deviceId, LS, backend: useMock ? mockBackend() : firebaseBackend() };
})();
