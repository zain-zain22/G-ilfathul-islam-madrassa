/* =========================================================
   മദ്രസ മാനേജർ – അഡ്മിൻ പാനൽ (app.js - ഭാഗം 1 / 2)
   പുതിയ Backend (Gmadrassa) & GitHub Repo-യ്ക്ക് അനുയോജ്യമായത്
   ========================================================= */

const $ = s => document.querySelector(s);
async function api(action, data) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...data })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'error');
  return j.data;
}

const MONTHS = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = iso(new Date());

// എല്ലാ സ്ഥലത്തും DD-MM-YYYY ഫോർമാറ്റിൽ തീയതി കാണിക്കാൻ
const fmtD = d => {
  if (!d) return '';
  const s = String(d).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};
const D = fmtD;

const f = (id, l, t = 'text', v = '') => `<label>${l}<input id="${id}" type="${t}" value="${v}"></label>`;
const val = id => $('#' + id).value.trim();
const opts = (arr, cur) => arr.map(c => `<option value="${c.id}" ${c.id == cur ? 'selected' : ''}>${c.name}</option>`).join('');
const cls = id => db.classes.find(c => c.id == id) || { name: '-' };
const stuIn = c => db.students.filter(s => s.classId == c && !s.left).sort((a, b) => a.no - b.no);
const esc = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const num = digits.length === 10 ? '91' + digits : digits;
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text || '');
}
function waBtn(phone, label, msg) {
  const href = waLink(phone, msg);
  if (!href) return '<span class="mu">ഫോൺ ഇല്ല</span>';
  return `<a class="wa-btn" target="_blank" rel="noopener" href="${href}">${esc(label || '💬 വാട്സ്ആപ്പ്')}</a>`;
}

