import { db, auth, googleProvider } from "./firebase-config.js";
import { collection, addDoc, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const AVAILABLE_CATEGORIES = [
  "Wedding Photography", "Pre Shoot", "Birthday Events", 
  "Baby Photography", "Fashion Photography", "Nature Photography", 
  "Commercial Photography", "Drone Photography"
];

const elements = {
  menuBtn: document.getElementById('menu-btn'),
  navMenu: document.getElementById('nav-menu'),
  categoriesContainer: document.getElementById('categories-container'),
  galleryContainer: document.getElementById('gallery-container'),
  galleryTitle: document.getElementById('gallery-title'),
  slideshow: document.getElementById('featured-slideshow'),
  authPanel: document.getElementById('auth-container'),
  bookingForm: document.getElementById('booking-form'),
  loginBtn: document.getElementById('btn-google-login'),
  logoutBtn: document.getElementById('btn-logout'),
  userWelcome: document.getElementById('user-welcome'),
  bookingEmail: document.getElementById('bk-email'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
  lightboxClose: document.getElementById('lightbox-close')
};

if(elements.menuBtn) elements.menuBtn.addEventListener('click', () => elements.navMenu.classList.toggle('show'));

async function loadWebsiteConfig() {
  try {
    const querySnap = await getDocs(collection(db, "settings"));
    if(!querySnap.empty) {
      const data = querySnap.docs[0].data();
      if(data.heroTitle) document.getElementById('dyn-hero-title').innerText = data.heroTitle;
      if(data.heroSubtitle) document.getElementById('dyn-hero-subtitle').innerText = data.heroSubtitle;
      if(data.phone) document.getElementById('det-phone').innerText = data.phone;
      if(data.email) document.getElementById('det-email').innerText = data.email;
      if(data.footerText) document.getElementById('dyn-footer-text').innerHTML = data.footerText;
      
      let socialHtml = `
        <a href="\${data.facebook || '#'}" target="_blank"><i class="fab fa-facebook"></i></a>
        <a href="\${data.instagram || '#'}" target="_blank"><i class="fab fa-instagram"></i></a>
        <a href="https://wa.me/\${data.whatsapp || ''}" target="_blank"><i class="fab fa-whatsapp"></i></a>
      `;
      document.getElementById('det-socials').innerHTML = socialHtml;
    }
  } catch(err) { console.error(err); }
}

function renderCategoryDeck() {
  if(!elements.categoriesContainer) return;
  elements.categoriesContainer.innerHTML = AVAILABLE_CATEGORIES.map(cat => `
    <div class="category-card" data-category="\${cat}">
      <img src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=600&auto=format&fit=crop" class="skeleton" onload="this.classList.remove('skeleton')">
      <div class="category-info">
        <h3>\${cat}</h3>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const targetCat = card.getAttribute('data-category');
      fetchPortfolioGallery(targetCat);
    });
  });
}

async function fetchPortfolioGallery(categoryFilter = null) {
  if(!elements.galleryContainer) return;
  elements.galleryContainer.innerHTML = '<div class="spinner"></div>';
  elements.galleryTitle.innerText = categoryFilter ? `\${categoryFilter} Portfolio` : "All Photographs";
  
  try {
    let q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
    if(categoryFilter) {
      q = query(collection(db, "photos"), where("category", "==", categoryFilter), orderBy("createdAt", "desc"));
    }
    const snapshot = await getDocs(q);
    elements.galleryContainer.innerHTML = "";
    
    if(snapshot.empty) {
      elements.galleryContainer.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">No uploaded compositions matched the context query.</p>`;
      return;
    }

    snapshot.forEach(doc => {
      const photo = doc.data();
      const item = document.createElement('div');
      item.className = 'masonry-item';
      item.innerHTML = `<img src="\${photo.imageUrl}" alt="Miracle Composition Preview" loading="lazy">`;
      item.addEventListener('click', () => {
        elements.lightboxImg.src = photo.imageUrl;
        elements.lightbox.classList.add('active');
      });
      elements.galleryContainer.appendChild(item);
    });
  } catch(err) {
    console.error(err);
    elements.galleryContainer.innerHTML = `<p style="color:red;">Error fetching gallery images.</p>`;
  }
}

async function initSlideshowCarousel() {
  if(!elements.slideshow) return;
  try {
    const q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(6));
    const snap = await getDocs(q);
    const loader = document.getElementById('slideshow-loader');
    if(loader) loader.remove();

    if(snap.empty) {
      elements.slideshow.style.display = "none";
      return;
    }

    let idx = 0;
    snap.forEach(doc => {
      const data = doc.data();
      const div = document.createElement('div');
      div.className = `slide \${idx === 0 ? 'active' : ''}`;
      div.style.backgroundImage = `url('\${data.imageUrl}')`;
      elements.slideshow.appendChild(div);
      idx++;
    });

    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    if(slides.length > 1) {
      setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
      }, 3000);
    }
  } catch(e) { console.error(e); }
}

if(elements.lightboxClose) elements.lightboxClose.addEventListener('click', () => elements.lightbox.classList.remove('active'));

onAuthStateChanged(auth, (user) => {
  if (user) {
    if(elements.authPanel) elements.authPanel.style.display = "none";
    if(elements.bookingForm) elements.bookingForm.style.display = "block";
    if(elements.userWelcome) elements.userWelcome.innerText = `Booking as: \${user.displayName}`;
    if(elements.bookingEmail) elements.bookingEmail.value = user.email;
  } else {
    if(elements.authPanel) elements.authPanel.style.display = "block";
    if(elements.bookingForm) elements.bookingForm.style.display = "none";
  }
});

if(elements.loginBtn) elements.loginBtn.addEventListener('click', () => signInWithPopup(auth, googleProvider).catch(e => alert(e.message)));
if(elements.logoutBtn) elements.logoutBtn.addEventListener('click', () => signOut(auth));

const bForm = document.getElementById('booking-form');
if(bForm) {
  bForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('bk-name').value,
      phone: document.getElementById('bk-phone').value,
      email: elements.bookingEmail.value,
      eventType: document.getElementById('bk-type').value,
      date: document.getElementById('bk-date').value,
      location: document.getElementById('bk-location').value,
      notes: document.getElementById('bk-notes').value,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "bookings"), payload);
      alert("✨ Miracle Secured! Your booking request has been locked into processing routing.");
      bForm.reset();
      elements.bookingEmail.value = auth.currentUser.email;
    } catch(err) { alert("Error: " + err.message); }
  });
}

loadWebsiteConfig();
renderCategoryDeck();
fetchPortfolioGallery();
initSlideshowCarousel();