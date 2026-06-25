// admin.js — Miracle Photography · Admin Panel
import { db, auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL       = "pubwkon978@gmail.com";
const CLOUDINARY_URL    = "https://api.cloudinary.com/v1_1/dnvx958gz/image/upload";
const CLOUDINARY_PRESET = "miracle";
const CLOUDINARY_FOLDER = "miracle";

let allBookingsCache = [];

// ── Auth ────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user && user.email === ADMIN_EMAIL) {
    document.getElementById('admin-login-overlay').style.display = "none";
    initAdminPanel();
  } else {
    document.getElementById('admin-login-overlay').style.display = "flex";
  }
});

document.getElementById('btn-adm-login').addEventListener('click', () => {
  const email = document.getElementById('adm-email').value.trim();
  const pass  = document.getElementById('adm-pass').value.trim();
  if (!email || !pass) { alert("Please enter email and password."); return; }
  if (email !== ADMIN_EMAIL) { alert("Unauthorized: This email is not an admin account."); return; }
  signInWithEmailAndPassword(auth, email, pass)
    .catch(e => alert("Login failed: " + e.message));
});

document.getElementById('btn-adm-logout').addEventListener('click', () => signOut(auth));

async function initAdminPanel() {
  await Promise.all([
    loadDashboardMetrics(),
    loadLibraryVault(),
    loadBookingLedger(),
    loadSystemSettingsValues(),
  ]);
  loadDashRecentBookings();
}

// ── Sidebar Tab Nav ─────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.getAttribute('data-target'));
    if (target) target.classList.add('active');
  });
});