function tabs(list) {
  return `<div class="tabs">` + list.map(([k, v]) => `<button class="${tab == k ? 'on' : ''}" onclick="tab='${k}';go()">${v}</button>`).join('') + `</div>`;
}
function pending(c) {
  const days = Object.keys(db.att).filter(k => k.startsWith(c + '|')).map(k => k.split('|')[1]).sort();
  if (!days.length) return [];
  const out = [];
  let d = new Date(days[days.length - 1] + 'T00:00');
  d.setDate(d.getDate() + 1);
  while (iso(d) < today) {
    if (d.getDay() != 0) out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function sgn(a) {
  if (!a) return '';
  if (a.holiday) return `<span class="sig-tilt">${esc(a.holiday)}</span>`;
  const t = db.teachers.find(x => x.id == a.by) || {};
  if (t.sig) return `<span class="sig-tilt"><img src="${t.sig}" alt=""></span>`;
  return `<span class="sig-tilt">${esc((t.name || '').slice(0, 6))}</span>`;
}

function makeSigPad(canvasId, initialData, onChange) {
  const c = $('#' + canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111111';
  if (initialData) {
    const im = new Image();
    im.onload = () => {
      ctx.drawImage(im, 0, 0, c.width, c.height);
      if (onChange) onChange(c.toDataURL('image/jpeg', 0.75));
    };
    im.src = initialData;
  }
  let dr = false;
  const pos = e => {
    const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)];
  };
  c.onpointerdown = e => {
    dr = true;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = e => {
    if (!dr) return;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  c.onpointerup = () => {
    if (!dr) return;
    dr = false;
    if (onChange) onChange(c.toDataURL('image/jpeg', 0.75));
  };
}

let sigData = '';
function initSig(d) { sigData = d || ''; makeSigPad('sgc', d, v => sigData = v); }
function clrSig() { sigData = ''; makeSigPad('sgc', '', v => sigData = v); }

let PIN = '', db = { madrasa: '', mno: '', next: 1, yearStart: '', vacationStart: '', sadarId: '', classes: [], teachers: [], students: [], apps: [], att: {} };
let tab = 'dash';
const sel = {
  cls: null, date: today,
  from: today.slice(0, 8) + '01',
  to: iso(new Date(+today.slice(0, 4), +today.slice(5, 7), 0)),
  all: true, tcCls: null, tcStu: null, appSig: {},
  stuQ: '', stuClsFilter: '', callCls: '', bonStu: null, trimBefore: ''
};
const st = t => { $('#sv').textContent = t; };
let saving = Promise.resolve();

function save() {
  const p = {
    pin: PIN,
    data: {
      settings: {
        madrasa: db.madrasa,
        mno: db.mno,
        next: db.next,
        yearStart: db.yearStart || '',
        vacationStart: db.vacationStart || '',
        sadarId: db.sadarId || ''
      },
      classes: db.classes,
      teachers: db.teachers,
      students: db.students
    }
  };
  st('സേവ് ചെയ്യുന്നു…');
  saving = saving.then(() => api('adminSave', p))
    .then(() => st('✓ Google Sheet-ൽ സേവ് ചെയ്തു'))
    .catch(e => {
      st('⚠ സേവ് പരാജയം');
      alert('Sheet-ലേക്ക് സേവ് ചെയ്യാനായില്ല: ' + e.message);
    });
}
function delApp(id) { api('delApp', { pin: PIN, id }).catch(e => alert(e.message)); }

async function login(p) {
  p = p || $('#pin').value.trim();
  if (!p) return;
  st('ലോഡ് ചെയ്യുന്നു…');
  try {
    Object.assign(db, await api('adminLoad', { pin: p }));
    PIN = p;
    sessionStorage.setItem('madrasa_pin', p);
  } catch (e) {
    sessionStorage.removeItem('madrasa_pin');
    st('');
    return alert(e.message);
  }
  if (!db.classes.length && !db.students.length && !db.teachers.length) {
    db.classes = [{ id: 'c1', name: 'ക്ലാസ് 1', sess: '1', teacher: '' }, { id: 'c2', name: 'ക്ലാസ് 2', sess: '2', teacher: '' }];
    save();
  }
  if (!db.classes.find(c => c.id == sel.cls)) sel.cls = db.classes[0]?.id;
  if (!db.classes.find(c => c.id == sel.tcCls)) sel.tcCls = db.classes[0]?.id;
  if (!sel.callCls) sel.callCls = db.classes[0]?.id || '';
  $('#gate').style.display = 'none';
  $('#app').style.display = '';
  if (db.madrasa) $('#ttl').textContent = db.madrasa + ' (Gemini Phase 2)';
  st('');
  go();
}
const reload = () => saving.then(() => login(PIN));
function logout() { sessionStorage.removeItem('madrasa_pin'); location.reload(); }
function go() { admin_(); }

async function clearAll() {
  if (prompt('Sheet-ലെ എല്ലാ ഡാറ്റയും മായ്ക്കും (മുമ്പ് Drive-ൽ ബാക്കപ്പ് എടുക്കും). തുടരാൻ CLEAR എന്ന് ടൈപ്പ് ചെയ്യുക') !== 'CLEAR') return;
  st('മായ്ക്കുന്നു…');
  try {
    const n = await api('clearAll', { pin: PIN, confirm: 'CLEAR' });
    alert('എല്ലാം മായ്ച്ചു. ബാക്കപ്പ് Drive-ൽ: ' + n);
    location.reload();
  } catch (e) {
    st('');
    alert('പരാജയം: ' + e.message);
  }
}
async function chPin() {
  const n = prompt('പുതിയ PIN (4–32 അക്ഷരം)');
  if (!n) return;
  try {
    await api('setPin', { pin: PIN, newPin: n });
    PIN = n;
    sessionStorage.setItem('madrasa_pin', n);
    alert('PIN മാറ്റി');
  } catch (e) { alert(e.message); }
}
async function driveBk() {
  st('Drive-ലേക്ക് ബാക്കപ്പ് എടുക്കുന്നു…');
  try {
    const n = await api('driveBackup', { pin: PIN });
    st('✓ ' + n);
    alert('Google Drive › Madrasa_Backups › Backups ഫോൾഡറിൽ സേവ് ചെയ്തു:\n' + n);
  } catch (e) {
    st('');
    alert(e.message);
  }
}

const rangeDays = (a, b) => {
  const o = [];
  if (!a || !b || b < a) return o;
  for (let d = new Date(a + 'T00:00'); iso(d) <= b && o.length < 400; d.setDate(d.getDate() + 1)) o.push(iso(d));
  return o;
};
const lbl = (a, b) => a.slice(0, 7) == b.slice(0, 7) ? MONTHS[+a.slice(5, 7) - 1] : fmtD(a) + ' – ' + fmtD(b);
const rng = fn => `<div class="g"><label>തുടക്കം<input type="date" value="${sel.from}" onchange="sel.from=this.value;${fn}()"></label><label>അവസാനം<input type="date" value="${sel.to}" onchange="sel.to=this.value;${fn}()"></label></div><p><button class="sm" onclick="mon(-1,'${fn}')">‹ മുൻ മാസം</button> <button class="sm" onclick="mon(0,'${fn}')">ഈ മാസം</button> <button class="sm" onclick="mon(1,'${fn}')">അടുത്ത മാസം ›</button></p>`;
function mon(d, fn) {
  const b = d ? new Date(sel.from + 'T00:00') : new Date(), a = new Date(b.getFullYear(), b.getMonth() + d, 1);
  sel.from = iso(a);
  sel.to = iso(new Date(a.getFullYear(), a.getMonth() + 1, 0));
  window[fn]();
}

const isPortraitVar = v => v == '_tc' || v == '_appf' || v == '_bon' || v == '_clslist';
const btns = (v, n) => `<p><button class="pri" onclick="pr(window.${v},'${isPortraitVar(v) ? 'portrait' : 'landscape'}')">🖨️ പ്രിൻ്റ്</button> <button onclick="pdf('${v}','${n}')">⬇ PDF ഡൗൺലോഡ്</button> <button onclick="pdf('${v}','${n}',1)">☁ Drive-ലേക്ക്</button></p>`;
const regList = () => db.students.filter(s => sel.all || (s.joined >= sel.from && s.joined <= sel.to));
const regF = () => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" ${sel.all ? 'checked' : ''} onchange="sel.all=this.checked;reg()"> എല്ലാ കുട്ടികളും (തീയതി ഫിൽട്ടർ ഇല്ലാതെ)</label>${sel.all ? '' : rng('reg')}`;

function pr(html, orient = 'landscape') {
  const p = $('#print');
  p.className = orient == 'portrait' ? 'p-portrait' : 'p-landscape';
  p.innerHTML = html;
  window.print();
}

async function pdf(v, name, up) {
  const html = window[v];
  if (!html) return alert('റിപ്പോർട്ട് ലോഡ് ആയിട്ടില്ല');
  const portrait = isPortraitVar(v);
  st('PDF തയ്യാറാക്കുന്നു…');
  const stage = $('#pdf_stage');
  stage.style.display = 'block';
  stage.innerHTML = `<div id="pdf_box" style="width:${portrait ? '720px' : '1080px'};margin:0 auto;background:#fff;color:#000;padding:8px;box-sizing:border-box">${html}</div>`;
  const box = $('#pdf_box');
  if (!portrait) {
    box.querySelectorAll('table.reg-tbl').forEach(t => {
      t.style.width = '100%';
      t.style.tableLayout = 'auto';
      t.style.fontSize = '8px';
    });
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const opt = {
      margin: 5,
      filename: name + '-' + fmtD(today) + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: portrait ? 'portrait' : 'landscape' },
      pagebreak: { mode: ['css', 'legacy'], after: '.tc-page-break' }
    };
    const w = html2pdf().set(opt).from(box);
    if (up) {
      const d = await w.outputPdf('datauristring');
      await api('uploadPdf', { pin: PIN, name: name + (portrait ? '-' + fmtD(today) : '-' + fmtD(sel.from) + '_' + fmtD(sel.to)) + '.pdf', b64: d.split(',')[1] });
      st('✓ Drive-ലേക്ക് അപ്‌ലോഡ് ചെയ്തു');
      alert('Drive › Madrasa_Backups › Reports ഫോൾഡറിൽ സേവ് ചെയ്തു');
    } else {
      await w.save();
      st('✓ PDF ഡൗൺലോഡ് ചെയ്തു');
    }
  } catch (e) {
    st('⚠ PDF പരാജയം');
    alert('PDF പരാജയം: ' + e.message);
  } finally {
    stage.style.display = 'none';
    stage.innerHTML = '';
  }
}

/* അഡ്മിൻ നാവിഗേഷൻ */
const clsOn = (s, d) => { const h = s.hist; if (!h || !h.length) return s.classId; let c = h[0].c; for (const e of h) if (e.from <= d) c = e.c; return c; };
const inC = (s, c, a, b) => clsOn(s, a) == c || clsOn(s, b) == c || (s.hist || []).some(e => e.c == c && e.from >= a && e.from <= b);
let sub = { st: 'apps', te: 'mreg' };

function admin_() {
  const T = [['dash', '🏠 ഡാഷ്ബോർഡ്'], ['st', '👦 വിദ്യാർത്ഥികൾ'], ['te', '👳 അധ്യാപകർ'], ['set', '⚙️ ക്രമീകരണം']];
  const S = {
    st: [
      ['apps', 'അപേക്ഷകൾ (' + db.apps.length + ')'],
      ['stu', 'കുട്ടികൾ'],
      ['tc', 'TC'],
      ['calls', 'വിളിക്കേണ്ട ലിസ്റ്റ്'],
      ['clsprint', 'ക്ലാസ് ലിസ്റ്റ്'],
      ['bonafide', 'പഠിക്കുന്നു സർട്ടിഫിക്കറ്റ്'],
      ['reg', 'അഡ്മിഷൻ രജിസ്റ്റർ'],
      ['attp', 'അറ്റൻഡൻസ് രജിസ്റ്റർ'],
      ['promo', 'പ്രൊമോഷൻ']
    ],
    te: [['mreg', 'മുഅല്ലിം രജിസ്റ്റർ'], ['sig', 'സിഗ്നേച്ചർ രജിസ്റ്റർ']]
  };
  $('#app').innerHTML = '<p><button class="sm" onclick="reload()">🔄 പുതുക്കുക</button> <button class="sm" onclick="logout()">🔒 പുറത്തുകടക്കുക</button></p>' + tabs(T) + (S[tab] ? '<div class="tabs">' + S[tab].map(([k, v]) => `<button class="sm ${sub[tab] == k ? 'on' : ''}" onclick="sub['${tab}']='${k}';go()">${v}</button>`).join('') + '</div>' : '') + '<div id="pg"></div>';
  ({ dash, apps, stu, tc: tcTab, calls: callsTab, clsprint: clsPrintTab, bonafide: bonafideTab, reg, attp, promo, mreg, sig, set })[S[tab] ? sub[tab] : tab]();
}

function dash() {
  const t = today, pend = db.classes.map(c => ({ c, p: pending(c.id) })).filter(x => x.p.length);
  const lng = [];
  db.classes.forEach(c => {
    const ks = Object.keys(db.att).filter(k => k.startsWith(c.id + '|') && !db.att[k].holiday).map(k => k.split('|')[1]).sort().slice(-10);
    if (ks.length < 10) return;
    stuIn(c.id).forEach(s => { if (s.joined <= ks[0] && ks.every(d => db.att[c.id + '|' + d].absent.includes(s.no))) lng.push(s.no + '. ' + s.name + ' (' + c.name + ')'); });
  });
  const lngH = lng.length ? '<h2>10 പ്രവൃത്തി ദിവസമായി വരാത്തവർ</h2><div class="card">' + lng.map(x => '<div class="row">' + x + '</div>').join('') + '<p class="mu">വിടുതൽ ചെയ്യേണ്ടതുണ്ടോ എന്ന് നോക്കുക (കുട്ടികൾ ടാബ്).</p></div>' : '';
  const rows = db.classes.map(c => { const a = db.att[c.id + '|' + t], n = stuIn(c.id).length; return `<div class="row"><span>${esc(c.name)} · ${cls(c.id).sess == '1' ? 'സെക്ഷൻ 1' : 'സെക്ഷൻ 2'}</span><span>${a ? a.holiday ? 'അവധി: ' + esc(a.holiday) : (n - a.absent.length) + ' / ' + n + ' ഹാജർ' : '<i class="mu">ഇന്ന് ബാക്കി</i>'}</span></div>`; }).join('');
  $('#pg').innerHTML = `<div class="stat"><div><b>${db.students.filter(s => !s.left).length}</b>ആകെ കുട്ടികൾ</div><div><b>${db.apps.length}</b>പുതിയ അപേക്ഷ</div><div><b>${pend.length}</b>ഹാജർ ബാക്കിയുള്ള ക്ലാസ്</div></div><h2>ഇന്ന് (${fmtD(t)})</h2><div class="card">${rows || 'ക്ലാസുകളില്ല'}</div>${lngH}${pend.map(x => `<p class="warn">${esc(x.c.name)}: ${x.p.length} ദിവസം ബാക്കി</p>`).join('')}`;
}

function apps() {
  $('#pg').innerHTML = db.apps.length ? db.apps.map(a => {
    const sadar = (db.teachers || []).find(t => t.id == db.sadarId) || {};
    const waMsg = `അസ്സലാമു അലൈക്കും. ${db.madrasa || 'മദ്രസ'}-ലേക്ക് ${a.name} എന്ന കുട്ടിയുടെ പ്രവേശന അപേക്ഷ (${a.refNo || ''}) ലഭിച്ചിട്ടുണ്ട്.`;
    return `<div class="card">
      <b>${esc(a.name)}</b> (${esc(a.gender || '')}) · ജനന തീയതി: ${esc(fmtD(a.dob))} ${a.refNo ? '· <span class="mu">Ref: ' + esc(a.refNo) + '</span>' : ''}
      <div class="mu">${esc(a.guardian || '')} · ${esc(a.phone || '')} · ${esc(cls(a.classId).name)} · അപേക്ഷ: ${esc(fmtD(a.date))}</div>
      ${a.sig ? `<div style="margin-top:8px"><span class="mu">രക്ഷിതാവിന്റെ ഒപ്പ്:</span><br><img src="${a.sig}" style="height:50px;border:1px solid var(--bd);background:#fff;border-radius:8px;padding:2px"></div>` : '<div class="warn">രക്ഷിതാവിന്റെ ഒപ്പ് ലഭ്യമല്ല</div>'}
      <label>ചേർന്ന തീയതി<input type="date" id="j${a.id}" value="${a.date || today}"></label>
      <label>ക്ലാസ്<select id="k${a.id}">${opts(db.classes, a.classId)}</select></label>
      <label>പ്രവേശന നമ്പർ<input type="number" id="n${a.id}" value="${db.next}"></label>
      <label>സദർ മുഅല്ലിമിന്റെ ഒപ്പ് (${esc(sadar.name || 'സദർ തിരഞ്ഞെടുത്തിട്ടില്ല')} – ആവശ്യമെങ്കിൽ താഴെ വരയ്ക്കാം)</label>
      <canvas id="asig_${a.id}" width="360" height="100" style="width:100%;max-width:360px;border:1px solid var(--bd);border-radius:10px;background:#fff;touch-action:none"></canvas>
      <div><button type="button" class="sm" onclick="sel.appSig[${a.id}]='';apps()">സദർ ഒപ്പ് മായ്ക്കുക</button></div>
      <p>
        <button class="pri sm" onclick="approve(${a.id})">അംഗീകരിക്കുക</button>
        <button class="sm" onclick="previewApp(${a.id})">🖨️ പ്രിന്റ് / PDF (Portrait)</button>
        ${waBtn(a.phone, '💬 വാട്സ്ആപ്പ്', waMsg)}
        <button class="sm" onclick="rej(${a.id})">നിരസിക്കുക</button>
      </p>
    </div>`;
  }).join('') : '<p class="mu">പുതിയ അപേക്ഷകളില്ല.</p>';

  db.apps.forEach(a => {
    const sadar = (db.teachers || []).find(t => t.id == db.sadarId) || {};
    const initS = sel.appSig[a.id] != null ? sel.appSig[a.id] : (sadar.sig || '');
    makeSigPad('asig_' + a.id, initS, v => { sel.appSig[a.id] = v; });
  });
}

function buildAppPrintHtml(a, sadarSig) {
  const sadar = (db.teachers || []).find(t => t.id == db.sadarId) || {};
  return `<div style="font-family:'Noto Sans Malayalam',sans-serif;color:#000;line-height:1.5;font-size:13px">
    <h2 style="text-align:center;margin:0 0 4px">${esc(db.madrasa || 'മദ്രസ')}</h2>
    <div style="text-align:center;margin-bottom:10px"><b>പ്രവേശന അപേക്ഷാ ഫോം</b> ${a.refNo ? '<br><span style="font-size:12px">റഫറൻസ് നമ്പർ: <b>' + esc(a.refNo) + '</b></span>' : ''}</div>
    <table class="reg-tbl" style="width:100%;font-size:12px">
      <tr><td style="width:36%;text-align:left"><b>അപേക്ഷാ തീയതി</b></td><td style="text-align:left">${esc(fmtD(a.date || ''))}</td></tr>
      <tr><td style="text-align:left"><b>കുട്ടിയുടെ പേരും ഇനീഷ്യലും</b></td><td style="text-align:left">${esc(a.name)}</td></tr>
      <tr><td style="text-align:left"><b>ആൺ / പെൺ</b></td><td style="text-align:left">${esc(a.gender || '')}</td></tr>
      <tr><td style="text-align:left"><b>വീട്ടുപേര്</b></td><td style="text-align:left">${esc(a.house || '')}</td></tr>
      <tr><td style="text-align:left"><b>പിതാവിന്റെ/മാതാവിന്റെ പേര്, വീട്ടുപേര്</b></td><td style="text-align:left">${esc(a.parent || '')}</td></tr>
      <tr><td style="text-align:left"><b>രക്ഷിതാവിന്റെ പേര്, വീട്ടുപേര്</b></td><td style="text-align:left">${esc(a.guardian || '')}</td></tr>
      <tr><td style="text-align:left"><b>ഫോൺ നമ്പർ</b></td><td style="text-align:left">${esc(a.phone || '')}</td></tr>
      <tr><td style="text-align:left"><b>രക്ഷിതാവുമായുള്ള ബന്ധം</b></td><td style="text-align:left">${esc(a.rel || '')}</td></tr>
      <tr><td style="text-align:left"><b>രക്ഷിതാവിന്റെ ജോലി, മേൽവിലാസം</b></td><td style="text-align:left">${esc(a.job || '')}</td></tr>
      <tr><td style="text-align:left"><b>ജനന തീയതി</b></td><td style="text-align:left">${esc(fmtD(a.dob || ''))}</td></tr>
      <tr><td style="text-align:left"><b>ക്ലാസ്</b></td><td style="text-align:left">${esc(cls(a.classId).name)}</td></tr>
      <tr><td style="text-align:left"><b>തിരിച്ചറിയാനുള്ള അടയാളങ്ങൾ</b></td><td style="text-align:left">${esc(a.mark || '')}</td></tr>
      <tr><td style="text-align:left"><b>മുമ്പ് പഠിച്ച മദ്രസ, TC നമ്പർ, തീയതി</b></td><td style="text-align:left">${esc(a.prev || '')}</td></tr>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px">
      <div>രക്ഷിതാവിന്റെ ഒപ്പ്:<br>${a.sig ? '<img src="' + a.sig + '" style="height:50px;max-width:170px;border:1px solid #ccc">' : '........................'}</div>
      <div style="text-align:right">സദർ മുഅല്ലിം (${esc(sadar.name || '')}):<br>${sadarSig ? '<img src="' + sadarSig + '" style="height:50px;max-width:170px;border:1px solid #ccc">' : '........................'}</div>
    </div>
  </div>`;
}

function previewApp(id) {
  const a = db.apps.find(x => x.id == id);
  if (!a) return;
  const sadar = (db.teachers || []).find(t => t.id == db.sadarId) || {};
  const sSig = sel.appSig[id] != null ? sel.appSig[id] : (sadar.sig || '');
  window._appf = buildAppPrintHtml(a, sSig);
  $('#pg').innerHTML = `<p><button class="sm" onclick="apps()">‹ അപേക്ഷകളിലേക്ക്</button></p>${btns('_appf', 'application-' + id)}<div class="card">${window._appf}</div>`;
}

function approve(id) {
  if (!db.classes.length) return alert('ആദ്യം ക്ലാസ് ഉണ്ടാക്കുക');
  const a = db.apps.find(x => x.id == id), no = +$('#n' + id).value;
  if (db.students.some(s => s.no == no)) return alert('ഈ പ്രവേശന നമ്പർ ഉപയോഗത്തിലുണ്ട്');
  const sadar = (db.teachers || []).find(t => t.id == db.sadarId) || {};
  const sSig = sel.appSig[id] != null ? sel.appSig[id] : (sadar.sig || '');
  db.students.push({
    ...a,
    no,
    joined: $('#j' + id).value,
    classId: $('#k' + id).value,
    guardianSig: a.sig || '',
    sadarSig: sSig || ''
  });
  delete sel.appSig[id];
  db.next = Math.max(db.next, no + 1);
  db.apps = db.apps.filter(x => x.id != id);
  delApp(id); save(); admin_();
}
function rej(id) { if (confirm('നിരസിക്കട്ടെ?')) { db.apps = db.apps.filter(x => x.id != id); delApp(id); save(); admin_(); } }

/* കുട്ടികൾ + സെർച്ച് + വാട്സ്ആപ്പ് */
function stu() {
  const q = (sel.stuQ || '').toLowerCase().trim();
  const cFilt = sel.stuClsFilter || '';
  const filtered = db.students
    .filter(s => {
      if (cFilt && String(s.classId) !== String(cFilt)) return false;
      if (!q) return true;
      const hay = [s.no, s.name, s.house, s.guardian, s.parent, s.phone, cls(s.classId).name].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a.no - b.no);

  $('#pg').innerHTML = `<div class="card"><b>കുട്ടിയെ ചേർക്കുക (പഴയ കുട്ടികൾക്കും)</b><div class="g">${f('s_no', 'പ്രവേശന നമ്പർ', 'number', db.next)}${f('s_j', 'ചേർന്ന തീയതി', 'date', today)}</div>${f('s_name', 'പേരും ഇനീഷ്യലും')}<div class="g">${f('s_house', 'വീട്ടുപേര്')}${f('s_dob', 'ജനന തീയതി', 'date')}</div>${f('s_p', 'പിതാവ്/മാതാവ്')}${f('s_gu', 'രക്ഷിതാവ്')}<div class="g">${f('s_ph', 'ഫോൺ', 'tel')}${f('s_rel', 'ബന്ധം')}</div>${f('s_job', 'ജോലി, മേൽവിലാസം')}${f('s_mark', 'തിരിച്ചറിയാനുള്ള അടയാളം')}${f('s_prev', 'മുമ്പ് പഠിച്ച മദ്രസ, TC നമ്പർ, തീയതി')}${f('s_pn', 'മുൻ നമ്പർ')}${db.classes.length ? '' : '<p class="warn">ആദ്യം ക്രമീകരണത്തിൽ ക്ലാസ് ഉണ്ടാക്കുക.</p>'}<label>ക്ലാസ്<select id="s_cls">${opts(db.classes)}</select></label><p><button class="pri" onclick="addStu()">ചേർക്കുക</button></p></div>
<h2>ലിസ്റ്റ് (${filtered.length} / ${db.students.length})</h2>
<div class="card">
  <div class="g">
    <label>തിരയുക (പേര്, നമ്പർ, ഫോൺ, വീട്ടുപേര്)<input id="stu_search" type="search" value="${esc(sel.stuQ)}" placeholder="പേരോ നമ്പറോ ടൈപ്പ് ചെയ്യുക…" oninput="sel.stuQ=this.value;stu()"></label>
    <label>ക്ലാസ് ഫിൽട്ടർ<select onchange="sel.stuClsFilter=this.value;stu()"><option value="">എല്ലാ ക്ലാസുകളും</option>${opts(db.classes, cFilt)}</select></label>
  </div>
  ${filtered.map(s => {
    const msg = `അസ്സലാമു അലൈക്കും. ${db.madrasa || 'മദ്രസ'}-ൽ നിന്ന് (${cls(s.classId).name}) ${s.name} എന്ന കുട്ടിയുടെ രക്ഷിതാവിനുള്ള അറിയിപ്പ്: `;
    return `<div class="row" style="${s.left ? 'opacity:.65' : ''}">
      <div>
        <b>${s.no}</b> <span>${esc(s.name)}</span>
        <div class="mu">${esc(cls(s.classId).name)} · ${esc(s.guardian || s.parent || '')} · ${esc(s.phone || 'ഫോൺ ഇല്ല')}${s.left ? ' · <span class="warn">' + (s.left.how || 'വിട്ടു') + ' ' + esc(fmtD(s.left.date)) + '</span>' : ''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${waBtn(s.phone, '💬 WA', msg)}
        ${s.left ? `<button class="sm" onclick="readmit(${s.no})">↩ തിരികെ ചേർക്കുക</button> <button class="sm" onclick="openTcForStu(${s.no})">📄 TC</button>` : `<button class="sm" onclick="leave(${s.no})">വിടുതൽ</button>`}
      </div>
    </div>`;
  }).join('') || '<p class="mu">കുട്ടികളില്ല.</p>'}
</div>`;
}
function addStu() {
  if (!db.classes.length) return alert('ആദ്യം ക്രമീകരണത്തിൽ ക്ലാസ് ഉണ്ടാക്കുക');
  const no = +val('s_no');
  if (!val('s_name') || !no) return alert('പേരും നമ്പറും വേണം');
  if (db.students.some(s => s.no == no)) return alert('നമ്പർ ഉപയോഗത്തിലുണ്ട്');
  db.students.push({ no, joined: val('s_j'), name: val('s_name'), house: val('s_house'), dob: val('s_dob'), parent: val('s_p'), prev: val('s_prev'), prevNo: val('s_pn'), guardian: val('s_gu'), phone: val('s_ph'), rel: val('s_rel'), job: val('s_job'), mark: val('s_mark'), classId: $('#s_cls').value });
  db.next = Math.max(db.next, no + 1);
  save(); stu();
}
function leave(no) {
  const s = db.students.find(x => x.no == no);
  if (!s) return;
  const h = (prompt('വിടുതൽ രീതി (നമ്പർ നൽകുക):\n1 = TC വാങ്ങി പോയി\n2 = TC വാങ്ങാതെ നിർത്തി\n3 = പഠനം പൂർത്തിയാക്കി') || '').trim();
  if (!h) return;
  const how = { 1: 'TC വാങ്ങി', 2: 'TC വാങ്ങാതെ നിർത്തി', 3: 'പഠനം പൂർത്തിയാക്കി' }[h];
  if (!how) return alert('1, 2, 3 എന്നിവയിൽ ഒന്ന് നൽകുക');
  const d = prompt('വിട്ട തീയതി (YYYY-MM-DD). TC ഇല്ലാതെ നിർത്തിയവർക്ക് അവസാനം ഹാജരായ തീയതി നൽകാം', today);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return alert('തീയതി ശരിയല്ല');
  const r = prompt('കാരണം (ഇല്ലെങ്കിൽ ഒഴിവാക്കുക)') || '';
  let tcNo = '', toMad = '';
  if (h == '1') {
    tcNo = prompt('TC നമ്പർ') || '';
    toMad = prompt('ചേരുന്ന മദ്രസ (ഇല്ലെങ്കിൽ ഒഴിവാക്കുക)') || '';
  }
  s.left = { date: d, cls: cls(s.classId).name, reason: r, how, tc: tcNo, to: toMad };
  save();
  if (h == '1') openTcForStu(no); else stu();
}

/* ---------- ഘട്ടം 2: വരാത്തവരെ വിളിക്കാനുള്ള ലിസ്റ്റ് ---------- */
function callsTab() {
  const cId = sel.callCls || db.classes[0]?.id || '';
  const attDates = Object.keys(db.att)
    .filter(k => k.startsWith(cId + '|') && !db.att[k].holiday)
    .map(k => k.split('|')[1])
    .sort();
  const last5 = attDates.slice(-5);
  const last10 = attDates.slice(-10);

  const list = stuIn(cId).map(s => {
    const abLast = last5.filter(d => db.att[cId + '|' + d] && (db.att[cId + '|' + d].absent || []).includes(s.no)).length;
    const ab10 = last10.length === 10 && s.joined <= last10[0] && last10.every(d => (db.att[cId + '|' + d].absent || []).includes(s.no));
    const latestRec = attDates.length ? db.att[cId + '|' + attDates[attDates.length - 1]] : null;
    const absLatest = latestRec && (latestRec.absent || []).includes(s.no);
    return { s, abLast, ab10, absLatest };
  }).filter(x => x.abLast > 0 || x.ab10 || x.absLatest);

  $('#pg').innerHTML = `<div class="card"><b>വരാത്തവരെ വിളിക്കാനുള്ള ലിസ്റ്റ്</b>
    <label>ക്ലാസ്<select onchange="sel.callCls=this.value;callsTab()">${opts(db.classes, cId)}</select></label>
    <p class="mu">അവസാന ഹാജർ ദിവസങ്ങളിൽ ഹാജരില്ലാത്തവരെയും തുടർച്ചയായി വരാത്തവരെയും ഇവിടെ കാണാം.</p>
    ${list.length ? list.map(({ s, abLast, ab10, absLatest }) => {
      const msg = `അസ്സലാമു അലൈക്കും. ${db.madrasa || 'മദ്രസ'}-ൽ നിന്ന് (${cls(cId).name}) ${s.name} എന്ന കുട്ടി മദ്രസയിൽ വരാത്തത് ശ്രദ്ധയിൽപ്പെട്ടതിനാലാണ് വിളിക്കുന്നത്.`;
      return `<div class="row ${ab10 ? 'ab' : ''}">
        <div>
          <b>${s.no}</b> <span>${esc(s.name)}</span>
          <div class="mu">രക്ഷിതാവ്: ${esc(s.guardian || s.parent || '-')} · ഫോൺ: <b>${esc(s.phone || 'ഇല്ല')}</b></div>
          <div class="${ab10 ? 'warn' : 'mu'}">${ab10 ? '⚠ തുടർച്ചയായി 10 പ്രവൃത്തി ദിവസം വന്നിട്ടില്ല' : ''}${absLatest ? ' (അവസാന ദിവസം ഹാജരില്ല)' : ''} · സമീപ ദിവസങ്ങളിൽ ${abLast} ദിവസം ഹാജരില്ല</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${s.phone ? `<a class="sm" style="text-decoration:none;border:1px solid var(--bd);padding:6px 10px;border-radius:10px" href="tel:${esc(s.phone)}">📞 വിളിക്കുക</a>` : ''}
          ${waBtn(s.phone, '💬 വാട്സ്ആപ്പ്', msg)}
        </div>
      </div>`;
    }).join('') : '<p class="mu">ഈ ക്ലാസിൽ അടുത്തിടെ ഹാജരില്ലാത്ത കുട്ടികളൊന്നുമില്ല.</p>'}
  </div>`;
}

/* ---------- ഘട്ടം 2: ക്ലാസ് ലിസ്റ്റ് പ്രിന്റ് / PDF ---------- */
function clsPrintTab() {
  const cId = sel.cls || db.classes[0]?.id || '';
  const list = stuIn(cId);
  const cObj = cls(cId);
  const html = `<div style="font-family:'Noto Sans Malayalam',sans-serif;color:#000">
    <div style="text-align:center;margin-bottom:8px">
      <b style="font-size:15px">ISLAMIC EDUCATIONAL BOARD</b><br>
      <b>സമസ്ത കേരള സുന്നി വിദ്യാഭ്യാസ ബോർഡ്</b><br>
      <b>ക്ലാസ് വിദ്യാർത്ഥി ലിസ്റ്റ് (CLASS STUDENT LIST)</b><br>
      <span style="font-size:12px">${esc(db.madrasa || '')} ${db.mno ? '(' + esc(db.mno) + ')' : ''} · ക്ലാസ്: <b>${esc(cObj.name)}</b> · തീയതി: ${esc(fmtD(today))}</span>
    </div>
    <table class="reg-tbl" style="width:100%;font-size:11px">
      <thead><tr><th class="sn">ക്രമ നമ്പർ</th><th style="width:12%">പ്രവേശന നമ്പർ</th><th style="width:26%">പേര്</th><th style="width:20%">വീട്ടുപേര്</th><th style="width:20%">രക്ഷിതാവ്</th><th style="width:16%">ഫോൺ</th></tr></thead>
      <tbody>${list.map((s, idx) => `<tr><td class="sn">${idx + 1}</td><td>${s.no}</td><td style="text-align:left">${esc(s.name)}</td><td style="text-align:left">${esc(s.house || '')}</td><td style="text-align:left">${esc(s.guardian || s.parent || '')}</td><td>${esc(s.phone || '')}</td></tr>`).join('') || '<tr><td colspan="6">കുട്ടികളില്ല</td></tr>'}</tbody>
    </table>
    <p style="font-size:11px;margin-top:12px">ആകെ കുട്ടികൾ: <b>${list.length}</b> &nbsp;&nbsp;|&nbsp;&nbsp; ക്ലാസ് മുഅല്ലിം: ................ &nbsp;&nbsp;|&nbsp;&nbsp; സദർ മുഅല്ലിം: ................</p>
  </div>`;
  window._clslist = html;
  $('#pg').innerHTML = `<div class="card"><b>ക്ലാസ് ലിസ്റ്റ് പ്രിന്റ് / PDF</b>
    <label>ക്ലാസ് തിരഞ്ഞെടുക്കുക<select onchange="sel.cls=this.value;clsPrintTab()">${opts(db.classes, cId)}</select></label>
    ${btns('_clslist', 'class-list-' + (cObj.name || 'class'))}
    <div class="scroll card">${html}</div>
  </div>`;
}

/* ---------- ഘട്ടം 2: പഠിക്കുന്നു എന്ന സർട്ടിഫിക്കറ്റ് (Bonafide) ---------- */
function bonafideTab() {
  const active = db.students.filter(s => !s.left).sort((a, b) => a.no - b.no);
  const curId = sel.bonStu || active[0]?.no || '';
  const s = active.find(x => x.no == curId) || active[0];
  if (!s) { $('#pg').innerHTML = '<p class="mu">നിലവിൽ പഠിക്കുന്ന കുട്ടികളില്ല.</p>'; return; }
  sel.bonStu = s.no;
  const sadar = (db.teachers || []).find(t => t.id == db.sadarId) || {};
  const html = `<div style="font-family:'Noto Sans Malayalam',sans-serif;color:#000;line-height:1.7;padding:12px;border:2px solid #222;border-radius:8px">
    <div style="text-align:center;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:14px">
      <div style="font-size:16px;font-weight:700">ISLAMIC EDUCATIONAL BOARD</div>
      <div style="font-size:13px;font-weight:600">സമസ്ത കേരള സുന്നി വിദ്യാഭ്യാസ ബോർഡ്</div>
      <div style="font-size:17px;font-weight:700;margin-top:4px">${esc(db.madrasa || 'മദ്രസ')}</div>
      <div style="font-size:12px">${db.mno ? 'രജിസ്റ്റർ / അംഗീകാര നമ്പർ: ' + esc(db.mno) : ''}</div>
    </div>
    <div style="text-align:center;font-size:15px;font-weight:700;text-decoration:underline;margin-bottom:14px">പഠന സാക്ഷ്യപത്രം (STUDY / BONAFIDE CERTIFICATE)</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px">
      <span>പ്രവേശന നമ്പർ: <b>${esc(s.no)}</b></span>
      <span>തീയതി: <b>${esc(fmtD(today))}</b></span>
    </div>
    <p style="font-size:13px;text-align:justify">
      <b>${esc(s.name)}</b> (വീട്ടുപേര്: <b>${esc(s.house || '-')}</b>, രക്ഷിതാവ്: <b>${esc(s.guardian || s.parent || '-')}</b>, ജനന തീയതി: <b>${esc(fmtD(s.dob) || '-')}</b>) എന്ന കുട്ടി <b>${esc(fmtD(s.joined) || '-')}</b> മുതൽ ഈ മദ്രസയിൽ ചേർന്ന് നിലവിൽ <b>${esc(cls(s.classId).name)}</b> ക്ലാസിൽ പഠിച്ചുവരുന്നുണ്ടെന്ന് ഇതിനാൽ സാക്ഷ്യപ്പെടുത്തുന്നു.
    </p>
    <p style="font-size:12px;color:#333">കുട്ടിയുടെ സ്വഭാവം തൃപ്തികരമാണ്.</p>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:36px;font-size:12px">
      <div>മദ്രസ സീൽ (Seal)</div>
      <div style="text-align:right">
        ${sadar.sig ? `<img src="${sadar.sig}" style="height:44px;display:block;margin-left:auto"><br>` : '<br><br>'}
        <b>${esc(sadar.name || 'സദർ മുഅല്ലിം')}</b><br>സദർ മുഅല്ലിം
      </div>
    </div>
  </div>`;
  window._bon = html;
  $('#pg').innerHTML = `<div class="card"><b>പഠിക്കുന്നു എന്ന സർട്ടിഫിക്കറ്റ് (Bonafide)</b>
    <label>കുട്ടിയെ തിരഞ്ഞെടുക്കുക<select onchange="sel.bonStu=+this.value;bonafideTab()">${active.map(x => `<option value="${x.no}" ${x.no == s.no ? 'selected' : ''}>${x.no}. ${esc(x.name)} (${esc(cls(x.classId).name)})</option>`).join('')}</select></label>
    ${btns('_bon', 'bonafide-' + s.no)}
    <div class="card">${html}</div>
  </div>`;
}

/* പ്രിൻ്റ് & രജിസ്റ്ററുകൾ */
function reg() {
  const H = ['ക്രമ നമ്പർ', 'പ്രവേശന നമ്പർ', 'പേര്, ഇനീഷ്യൽ', 'വീട്ടുപേര്', 'പിതാവ്/മാതാവ്', 'രക്ഷിതാവ്, ഫോൺ', 'ബന്ധം', 'ജോലി, മേൽവിലാസം', 'ജനന തീയതി', 'ചേർന്ന ക്ലാസ്', 'ചേർന്ന തീയതി', 'അടയാളം', 'മുമ്പ് പഠിച്ച മദ്രസ/TC', 'മുൻ നമ്പർ', 'വിട്ട ക്ലാസ്', 'വിട്ട തീയതി', 'വിടാനുള്ള കാരണം', 'ചേരുന്ന മദ്രസ', 'കൊടുത്ത TC', 'സദറിൻ്റെ ഒപ്പ്', 'റിമാർക്സ്'];
  const L = regList().sort((a, b) => a.no - b.no);
  const rows = L.map((s, idx) => {
    const sSigCell = s.sadarSig ? `<span class="sig-tilt"><img src="${s.sadarSig}" alt=""></span>` : '';
    return [idx + 1, s.no, s.name, s.house, s.parent || '', (s.guardian || '') + ' ' + (s.phone || ''), s.rel, s.job, fmtD(s.dob), cls((s.hist && s.hist[0] || { c: s.classId }).c).name, fmtD(s.joined), s.mark, s.prev || '', s.prevNo || '', s.left?.cls || '', fmtD(s.left?.date || ''), s.left?.reason || '', s.left?.to || '', s.left?.tc || '', sSigCell, s.left ? (s.left.how || 'വിടുതൽ ചെയ്തു') : ''];
  });
  const numRow = `<tr>${H.map((_, i) => `<th class="${i === 0 ? 'sn' : ''}" style="background:#f5f7f6">${i + 1}</th>`).join('')}</tr>`;
  const titleRow = `<tr>${H.map((h, i) => `<th class="${i === 0 ? 'sn' : (i === 7 ? 'wrap-col' : '')}">${h}</th>`).join('')}</tr>`;
  const thead = `<thead>${numRow}${titleRow}</thead>`;
  const tbl = `<div style="text-align:center;margin-bottom:6px"><b style="font-size:14px">ISLAMIC EDUCATIONAL BOARD</b><br><b>സമസ്ത കേരള സുന്നി വിദ്യാഭ്യാസ ബോർഡ്</b><br><b>വിദ്യാർത്ഥി പ്രവേശന രജിസ്റ്റർ (ADMISSION REGISTER)</b> ${db.madrasa ? '– ' + esc(db.madrasa) : ''}</div><table class="reg-tbl" style="width:100%">${thead}<tbody>${rows.map((r, ri) => `<tr style="${L[ri].left ? 'opacity:.65;background:#f4f4f4' : ''}">${r.map((c, ci) => `<td class="${ci === 0 ? 'sn' : (ci === 7 ? 'wrap-col' : '')}">${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  window._reg = tbl;
  $('#pg').innerHTML = `<p class="mu">തുടക്കത്തിൽ ക്രമ നമ്പറും ഏറ്റവും മുകളിൽ കള്ളി നമ്പറുകളും നൽകിയിട്ടുണ്ട്. ഏത് കള്ളിയിലും എഴുത്ത് താഴോട്ട് വലുപ്പം കൂടും; അടുത്ത കള്ളിയിലേക്ക് കയറില്ല.</p>${regF()}${btns('_reg', 'admission-register')}<div class="scroll card">${tbl}</div>`;
}

function attp() {
  const c = sel.cls, ms = sel.from, me = sel.to, days = rangeDays(ms, me), n = days.length, y = ms.slice(0, 4);
  if (!n || n > 31 || !c) { $('#pg').innerHTML = rng('attp') + '<p class="warn">1–31 ദിവസത്തെ തീയതി പരിധി തിരഞ്ഞെടുക്കുക.</p>'; return; }
  const sun = d => new Date(d + 'T00:00').getDay() == 0, rec = d => db.att[c + '|' + d];
  const stList = db.students.filter(s => inC(s, c, ms, me) && s.joined <= me && (!s.left || s.left.date >= ms)).sort((a, b) => a.no - b.no);
  const yrStartBound = db.yearStart || (y + '-01-01');
  const keys = Object.keys(db.att).filter(k => k.startsWith(c + '|')).map(k => k.split('|')[1]).filter(d => d >= yrStartBound && d <= me && !db.att[c + '|' + d].holiday);
  const wM = keys.filter(d => d >= ms && d <= me).length, wP = keys.filter(d => d < ms).length, wT = wM + wP;
  const pres = (s, fn) => keys.filter(d => fn(d) && s.joined <= d && clsOn(s, d) == c && !db.att[c + '|' + d].absent.includes(s.no)).length;
  const pm = stList.map(s => pres(s, d => d >= ms && d <= me)), pp = stList.map(s => pres(s, d => d < ms)), sum = a => a.reduce((x, y) => x + y, 0), PM = sum(pm), PP = sum(pp), PT = PM + PP;
  const avg = (p, w) => w ? (p / w).toFixed(1) : '-';
  const op = db.students.filter(s => clsOn(s, ms) == c && s.joined < ms && (!s.left || s.left.date >= ms)).length, nw = db.students.filter(s => clsOn(s, me) == c && s.joined >= ms && s.joined <= me).length, lf = db.students.filter(s => s.classId == c && s.left && s.left.date >= ms && s.left.date <= me).length;
  const N = n + 7;
  const body = stList.map((s, i) => `<tr><td class="sn">${i + 1}</td><td>${s.no}</td><td style="text-align:left;min-width:75px">${esc(s.name)}</td>${days.map(d => { const a = rec(d); return `<td style="${sun(d) || a?.holiday ? 'background:#ddd' : ''}">${sun(d) || !a || a.holiday || s.joined > d || clsOn(s, d) != c ? '' : a.absent.includes(s.no) ? 'A' : '×'}</td>`; }).join('')}<td>${pm[i]}</td><td>${pp[i]}</td><td>${pm[i] + pp[i]}</td><td></td></tr>`).join('');
  const tot = days.map(d => { const a = rec(d); return `<td>${a && !a.holiday ? stList.filter(s => s.joined <= d && clsOn(s, d) == c).length - a.absent.length : ''}</td>`; }).join('');
  const sg = days.map(d => { const a = rec(d); return `<td class="sig-cell">${sgn(a)}</td>`; }).join('');
  const tbl = `<table class="reg-tbl" style="width:100%"><thead><tr><td colspan="${N}" style="text-align:center;border:none"><b style="font-size:15px">ISLAMIC EDUCATIONAL BOARD</b><br>സമസ്ത കേരള സുന്നി വിദ്യാഭ്യാസ ബോർഡ്<br><b>സ്റ്റുഡൻ്റ്സ് അറ്റൻഡൻസ് രജിസ്റ്റർ (STUDENTS ATTENDANCE REGISTER)</b><div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:6px"><span>മദ്രസ: ${esc(db.madrasa || '.........')}</span><span>നമ്പർ: ${esc(db.mno || '.........')}</span><span>ക്ലാസ്: ${esc(cls(c).name)}</span><span>${cls(c).sess == '1' ? 'സെക്ഷൻ 1' : 'സെക്ഷൻ 2'}</span><span>മാസം: ${lbl(ms, me)}</span><span>വർഷം: ${y}</span></div></td></tr><tr><th class="sn">ക്രമ നമ്പർ</th><th>പ്രവേശന നമ്പർ</th><th>പേര്</th>${days.map(d => `<th>${+d.slice(8)}</th>`).join('')}<th>ഈ മാസം</th><th>മുൻ മാസം</th><th>ആകെ</th><th>റിമാർക്സ്</th></tr></thead><tbody>${body}<tr><td colspan="3">ആകെ ഹാജർ</td>${tot}<td>${wM}</td><td>${wP}</td><td>${wT}</td><td style="font-size:8px">പ്രവൃത്തി ദിവസം</td></tr><tr><td colspan="3">മുഅല്ലിമിൻ്റെ ഒപ്പ്</td>${sg}<td>${avg(PM, wM)}</td><td>${avg(PP, wP)}</td><td>${avg(PT, wT)}</td><td style="font-size:8px">ശരാശരി</td></tr></tbody><tfoot><tr><td colspan="${N}" style="text-align:left;border:none;padding-top:6px"><div style="margin-bottom:4px">മാസാരംഭത്തിൽ കുട്ടികൾ: <b>${op}</b> &nbsp;|&nbsp; പുതുതായി ചേർന്നവർ: <b>${nw}</b> &nbsp;|&nbsp; ഈ മാസം വിട്ടവർ: <b>${lf}</b> &nbsp;|&nbsp; മാസാവസാനത്തിൽ: <b>${op + nw - lf}</b></div><div style="display:flex;justify-content:space-between;margin-top:14px;font-size:11px"><span>ക്ലാസ് മുഅല്ലിം: ................</span><span>സദർ മുഅല്ലിം: ................</span><span>മുഫത്തീശ്: ................</span></div></td></tr></tfoot></table>`;
  window._att = tbl;
  $('#pg').innerHTML = `<div class="g"><label>ക്ലാസ്<select onchange="sel.cls=this.value;attp()">${opts(db.classes, c)}</select></label></div>${rng('attp')}<div></div><p class="mu">മദ്രസയുടെ പേരും നമ്പറും ക്രമീകരണത്തിൽ നൽകുക. ("മുൻ മാസം" ${esc(fmtD(yrStartBound))} മുതൽ കണക്കാക്കുന്നു)</p>${btns('_att', 'attendance-register')}<div class="scroll card">${tbl}</div>`;
}
