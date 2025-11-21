/* script.js — Selakw Xtract
   Client-side multi-resolver with CORS proxy fallback (AllOrigins).
   NOTE: Some resolver endpoints may change; this is a best-effort front-end approach.
*/

(() => {
  // Elements
  const yearEls = [document.getElementById('year'), document.getElementById('year2')];
  const nowYear = new Date().getFullYear();
  yearEls.forEach(e => { if (e) e.textContent = nowYear; });

  const drawer = document.getElementById('drawer');
  const hamb = document.getElementById('hamb');
  const navBtns = Array.from(document.querySelectorAll('[data-page]'));
  const pages = Array.from(document.querySelectorAll('.page'));
  const resolveBtn = document.getElementById('resolve');
  const downloadBtn = document.getElementById('download');
  const urlInput = document.getElementById('url');
  const detected = document.getElementById('detected');
  const qualitySelect = document.getElementById('quality');
  const thumbImg = document.getElementById('thumbImg');
  const previewArea = document.getElementById('previewArea');
  const titleText = document.getElementById('titleText');
  const durationText = document.getElementById('durationText');
  const formatInfo = document.getElementById('formatInfo');
  const result = document.getElementById('result');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const miniplayer = document.getElementById('miniplayer');
  const miniVideo = document.getElementById('miniVideo');
  const rewardModal = document.getElementById('rewardModal');
  const rewardVid = document.getElementById('rewardVid');
  const rewardCountdown = document.getElementById('rewardCountdown');
  const skipAdBtn = document.getElementById('skipAd');
  const cancelAdBtn = document.getElementById('cancelAd');
  const themeBtn = document.getElementById('themeBtn');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const manualResolverBtn = document.getElementById('manualResolverBtn');

  // Vanta background (behind content)
  try {
    VANTA.WAVES({
      el: "#vanta-bg",
      color: 0x4b0070,
      shininess: 30,
      waveHeight: 18,
      waveSpeed: 0.9,
      zoom: 0.95
    });
  } catch (e) { console.warn('Vanta init failed', e); }

  // Drawer toggle + close on outside click
  hamb.addEventListener('click', () => drawer.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!drawer.contains(e.target) && !hamb.contains(e.target) && drawer.classList.contains('open')) drawer.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') drawer.classList.remove('open'); });

  // Page nav buttons - SPA-like (just hides/shows)
  navBtns.forEach(btn => btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-page');
    showPage(key);
  }));
  function showPage(key) {
    pages.forEach(p => p.style.display = 'none');
    const el = document.getElementById(key);
    if (el) el.style.display = 'block';
    drawer.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // default
  showPage('home');

  // Theme toggle
  const savedTheme = localStorage.getItem('selakw_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeBtn.textContent = next === 'dark' ? 'Light' : 'Dark';
    localStorage.setItem('selakw_theme', next);
  });

  // Platform detection + thumbnail attempt
  function detectPlatform(url) {
    if (!url) return '';
    const u = url.toLowerCase();
    if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fbcdn')) return 'facebook';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('tiktok.com') || u.includes('vm.tiktok.com')) return 'tiktok';
    if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    return 'unknown';
  }

  urlInput.addEventListener('input', () => {
    detected.textContent = urlInput.value ? 'Detected: ' + detectPlatform(urlInput.value) : '';
    tryAutoThumbnail(urlInput.value);
  });

  async function tryAutoThumbnail(url) {
    previewArea.style.display = 'none';
    if (!url) return;
    try {
      const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(url));
      if (r.ok) {
        const j = await r.json();
        if (j && j.thumbnail_url) {
          thumbImg.src = j.thumbnail_url;
          thumbImg.onload = () => previewArea.style.display = 'block';
          titleText.textContent = j.title || '';
          durationText.textContent = j.duration ? 'Duration: ' + j.duration : '';
          return;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // History
  function loadHistory() {
    const arr = JSON.parse(localStorage.getItem('selakw_history') || '[]');
    historyList.innerHTML = '';
    arr.slice().reverse().forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `<img src="${escapeHtml(item.thumb||'')}" alt="">
        <div class="hinfo">
          <div style="font-weight:700">${escapeHtml(item.title||item.url)}</div>
          <div class="small">${new Date(item.t).toLocaleString()}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <a class="btn-ghost smallbtn" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open</a>
        </div>`;
      historyList.appendChild(el);
    });
  }
  function addHistory(obj) {
    const arr = JSON.parse(localStorage.getItem('selakw_history') || '[]');
    if (!arr.some(x => x.url === obj.url && x.quality === obj.quality)) arr.push(obj);
    localStorage.setItem('selakw_history', JSON.stringify(arr.slice(-250)));
    loadHistory();
  }
  clearHistoryBtn && clearHistoryBtn.addEventListener('click', () => { if (confirm('Clear download history?')) { localStorage.removeItem('selakw_history'); loadHistory(); } });
  loadHistory();

  // Mini player drag
  (function miniDrag() {
    let dragging = false, offset = { x: 0, y: 0 };
    miniplayer.addEventListener('mousedown', e => { dragging = true; offset.x = e.clientX - miniplayer.offsetLeft; offset.y = e.clientY - miniplayer.offsetTop; miniplayer.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', e => { if (!dragging) return; miniplayer.style.left = (e.clientX - offset.x) + 'px'; miniplayer.style.top = (e.clientY - offset.y) + 'px'; });
    window.addEventListener('mouseup', () => { dragging = false; miniplayer.style.cursor = 'grab'; });
  })();

  // Util helpers
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function detectQualityFromUrl(u) { if (!u) return null; const m = u.match(/(\d{3,4}p)/i); if (m) return m[1]; const m2 = u.match(/(2160|1440|1080|720|480|360)/); if (m2) return m2[1] + 'p'; return null; }
  function guessExtFromUrl(u) { if (!u) return 'mp4'; if (u.includes('.mp3')) return 'mp3'; if (u.includes('.webm')) return 'webm'; if (u.includes('.m4a')) return 'm4a'; return 'mp4'; }

  // Fake progress
  function runFakeProgress() {
    return new Promise(res => {
      progressWrap.style.display = 'block';
      progressBar.style.width = '0%';
      let pct = 0;
      const id = setInterval(() => {
        pct += Math.random() * 18;
        if (pct > 100) pct = 100;
        progressBar.style.width = pct + '%';
        if (pct >= 100) {
          clearInterval(id);
          setTimeout(() => { progressWrap.style.display = 'none'; progressBar.style.width = '0%'; res(); }, 600);
        }
      }, 250);
    });
  }

  // Reward modal (simulated)
  function openRewardModal() {
    return new Promise(resolve => {
      rewardModal.style.display = 'flex';
      rewardVid.src = 'https://www.w3schools.com/html/mov_bbb.mp4';
      rewardVid.currentTime = 0;
      rewardVid.play().catch(() => {});
      let t = 8;
      rewardCountdown.textContent = t;
      skipAdBtn.disabled = true;
      const iv = setInterval(() => {
        t--; rewardCountdown.textContent = t;
        if (t <= 2) skipAdBtn.disabled = false;
        if (t <= 0) { clearInterval(iv); rewardModal.style.display = 'none'; resolve(); }
      }, 1000);
      skipAdBtn.onclick = () => { clearInterval(iv); rewardModal.style.display = 'none'; resolve(); };
      cancelAdBtn.onclick = () => { clearInterval(iv); rewardModal.style.display = 'none'; resolve('cancel'); };
      rewardVid.onended = () => { clearInterval(iv); rewardModal.style.display = 'none'; resolve(); };
    });
  }

  // Fetch with fallback (direct, then AllOrigins GET)
  async function fetchWithFallback(url, opts = {}) {
    // Direct fetch attempt
    try {
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error('non-ok');
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return await r.json();
      const txt = await r.text();
      // try parse JSON
      try { return JSON.parse(txt); } catch (e) { return txt; }
    } catch (err) {
      // Fallback: AllOrigins GET
      try {
        const proxy = 'https://api.allorigins.win/raw?url=';
        const r2 = await fetch(proxy + encodeURIComponent(url));
        if (!r2.ok) throw new Error('proxy fail');
        const ct = r2.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await r2.json();
        const txt2 = await r2.text();
        try { return JSON.parse(txt2); } catch (e) { return txt2; }
      } catch (e2) {
        console.warn('fetchWithFallback failed', e2);
        return null;
      }
    }
  }

  // Snapsave resolver (Facebook / Instagram)
  async function resolveSnapsave(targetUrl) {
    try {
      const form = 'q=' + encodeURIComponent(targetUrl);
      // try direct POST
      let res = await fetch('https://snapsave.app/api/ajaxSearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: form
      });
      if (!res.ok) throw new Error('snapsave direct failed');
      const json = await res.json();
      return parseSnapsave(json, targetUrl);
    } catch (e) {
      // fallback to proxy GET (if endpoint accepts GET variation)
      try {
        const proxy = 'https://api.allorigins.win/raw?url=';
        const fallback = 'https://snapsave.app/api/ajaxSearch?q=' + encodeURIComponent(targetUrl);
        const r2 = await fetch(proxy + encodeURIComponent(fallback));
        if (!r2.ok) throw new Error('snapsave proxy failed');
        const j2 = await r2.json();
        return parseSnapsave(j2, targetUrl);
      } catch (err) {
        console.warn('snapsave failed', err);
        return { links: [], title: null, thumb: null, duration: null, manualResolverUrl: 'https://snapsave.app/?q=' + encodeURIComponent(targetUrl) };
      }
    }
  }
  function parseSnapsave(json, targetUrl) {
    try {
      const data = json.data || json || {};
      const title = data.title || data.name || null;
      const thumb = data.thumbnail || data.thumb || data.poster || null;
      const duration = data.duration || null;
      const links = [];
      if (Array.isArray(data.links)) {
        data.links.forEach(l => { if (l.url) links.push({ url: l.url, quality: l.quality || detectQualityFromUrl(l.url), ext: l.format || guessExtFromUrl(l.url) }); });
      }
      if (Array.isArray(data.result)) {
        data.result.forEach(r => { if (r.url) links.push({ url: r.url, quality: r.quality || detectQualityFromUrl(r.url), ext: guessExtFromUrl(r.url) }); });
      }
      if (links.length === 0) {
        const found = JSON.stringify(json).match(/https?:\/\/[^"\s\\]+/g) || [];
        found.forEach(f => { if (/\.(mp4|webm|m3u8|mp3)/i.test(f)) links.push({ url: f, quality: detectQualityFromUrl(f), ext: guessExtFromUrl(f) }); });
      }
      const uniq = [];
      const seen = new Set();
      links.forEach(l => { if (!seen.has(l.url)) { seen.add(l.url); uniq.push(l); }});
      return { links: uniq, title, thumb, duration, manualResolverUrl: 'https://snapsave.app/?q=' + encodeURIComponent(targetUrl) };
    } catch (e) {
      return { links: [], title: null, thumb: null, duration: null, manualResolverUrl: 'https://snapsave.app/?q=' + encodeURIComponent(targetUrl) };
    }
  }

  // TikTok resolver (best-effort via ssstik fallback)
  async function resolveTikTok(targetUrl) {
    try {
      // attempt common ssstik GET via proxy
      const proxy = 'https://api.allorigins.win/raw?url=';
      const endpoint = 'https://ssstik.io/en/vid?url=' + encodeURIComponent(targetUrl);
      const r = await fetch(proxy + encodeURIComponent(endpoint));
      const txt = await r.text();
      const found = txt.match(/https?:\/\/[^'"]+?(?:mp4|m3u8|mp3|webm)/gi) || [];
      const links = Array.from(new Set(found)).map(u => ({ url: u, quality: detectQualityFromUrl(u), ext: guessExtFromUrl(u) }));
      return { links, title: null, thumb: null, duration: null, manualResolverUrl: 'https://ssstik.io/en?url=' + encodeURIComponent(targetUrl) };
    } catch (e) {
      console.warn('tiktok resolver failed', e);
      return { links: [], title: null, thumb: null, duration: null, manualResolverUrl: 'https://ssstik.io/en?url=' + encodeURIComponent(targetUrl) };
    }
  }

  // Twitter/X resolver (twdown)
  async function resolveTwitter(targetUrl) {
    try {
      const tryUrl = 'https://twdown.net/download?url=' + encodeURIComponent(targetUrl);
      const proxy = 'https://api.allorigins.win/raw?url=';
      const r = await fetch(proxy + encodeURIComponent(tryUrl));
      const txt = await r.text();
      const found = txt.match(/https?:\/\/[^'"]+?(?:mp4|m3u8|webm)/gi) || [];
      const links = Array.from(new Set(found)).map(u => ({ url: u, quality: detectQualityFromUrl(u), ext: guessExtFromUrl(u) }));
      return { links, title: null, thumb: null, duration: null, manualResolverUrl: tryUrl };
    } catch (e) {
      console.warn('twitter resolver failed', e);
      return { links: [], title: null, thumb: null, duration: null, manualResolverUrl: 'https://twdown.net' };
    }
  }

  // YouTube resolver (metadata via noembed; direct downloads are restricted)
  async function resolveYouTube(targetUrl) {
    try {
      const meta = await fetchWithFallback('https://noembed.com/embed?url=' + encodeURIComponent(targetUrl));
      const title = meta && meta.title ? meta.title : null;
      const thumb = meta && meta.thumbnail_url ? meta.thumbnail_url : null;
      return { links: [], title, thumb, duration: meta && meta.duration ? meta.duration : null, manualResolverUrl: 'https://y2mate.guru/?url=' + encodeURIComponent(targetUrl) };
    } catch (e) {
      return { links: [], title: null, thumb: null, duration: null, manualResolverUrl: 'https://y2mate.guru' };
    }
  }

  // Orchestrator
  async function resolveUrl(url) {
    const platform = detectPlatform(url);
    let res = null;
    if (platform === 'facebook' || platform === 'instagram') res = await resolveSnapsave(url);
    else if (platform === 'tiktok') res = await resolveTikTok(url);
    else if (platform === 'twitter') res = await resolveTwitter(url);
    else if (platform === 'youtube') res = await resolveYouTube(url);
    else {
      // try snapsave first then tiktok fallback
      res = await resolveSnapsave(url);
      if ((!res || !res.links || res.links.length === 0)) {
        const tk = await resolveTikTok(url);
        if (tk && tk.links && tk.links.length) res = tk;
      }
    }
    return res || { links: [], title: null, thumb: null, duration: null, manualResolverUrl: null };
  }

  // populate quality selector
  function populateQualities(links) {
    qualitySelect.innerHTML = '';
    const auto = document.createElement('option'); auto.value = 'auto'; auto.textContent = 'Auto (best)'; qualitySelect.appendChild(auto);
    const map = {};
    links.forEach(l => {
      const q = l.quality || detectQualityFromUrl(l.url) || 'file';
      const key = `${q}|${l.ext || guessExtFromUrl(l.url)}`;
      if (!map[key]) map[key] = l;
    });
    const keys = Object.keys(map);
    if (keys.length === 0) {
      links.forEach(l => {
        const opt = document.createElement('option'); opt.value = l.url; opt.textContent = `${l.ext.toUpperCase()} ${l.quality || ''}`.trim(); qualitySelect.appendChild(opt);
      });
      return;
    }
    keys.sort((a, b) => {
      const na = parseInt(a) || 0, nb = parseInt(b) || 0; return nb - na;
    });
    keys.forEach(k => {
      const l = map[k];
      const opt = document.createElement('option'); opt.value = l.url; opt.textContent = `${(l.quality || 'file')} • ${l.ext.toUpperCase()}`; qualitySelect.appendChild(opt);
    });
  }

  // mini player
  function showMini(src) {
    if (!src) return;
    miniVideo.src = src;
    miniplayer.style.display = 'block';
    miniplayer.style.left = (window.innerWidth - 280) + 'px';
    miniplayer.style.top = (window.innerHeight - 180) + 'px';
  }

  // Main interactions
  let currentResolve = null;
  resolveBtn.addEventListener('click', async () => {
    result.innerHTML = '';
    const url = urlInput.value.trim();
    if (!url) { alert('Please paste a URL'); return; }
    detected.textContent = 'Detected: ' + detectPlatform(url);
    previewArea.style.display = 'none';
    currentResolve = null;
    result.innerHTML = '<div class="muted small">Resolving — contacting resolver(s)...</div>';
    const r = await resolveUrl(url);
    if (!r) {
      result.innerHTML = '<div class="muted small" style="color:#ffdada">Resolver failed. Try manual resolver link below.</div>';
      return;
    }
    titleText.textContent = r.title || url;
    durationText.textContent = r.duration ? `Duration: ${r.duration}` : '';
    formatInfo.textContent = r.links && r.links.length ? `${r.links.length} format(s) found` : 'No direct formats found';
    if (r.thumb) { thumbImg.src = r.thumb; thumbImg.onload = () => previewArea.style.display = 'block'; } else previewArea.style.display = 'block';
    if (!r.links || r.links.length === 0) {
      result.innerHTML = `<div class="muted small" style="margin-top:8px;color:#ffdada">No direct links found automatically. <a class="btn-ghost smallbtn" target="_blank" href="${r.manualResolverUrl || '#'}">Open manual resolver</a></div>`;
      manualResolverBtn.style.display = 'inline-block';
      manualResolverBtn.href = r.manualResolverUrl || '#';
      currentResolve = r;
      return;
    }
    currentResolve = r;
    populateQualities(r.links);
    result.innerHTML = `<div class="muted small" style="margin-top:8px">Select quality then click Resolve & Download (ad required).</div>`;
    const first = r.links[0].url;
    if (first) { showMini(first); addHistory({ url, title: r.title || url, thumb: r.thumb || '', quality: 'resolved', t: Date.now() }); }
  });

  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { alert('Please paste a URL'); return; }
    if (!currentResolve) currentResolve = await resolveUrl(url);
    const r = await openRewardModal();
    if (r === 'cancel') return;
    let dlUrl = null;
    if (qualitySelect.value === 'auto') {
      if (currentResolve.links && currentResolve.links.length) {
        const sorted = currentResolve.links.slice().sort((a, b) => {
          const na = parseInt((a.quality || '0').replace(/\D/g, '')) || 0;
          const nb = parseInt((b.quality || '0').replace(/\D/g, '')) || 0;
          return nb - na;
        });
        dlUrl = sorted[0].url;
      }
    } else dlUrl = qualitySelect.value;
    if (!dlUrl) {
      window.open(currentResolve.manualResolverUrl || '#', '_blank');
      return;
    }
    await runFakeProgress();
    addHistory({ url: dlUrl, title: currentResolve.title || url, thumb: currentResolve.thumb || '', quality: (qualitySelect.options[qualitySelect.selectedIndex] || {}).text || 'auto', t: Date.now() });
    window.open(dlUrl, '_blank');
  });

  // Clipboard paste on load (best effort)
  (async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const t = await navigator.clipboard.readText();
        if (t && t.startsWith('http') && !urlInput.value) urlInput.value = t.trim();
      }
    } catch (e) {}
  })();
})();
