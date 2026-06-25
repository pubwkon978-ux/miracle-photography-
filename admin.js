import { db, auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const COMPLIANT_ADMIN_CREDENTIAL_IDENTIFIER = "pubwkon978@gmail.com";
const CLOUDINARY_API_INGEST_ENDPOINT = "https://api.cloudinary.com/v1_1/dnvx958gz/image/upload";
const CLOUDINARY_UPLOAD_PRESET_TOKEN   = "miracle";
const CLOUDINARY_TARGET_FOLDER_PATH   = "miracle";

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.getAttribute('data-target')).classList.add('active');
  });
});

onAuthStateChanged(auth, (user) => {
  if (user && user.email === COMPLIANT_ADMIN_CREDENTIAL_IDENTIFIER) {
    document.getElementById('admin-login-overlay').style.display = "none";
    loadDashboardMetrics();
    loadLibraryVault();
    loadBookingLedger();
    loadSystemSettingsValues();
  } else {
    document.getElementById('admin-login-overlay').style.display = "flex";
  }
});

document.getElementById('btn-adm-login').addEventListener('click', () => {
  const email = document.getElementById('adm-email').value;
  const pass = document.getElementById('adm-pass').value;
  if (email !== COMPLIANT_ADMIN_CREDENTIAL_IDENTIFIER) {
    alert("Authorization Interception: Terminal identity reject evaluation check failure state.");
    return;
  }
  signInWithEmailAndPassword(auth, email, pass).catch(e => alert("Credential Validation Fault: " + e.message));
});

document.getElementById('btn-adm-logout').addEventListener('click', () => signOut(auth));

document.getElementById('btn-trigger-upload').addEventListener('click', async () => {
  const selectedCategory = document.getElementById('upl-category').value;
  const fileInput = document.getElementById('upl-files');
  const logPanel = document.getElementById('upload-progress-log');
  
  if(fileInput.files.length === 0) { alert("Select files first."); return; }
  logPanel.innerHTML = "Processing system transmission pipeline connected... Ingest initialization begun.<br>";
  
  for(let i=0; i < fileInput.files.length; i++) {
    const targetFile = fileInput.files[i];
    logPanel.innerHTML += `Streaming target [\${targetFile.name}] package frames payload structure...<br>`;
    
    const packetStream = new FormData();
    packetStream.append("file", targetFile);
    packetStream.append("upload_preset", CLOUDINARY_UPLOAD_PRESET_TOKEN);
    packetStream.append("folder", CLOUDINARY_TARGET_FOLDER_PATH);
    
    try {
      const response = await fetch(CLOUDINARY_API_INGEST_ENDPOINT, { method: "POST", body: packetStream });
      const cloudData = await response.json();
      
      if(cloudData.secure_url) {
        const structuralRecordPayload = {
          imageUrl: cloudData.secure_url,
          category: selectedCategory,
          publicId: cloudData.public_id,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, "photos"), structuralRecordPayload);
        logPanel.innerHTML += `<span style="color:#2ecc71;">Uploaded successfully [\${i+1}].</span><br>`;
      } else {
        logPanel.innerHTML += `<span style="color:red;">Upload failure mismatch.</span><br>`;
      }
    } catch(err) { logPanel.innerHTML += `<span style="color:red;">Error: \${err.message}</span><br>`; }
  }
  fileInput.value = "";
  loadDashboardMetrics();
  loadLibraryVault();
});

async function loadDashboardMetrics() {
  const photosSnap = await getDocs(collection(db, "photos"));
  const bookingSnap = await getDocs(collection(db, "bookings"));
  document.getElementById('stat-photos').innerText = photosSnap.size;
  document.getElementById('stat-bookings').innerText = bookingSnap.size;
}