// ── Clock ───────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('adm-clock');
  if (!el) return;
  el.textContent = new Date().toLocaleString('en-US', {
    weekday:'short', month:'short', day:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

// ── Dashboard Metrics ───────────────────────────────
async function loadDashboardMetrics() {
  try {
    const [pSnap, bSnap] = await Promise.all([
      getDocs(collection(db, "photos")),
      getDocs(collection(db, "bookings")),
    ]);
    document.getElementById('stat-photos').innerText   = pSnap.size;
    document.getElementById('stat-bookings').innerText = bSnap.size;
    let pending = 0, confirmed = 0;
    bSnap.forEach(d => { if (d.data().status === "Confirmed") confirmed++; else pending++; });
    document.getElementById('stat-pending').innerText   = pending;
    document.getElementById('stat-confirmed').innerText = confirmed;
    const badge = document.getElementById('sidebar-pending-count');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline-flex' : 'none'; }
  } catch (err) { console.error("Metrics:", err); }
}

// ── Recent Bookings on Dashboard ────────────────────
async function loadDashRecentBookings() {
  const container = document.getElementById('dash-recent-bookings');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    container.innerHTML = '';
    if (snap.empty) { container.innerHTML = '<p class="adm-empty">No bookings yet.</p>'; return; }
    snap.forEach(ds => {
      const d = ds.data();
      const row = document.createElement('div');
      row.className = 'adm-recent-row glass-card';
      row.innerHTML = `
        <div class="arr-name">${d.name}</div>
        <div class="arr-type">${d.eventType}</div>
        <div class="arr-date">${formatDate(d.date)}</div>
        <div class="arr-phone">${d.phone}</div>
        <span class="adm-status-tag ${d.status==='Confirmed'?'tag-confirmed':'tag-pending'}">${d.status}</span>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    container.innerHTML = '<p class="adm-empty adm-error">Cannot load bookings — check Firestore rules.</p>';
  }
}

// ── Vault ───────────────────────────────────────────
window.loadLibraryVault = async function() {
  const container = document.getElementById('vault-items-container');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const q    = query(collection(db, "photos"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p class="adm-empty" style="grid-column:1/-1">No photos yet. Upload some!</p>';
      return;
    }
    snap.forEach(ds => {
      const data = ds.data();
      const card = document.createElement('div');
      card.className = 'adm-vault-card';
      card.innerHTML = `
        <img src="${data.imageUrl}" alt="${data.category}" loading="lazy">
        <div class="adm-vault-overlay">
          <span class="adm-vault-cat">${data.category}</span>
          <button class="adm-vault-del-btn" title="Delete"><i class="fa fa-trash"></i></button>
        </div>
      `;
      card.querySelector('.adm-vault-del-btn').addEventListener('click', async () => {
        if (confirm('Delete this photo?')) {
          await deleteDoc(doc(db, "photos", ds.id));
          card.style.opacity = '0'; card.style.transform = 'scale(0.8)';
          setTimeout(() => { card.remove(); loadDashboardMetrics(); }, 350);
        }
      });
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<p class="adm-empty adm-error" style="grid-column:1/-1">Cannot load photos — check Firestore rules.</p>';
  }
};

// ── Drag & Drop Upload ──────────────────────────────
const dropzone    = document.getElementById('adm-dropzone');
const fileInput   = document.getElementById('upl-files');
const previewWrap = document.getElementById('adm-preview-wrap');
const idleContent = document.getElementById('adm-dropzone-idle');

function showPreviews(files) {
  if (!files || !files.length) {
    previewWrap.style.display = 'none';
    idleContent.style.display = 'flex';
    return;
  }
  previewWrap.innerHTML = `<div class="adm-preview-count"><i class="fa fa-check-circle"></i> ${files.length} file${files.length>1?'s':''} selected</div>`;
  Array.from(files).slice(0,8).forEach(f => {
    const r = new FileReader();
    r.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'adm-preview-thumb';
      previewWrap.appendChild(img);
    };
    r.readAsDataURL(f);
  });
  if (files.length > 8) {
    const m = document.createElement('div');
    m.className = 'adm-preview-more';
    m.textContent = `+${files.length-8} more`;
    previewWrap.appendChild(m);
  }
  previewWrap.style.display = 'flex';
  idleContent.style.display = 'none';
}

dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone?.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  fileInput.files = e.dataTransfer.files;
  showPreviews(e.dataTransfer.files);
});
fileInput?.addEventListener('change', () => showPreviews(fileInput.files));

document.getElementById('btn-trigger-upload').addEventListener('click', async () => {
  const category = document.getElementById('upl-category').value;
  const files    = fileInput.files;
  const log      = document.getElementById('upload-progress-log');
  if (!files.length) { alert("Please select at least one image."); return; }
  log.innerHTML = '';
  addLog(log, 'Starting upload...', 'neutral');
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    addLog(log, `Uploading: ${file.name}`, 'neutral');
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_PRESET);
    form.append("folder", CLOUDINARY_FOLDER);
    try {
      const res  = await fetch(CLOUDINARY_URL, { method:"POST", body:form });
      const data = await res.json();
      if (data.secure_url) {
        await addDoc(collection(db, "photos"), {
          imageUrl: data.secure_url, category,
          publicId: data.public_id,
          createdAt: new Date().toISOString()
        });
        addLog(log, `✅ ${file.name}`, 'success');
      } else {
        addLog(log, `❌ ${file.name} — ${data.error?.message || 'Upload failed'}`, 'error');
      }
    } catch (err) {
      addLog(log, `❌ Error: ${err.message}`, 'error');
    }
  }
  addLog(log, `Done! ${files.length} file(s) processed.`, 'success');
  fileInput.value = ''; showPreviews(null);
  loadDashboardMetrics(); loadLibraryVault();
});

function addLog(c, msg, type) {
  const p = document.createElement('p');
  p.className = `log-line log-${type}`;
  p.textContent = msg;
  c.appendChild(p);
  c.scrollTop = c.scrollHeight;
}

// ── Bookings ────────────────────────────────────────
async function loadBookingLedger() {
  const container = document.getElementById('booking-cards-container');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const q    = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    container.innerHTML = '';
    if (snap.empty) { container.innerHTML = '<p class="adm-empty">No booking requests yet.</p>'; return; }
    allBookingsCache = snap.docs.map(ds => ({ id: ds.id, ...ds.data() }));
    renderBookingCards(allBookingsCache);
  } catch (err) {
    container.innerHTML = '<p class="adm-empty adm-error">Cannot load bookings — check Firestore rules allow admin reads on "bookings".</p>';
  }
}

function renderBookingCards(bookings, container) {
  container = container || document.getElementById('booking-cards-container');
  container.innerHTML = '';
  if (!bookings.length) {
    container.innerHTML = '<p class="adm-empty">No bookings match this filter.</p>';
    return;
  }
  bookings.forEach(data => {
    const card      = document.createElement('div');
    card.className  = 'adm-booking-card glass-card';
    const confirmed = data.status === 'Confirmed';
    card.innerHTML  = `
      <div class="adm-bc-header">
        <div class="adm-bc-top-row">
          <span class="adm-status-tag ${confirmed?'tag-confirmed':'tag-pending'}">${data.status}</span>
          <h3 class="adm-bc-name">${data.name}</h3>
        </div>
        <span class="adm-bc-received">Received: ${formatDateTime(data.createdAt)}</span>
      </div>

      <div class="adm-bc-grid">
        <div class="adm-bc-field">
          <div class="adm-bc-field-icon"><i class="fa fa-phone"></i></div>
          <div><span class="adm-bc-label">Phone</span><p>${data.phone}</p></div>
        </div>
        <div class="adm-bc-field">
          <div class="adm-bc-field-icon"><i class="fa fa-envelope"></i></div>
          <div><span class="adm-bc-label">Email</span><p>${data.email}</p></div>
        </div>
        <div class="adm-bc-field">
          <div class="adm-bc-field-icon"><i class="fa fa-camera"></i></div>
          <div><span class="adm-bc-label">Event Type</span><p>${data.eventType}</p></div>
        </div>
        <div class="adm-bc-field">
          <div class="adm-bc-field-icon"><i class="fa fa-calendar-day"></i></div>
          <div><span class="adm-bc-label">Event Date</span><p>${formatDate(data.date)}</p></div>
        </div>
        <div class="adm-bc-field adm-bc-full">
          <div class="adm-bc-field-icon"><i class="fa fa-map-marker-alt"></i></div>
          <div><span class="adm-bc-label">Location</span><p>${data.location}</p></div>
        </div>
        ${data.notes ? `
        <div class="adm-bc-field adm-bc-full adm-bc-notes-row">
          <div class="adm-bc-field-icon"><i class="fa fa-sticky-note"></i></div>
          <div><span class="adm-bc-label">Special Notes</span><p>${data.notes}</p></div>
        </div>` : ''}
      </div>

      <div class="adm-bc-actions">
        ${!confirmed
          ? `<button class="adm-confirm-btn adm-action-btn"><i class="fa fa-check"></i> Confirm Booking</button>`
          : `<button class="adm-confirmed-btn adm-action-btn" disabled><i class="fa fa-check-circle"></i> Confirmed</button>`
        }
        <button class="adm-delete-btn adm-action-btn"><i class="fa fa-trash"></i> Delete</button>
      </div>
    `;
    card.querySelector('.adm-confirm-btn')?.addEventListener('click', async () => {
      await updateDoc(doc(db, "bookings", data.id), { status:"Confirmed" });
      const idx = allBookingsCache.findIndex(b => b.id === data.id);
      if (idx !== -1) allBookingsCache[idx].status = "Confirmed";
      loadBookingLedger(); loadDashboardMetrics();
    });
    card.querySelector('.adm-delete-btn')?.addEventListener('click', async () => {
      if (confirm(`Delete booking from "${data.name}"? This cannot be undone.`)) {
        await deleteDoc(doc(db, "bookings", data.id));
        allBookingsCache = allBookingsCache.filter(b => b.id !== data.id);
        card.style.transition = 'all 0.35s'; card.style.opacity = '0'; card.style.transform = 'translateY(-10px)';
        setTimeout(() => { card.remove(); loadDashboardMetrics(); }, 380);
      }
    });
    container.appendChild(card);
  });
}

// Booking filter tabs
document.querySelectorAll('.adm-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.adm-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f       = btn.getAttribute('data-filter');
    const filtered = f === 'all' ? allBookingsCache : allBookingsCache.filter(b => b.status === f);
    renderBookingCards(filtered);
  });
});

// ── Settings ────────────────────────────────────────
async function loadSystemSettingsValues() {
  try {
    const snap = await getDocs(collection(db, "settings"));
    if (!snap.empty) {
      const v = snap.docs[0].data();
      document.getElementById('set-hero-title').value    = v.heroTitle    || '';
      document.getElementById('set-hero-subtitle').value = v.heroSubtitle || '';
      document.getElementById('set-phone').value         = v.phone        || '';
      document.getElementById('set-email').value         = v.email        || '';
      document.getElementById('set-fb').value            = v.facebook     || '';
      document.getElementById('set-insta').value         = v.instagram    || '';
      document.getElementById('set-wa').value            = v.whatsapp     || '';
      document.getElementById('set-footer').value        = v.footerText   || '';
      document.getElementById('settings-mutation-form').setAttribute('data-doc-id', snap.docs[0].id);
    }
  } catch (err) { console.error("Settings:", err); }
}

document.getElementById('settings-mutation-form').addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = e.submitter;
  const origHTML  = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
  submitBtn.disabled  = true;
  const payload = {
    heroTitle:    document.getElementById('set-hero-title').value,
    heroSubtitle: document.getElementById('set-hero-subtitle').value,
    phone:        document.getElementById('set-phone').value,
    email:        document.getElementById('set-email').value,
    facebook:     document.getElementById('set-fb').value,
    instagram:    document.getElementById('set-insta').value,
    whatsapp:     document.getElementById('set-wa').value,
    footerText:   document.getElementById('set-footer').value,
  };
  try {
    const existId = e.target.getAttribute('data-doc-id');
    if (existId) {
      await updateDoc(doc(db, "settings", existId), payload);
    } else {
      const nd = await addDoc(collection(db, "settings"), payload);
      e.target.setAttribute('data-doc-id', nd.id);
    }
    submitBtn.innerHTML = '<i class="fa fa-check"></i> Saved!';
    setTimeout(() => { submitBtn.innerHTML = origHTML; submitBtn.disabled = false; }, 2000);
  } catch (err) {
    submitBtn.innerHTML = origHTML; submitBtn.disabled = false;
    alert("Save failed: " + err.message);
  }
});

// ── Helpers ─────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }); }
  catch { return s; }
}
function formatDateTime(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return s; }
}
