/* script.js — multi-resolver client side
   Strategy:
   - detect platform
   - attempt platform-specific resolver (Snapsave for FB/IG, ssstik for TikTok, YT fallback for YouTube, twdown for Twitter)
   - use fetch direct, then fallback to AllOrigins GET proxy for CORS
   - parse heuristically, present list of formats
   - show reward modal (simulated) before download
   - fake progress, mini player, history
*/

(() => {
  // Elements
  const drawer = document.getElementById('drawer');
  const hamb = document.getElementById('hamb');
  const navBtns = Array.from(document.querySelectorAll('[data-page]'));
  const pages = Array.from(document.querySelectorAll('main section'));
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
  const pasteBtn = document.getElementById('pasteBtn');
  const clearBtn = document.getElementById('clearBtn');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const manualResolverBtn = document.getElementById('manualResolverBtn');

  // Vanta waves
  try { VANTA.WAVES({ el: "body", color: 0x5b21b6, shininess: 35, waveHeight: 18, waveSpeed: 0.95, zoom: 0.95 }); } catch (e) {}

  // Drawer
  hamb.addEventListener('click', () => drawer.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!drawer.contains(e.target) && !hamb.contains(e.target)) drawer.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') drawer.classList.remove('open'); });

  // Nav
  navBtns.forEach(btn => btn.addEventListener('click', () => { drawer.classList.remove('open'); window.scrollTo({top:0, behavior:'smooth'}); }));

  // Theme
  const savedTheme = localStorage.getItem('vid_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeBtn.textContent = next === 'dark' ? 'Light' : 'Dark';
    localStorage.setItem('vid_theme', next);
  });

  // Try paste
  pasteBtn && pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const t = await navigator.clipboard.readText();
        if (t && t.startsWith('http')) urlInput.value = t.trim();
      }
    } catch (e) { console.warn('clipboard denied'); }
  });
  clearBtn && clearBtn.addEventListener('click', () => { urlInput.value = ''; result.innerHTML = ''; previewArea.style.display = 'none'; });

  // Platform detection
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
    autoThumbnail(urlInput.value);
  });

  // Thumbnail via noembed (best-effort)
  async function autoThumbnail(url) {
    previewArea.style.display = 'none';
    if (!url) return;
    try {
      const res = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(url));
      if (res.ok) {
        const j = await res.json();
        if (j && j.thumbnail_url) {
          thumbImg.src = j.thumbnail_url;
          thumbImg.onload = () => previewArea.style.display = 'block';
          titleText.textContent = j.title || '';
          durationText.textContent = j.duration ? 'Duration: ' + j.duration : '';
          return;
        }
      }
    } catch (e) { /* ignore */ }
  }

  // History
  function loadHistory() {
    const arr = JSON.parse(localStorage.getItem('vid_history') || '[]');
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
    const arr = JSON.parse(localStorage.getItem('vid_history') || '[]');
    if (!arr.some(x => x.url === obj.url && x.quality === obj.quality)) arr.push(obj);
    localStorage.setItem('vid_history', JSON.stringify(arr.slice(-250)));
    loadHistory();
  }
  clearHistoryBtn && clearHistoryBtn.addEventListener('click', () => { if (confirm('Clear download history?')) { localStorage.removeItem('vid_history'); loadHistory(); }});
  loadHistory();

  // Mini player drag
  (function miniDrag() {
    let dragging = false, offset = {x:0,y:0};
    miniplayer.addEventListener('mousedown', e => { dragging = true; offset.x = e.clientX - miniplayer.offsetLeft; offset.y = e.clientY - miniplayer.offsetTop; miniplayer.style.cursor='grabbing'; });
    window.addEventListener('mousemove', e => { if (!dragging) return; miniplayer.style.left = (e.clientX - offset.x) + 'px'; miniplayer.style.top = (e.clientY - offset.y) + 'px'; });
    window.addEventListener('mouseup', () => { dragging = false; miniplayer.style.cursor='grab'; });
  })();

  // Utility helpers
  function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function detectQualityFromUrl(u) { if (!u) return null; const m = u.match(/(\d{3,4}p)/i); if (m) return m[1]; const m2 = u.match(/(2160|1440|1080|720|480|360)/); if (m2) return m2[1] + 'p'; return null; }
  function guessExtFromUrl(u) { if (!u) return 'mp4'; if (u.includes('.mp3')) return 'mp3'; if (u.includes('.webm')) return 'webm'; if (u.includes('.m4a')) return 'm4a'; return 'mp4'; }

  // Fake progress
  function runFakeProgress() {
    return new Promise(res => {
      progressWrap.style.display = 'block';
      progressBar.style.width = '0%';
      let pct = 0;
      const id = setInterval(() => {
        pct += Math.random()*18;
        if (pct > 100) pct = 100;
        progressBar.style.width = pct + '%';
        if (pct >= 100) {
          clearInterval(id);
          setTimeout(()=>{ progressWrap.style.display = 'none'; progressBar.style.width = '0%'; res(); }, 600);
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
      rewardVid.play().catch(()=>{});
      let t = 8;
      rewardCountdown.textContent = t;
      skipAdBtn.disabled = true;
      const iv = setInterval(()=> {
        t--; rewardCountdown.textContent = t;
        if (t <= 2) skipAdBtn.disabled = false;
        if (t <= 0) { clearInterval(iv); rewardModal.style.display = 'none'; resolve(); }
      }, 1000);
      skipAdBtn.onclick = ()=>{ clearInterval(iv); rewardModal.style.display = 'none'; resolve(); };
      cancelAdBtn.onclick = ()=>{ clearInterval(iv); rewardModal.style.display = 'none'; resolve('cancel'); };
      rewardVid.onended = ()=>{ clearInterval(iv); rewardModal.style.display = 'none'; resolve(); };
    });
  }

  // Multi-resolver functions
  // Each function returns an object: { links: [{url, quality, ext}], title, thumb, duration, manualResolverUrl }
  // Use direct fetch; on failure attempt AllOrigins GET fallback
  async function fetchWithFallback(url, fetchOptions = {}) {
    // try direct
    try {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) throw new Error('non-ok');
      return await res.json().catch(()=> null) || await res.text().then(t => tryParseJSON(t));
    } catch (e) {
      // fallback to AllOrigins GET only (works for GET endpoints)
      try {
        const proxy = 'https://api.allorigins.win/raw?url=';
        const proxyUrl = proxy + encodeURIComponent(url);
        const r2 = await fetch(proxyUrl);
        if (!r2.ok) throw new Error('proxy fail');
        return await r2.json().catch(()=> null) || await r2.text().then(t => tryParseJSON(t));
      } catch (e2) {
        console.warn('fetchWithFallback failed', e2);
        return null;
      }
    }
  }
  function tryParseJSON(text) {
    try { return JSON.parse(text); } catch (e) { return text; }
  }

  // Resolver: Snapsave (good for Facebook & Instagram)
  async function resolveSnapsave(targetUrl) {
    // Snapsave accepts POST; try direct POST first
    try {
      const body = 'q=' + encodeURIComponent(targetUrl);
      let res = await fetch('https://snapsave.app/api/ajaxSearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body
      });
      if (!res.ok) throw new Error('snapsave bad');
      const json = await res.json();
      // parse
      return parseSnapsave(json, targetUrl);
    } catch (e) {
      // fallback: try allorigins GET variant
      try {
        const proxy = 'https://api.allorigins.win/raw?url=';
        const fallbackUrl = 'https://snapsave.app/api/ajaxSearch?q=' + encodeURIComponent(targetUrl);
        const r2 = await fetch(proxy + encodeURIComponent(fallbackUrl));
        if (!r2.ok) throw new Error('snapsave proxy fail');
        const j2 = await r2.json();
        return parseSnapsave(j2, targetUrl);
      } catch (err) {
        console.warn('snapsave failed', err);
        return { links:[], title:null, thumb:null, duration:null, manualResolverUrl: 'https://snapsave.app/?q=' + encodeURIComponent(targetUrl) };
      }
    }
  }
  function parseSnapsave(json, targetUrl) {
    // Defensive parse; many shapes possible
    try {
      const data = json.data || json || {};
      const title = data.title || data.name || null;
      const thumb = data.thumbnail || data.thumb || data.poster || null;
      const duration = data.duration || null;
      const links = [];
      if (Array.isArray(data.links)) {
        data.links.forEach(l => { if (l.url) links.push({url:l.url, quality:l.quality||detectQualityFromUrl(l.url), ext:l.format||guessExtFromUrl(l.url)}); });
      }
      if (Array.isArray(data.result)) {
        data.result.forEach(r => { if (r.url) links.push({url:r.url, quality:r.quality||detectQualityFromUrl(r.url), ext:guessExtFromUrl(r.url)}); });
      }
      // fallback scanning for any url-like strings in json
      if (links.length === 0) {
        const found = JSON.stringify(json).match(/https?:\/\/[^"\s\\]+/g) || [];
        found.forEach(f => { if (/\.(mp4|webm|m3u8|mp3)/i.test(f)) links.push({url:f, quality:detectQualityFromUrl(f), ext:guessExtFromUrl(f)}); });
      }
      // dedupe
      const uniq = [];
      const seen = new Set();
      links.forEach(l => { if (!seen.has(l.url)) { seen.add(l.url); uniq.push(l); }});
      return { links: uniq, title, thumb, duration, manualResolverUrl: 'https://snapsave.app/?q=' + encodeURIComponent(targetUrl) };
    } catch (e) { return { links:[], title:null, thumb:null, duration:null, manualResolverUrl: 'https://snapsave.app/?q=' + encodeURIComponent(targetUrl) }; }
  }

  // Resolver: ssstik (TikTok) — many public endpoints exist, we attempt a common one
  async function resolveTikTok(targetUrl) {
    try {
      // public API that returns JSON (works often)
      const api = 'https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/play/?video_id=' + encodeURIComponent(targetUrl);
      // That endpoint is not reliable publicly; instead use ssstik fallback
      const ss = 'https://ssstik.io/abc?url=' + encodeURIComponent(targetUrl);
      // Try ssstik via allorigins
      const proxy = 'https://api.allorigins.win/raw?url=';
      const res = await fetch(proxy + encodeURIComponent('https://ssstik.io/en/vid?url=' + encodeURIComponent(targetUrl)));
      const text = await res.text();
      // try to find direct links
      const found = text.match(/https?:\/\/[^'"]+?(?:mp4|m3u8|mp3|webm)/gi) || [];
      const links = Array.from(new Set(found)).map(u => ({url:u, quality:detectQualityFromUrl(u), ext:guessExtFromUrl(u)}));
      return { links, title:null, thumb:null, duration:null, manualResolverUrl: 'https://ssstik.io/en?url=' + encodeURIComponent(targetUrl) };
    } catch (e) {
      console.warn('tiktok resolver failed', e);
      return { links:[], title:null, thumb:null, duration:null, manualResolverUrl: 'https://ssstik.io/en?url=' + encodeURIComponent(targetUrl) };
    }
  }

  // Resolver: Twitter / X — try twdown / twsaver like endpoints
  async function resolveTwitter(targetUrl) {
    try {
      // twdown accepts GET with query param
      const tryUrl = 'https://twdown.net/download?url=' + encodeURIComponent(targetUrl);
      const proxy = 'https://api.allorigins.win/raw?url=';
      const r = await fetch(proxy + encodeURIComponent(tryUrl));
      const text = await r.text();
      // parse for mp4s
      const found = text.match(/https?:\/\/[^'"]+?(?:mp4|m3u8|webm)/gi) || [];
      const links = Array.from(new Set(found)).map(u => ({url:u, quality:detectQualityFromUrl(u), ext:guessExtFromUrl(u)}));
      return { links, title:null, thumb:null, duration:null, manualResolverUrl: tryUrl };
    } catch (e) {
      console.warn('twitter resolver failed', e);
      return { links:[], title:null, thumb:null, duration:null, manualResolverUrl: 'https://twdown.net' };
    }
  }

  // Resolver: YouTube — fallback to yewtu or y2mate-like public endpoints (limited)
  async function resolveYouTube(targetUrl) {
    try {
      // try noembed for metadata + thumbnail, but not direct links.
      // For direct downloads YouTube is restrictive; we'll attempt yewtu API as a fallback
      const metaRes = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(targetUrl)).then(r=>r.json()).catch(()=>null);
      const title = metaRes && metaRes.title ? metaRes.title : null;
      const thumb = metaRes && metaRes.thumbnail_url ? metaRes.thumbnail_url : null;
      // try a public y2mate-like parser via allorigins GET (best-effort)
      const parserUrl = 'https://yewtu.cafe/api/v1/playback?url=' + encodeURIComponent(targetUrl); // may not exist; defensive
      const proxy = 'https://api.allorigins.win/raw?url=';
      try {
        const r = await fetch(proxy + encodeURIComponent(parserUrl));
        const j = await r.json().catch(()=>null);
        if (j && Array.isArray(j.files)) {
          const links = j.files.map(f => ({ url: f.url, quality: f.quality || detectQualityFromUrl(f.url), ext: guessExtFromUrl(f.url) }));
          return { links, title, thumb, duration: j.duration || null, manualResolverUrl: 'https://yewtu.cafe' };
        }
      } catch (e) { /* ignore */ }
      // If no direct links found, return metadata and manual resolver
      return { links:[], title, thumb, duration:null, manualResolverUrl: 'https://y2mate.guru/?url=' + encodeURIComponent(targetUrl) };
    } catch (e) {
      console.warn('youtube resolver failed', e);
      return { links:[], title:null, thumb:null, duration:null, manualResolverUrl: 'https://y2mate.guru' };
    }
  }

  // Unified resolver orchestrator
  async function resolveUrl(url) {
    const platform = detectPlatform(url);
    let res = null;
    if (platform === 'facebook' || platform === 'instagram') {
      res = await resolveSnapsave(url);
    } else if (platform === 'tiktok') {
      res = await resolveTikTok(url);
    } else if (platform === 'twitter') {
      res = await resolveTwitter(url);
    } else if (platform === 'youtube') {
      res = await resolveYouTube(url);
    } else {
      // try generic Snapsave first
      res = await resolveSnapsave(url);
      if (!res || (res.links && res.links.length === 0)) {
        // try tiktok parser etc
        const tk = await resolveTikTok(url);
        if (tk && tk.links && tk.links.length) res = tk;
      }
    }
    // ensure object shape
    return res || { links:[], title:null, thumb:null, duration:null, manualResolverUrl: null };
  }

  // Populate qualities selector
  function populateQualities(links) {
    qualitySelect.innerHTML = '';
    const auto = document.createElement('option'); auto.value='auto'; auto.textContent='Auto (best)'; qualitySelect.appendChild(auto);
    const map = {};
    links.forEach(l => {
      const q = l.quality || detectQualityFromUrl(l.url) || 'file';
      const key = `${q}|${l.ext||guessExtFromUrl(l.url)}`;
      if (!map[key]) map[key] = l;
    });
    const keys = Object.keys(map);
    if (keys.length === 0) {
      links.forEach(l => {
        const opt = document.createElement('option'); opt.value = l.url; opt.textContent = `${l.ext.toUpperCase()} ${l.quality||''}`.trim(); qualitySelect.appendChild(opt);
      });
      return;
    }
    // sort by numeric part desc
    keys.sort((a,b) => {
      const na = parseInt(a) || 0, nb = parseInt(b) || 0; return nb - na;
    });
    keys.forEach(k => {
      const l = map[k];
      const opt = document.createElement('option'); opt.value = l.url; opt.textContent = `${(l.quality||'file')} • ${l.ext.toUpperCase()}`; qualitySelect.appendChild(opt);
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

  // Main UX logic
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
    // show meta
    titleText.textContent = r.title || url;
    durationText.textContent = r.duration ? `Duration: ${r.duration}` : '';
    formatInfo.textContent = r.links && r.links.length ? `${r.links.length} format(s) found` : 'No direct formats found';
    if (r.thumb) { thumbImg.src = r.thumb; thumbImg.onload = () => previewArea.style.display = 'block'; } else previewArea.style.display = 'block';
    if (!r.links || r.links.length === 0) {
      result.innerHTML = `<div class="muted small" style="margin-top:8px;color:#ffdada">No direct links found automatically. <a class="btn-ghost smallbtn" target="_blank" href="${r.manualResolverUrl || '#'}">Open resolver</a></div>`;
      manualResolverBtn.style.display = 'inline-block';
      manualResolverBtn.href = r.manualResolverUrl || '#';
      currentResolve = r;
      return;
    }
    currentResolve = r;
    populateQualities(r.links);
    result.innerHTML = `<div class="muted small" style="margin-top:8px">Select quality then click Resolve & Download (ad required).</div>`;
    // preview first playable link
    const first = r.links[0].url;
    if (first) { showMini(first); addHistory({ url, title: r.title || url, thumb: r.thumb || '', quality: 'resolved', t: Date.now() }); }
  });

  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { alert('Please paste a URL'); return; }
    if (!currentResolve) currentResolve = await resolveUrl(url);
    const r = await openRewardModal();
    if (r === 'cancel') return;
    // pick dl url
    let dlUrl = null;
    if (qualitySelect.value === 'auto') {
      if (currentResolve.links && currentResolve.links.length) {
        const sorted = currentResolve.links.slice().sort((a,b) => {
          const na = parseInt((a.quality||'0').replace(/\D/g,''))||0;
          const nb = parseInt((b.quality||'0').replace(/\D/g,''))||0;
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
    addHistory({ url: dlUrl, title: currentResolve.title || url, thumb: currentResolve.thumb || '', quality: (qualitySelect.options[qualitySelect.selectedIndex]||{}).text || 'auto', t: Date.now() });
    window.open(dlUrl, '_blank');
  });

  // Init: try clipboard paste
  (async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const t = await navigator.clipboard.readText();
        if (t && t.startsWith('http') && !urlInput.value) urlInput.value = t.trim();
      }
    } catch (e) {}
  })();

})();