async function loadLibraryVault() {
  const container = document.getElementById('vault-items-container');
  if(!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  const q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  container.innerHTML = "";
  
  snap.forEach(documentSnapshot => {
    const fileNode = documentSnapshot.data();
    const itemCard = document.createElement('div');
    itemCard.className = "photo-manage-card glass-card";
    itemCard.innerHTML = `
      <img src="\${fileNode.imageUrl}">
      <div class="photo-actions">
        <span style="font-size:0.75rem; color:var(--text-muted);">\${fileNode.category}</span>
        <button class="btn-danger" data-id="\${documentSnapshot.id}"><i class="fa fa-trash"></i></button>
      </div>
    `;
    itemCard.querySelector('.btn-danger').addEventListener('click', async () => {
      if(confirm("Verify structural object deletion?")) {
        await deleteDoc(doc(db, "photos", documentSnapshot.id));
        itemCard.remove();
        loadDashboardMetrics();
      }
    });
    container.appendChild(itemCard);
  });
}

async function loadBookingLedger() {
  const container = document.getElementById('booking-cards-container');
  if(!container) return;
  container.innerHTML = '<div class="spinner"></div>';
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  container.innerHTML = "";
  
  snap.forEach(documentSnapshot => {
    const data = documentSnapshot.data();
    const card = document.createElement('div');
    card.className = "booking-card glass-card";
    const statusClass = data.status === "Confirmed" ? "status-confirmed" : "status-pending";
    
    card.innerHTML = `
      <span class="booking-status-tag \${statusClass}">\${data.status}</span>
      <h3 style="color:var(--accent); margin-bottom:10px;">\${data.name}</h3>
      <p style="font-size:0.9rem; margin-bottom:5px;"><strong>Contact:</strong> \${data.phone} | \${data.email}</p>
      <p style="font-size:0.9rem; margin-bottom:5px;"><strong>Event Profile:</strong> \${data.eventType}</p>
      <p style="font-size:0.9rem; margin-bottom:5px;"><strong>Chrono:</strong> \${data.date} | <strong>Location:</strong> \${data.location}</p>
      <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:15px;"><strong>Notes:</strong> \${data.notes || 'None'}</p>
      <div>
        <button class="btn-gold confirm-btn" style="padding:5px 15px; font-size:0.8rem; margin-right:10px;">Confirm Reservation</button>
        <button class="btn-danger delete-btn" style="font-size:0.8rem;"><i class="fa fa-trash"></i> Drop Record</button>
      </div>
    `;
    
    card.querySelector('.confirm-btn').addEventListener('click', async () => {
      await updateDoc(doc(db, "bookings", documentSnapshot.id), { status: "Confirmed" });
      loadBookingLedger();
    });
    
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if(confirm("Confirm record destruction?")) {
        await deleteDoc(doc(db, "bookings", documentSnapshot.id));
        card.remove();
        loadDashboardMetrics();
      }
    });
    container.appendChild(card);
  });
}

async function loadSystemSettingsValues() {
  const snap = await getDocs(collection(db, "settings"));
  if(!snap.empty) {
    const values = snap.docs[0].data();
    document.getElementById('set-hero-title').value = values.heroTitle || "";
    document.getElementById('set-hero-subtitle').value = values.heroSubtitle || "";
    document.getElementById('set-phone').value = values.phone || "";
    document.getElementById('set-email').value = values.email || "";
    document.getElementById('set-fb').value = values.facebook || "";
    document.getElementById('set-insta').value = values.instagram || "";
    document.getElementById('set-wa').value = values.whatsapp || "";
    document.getElementById('set-footer').value = values.footerText || "";
    document.getElementById('settings-mutation-form').setAttribute('data-doc-id', snap.docs[0].id);
  }
}

document.getElementById('settings-mutation-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const existingDocId = document.getElementById('settings-mutation-form').getAttribute('data-doc-id');
  const payload = {
    heroTitle: document.getElementById('set-hero-title').value,
    heroSubtitle: document.getElementById('set-hero-subtitle').value,
    phone: document.getElementById('set-phone').value,
    email: document.getElementById('set-email').value,
    facebook: document.getElementById('set-fb').value,
    instagram: document.getElementById('set-insta').value,
    whatsapp: document.getElementById('set-wa').value,
    footerText: document.getElementById('set-footer').value
  };

  try {
    if(existingDocId) {
      await updateDoc(doc(db, "settings", existingDocId), payload);
    } else {
      await addDoc(collection(db, "settings"), payload);
    }
    alert("Configuration profiles successfully written.");
    loadSystemSettingsValues();
  } catch(err) { alert("Mutate failed: " + err.message); }
});
