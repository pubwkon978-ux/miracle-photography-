// app.js — Miracle Photography · Fixed & Enhanced
import { db, auth, googleProvider } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── Categories & Images ─────────────────────────────
const AVAILABLE_CATEGORIES = [
  "Wedding Photography", "Pre Shoot", "Birthday Events",
  "Baby Photography", "Fashion Photography", "Nature Photography",
  "Commercial Photography", "Drone Photography"
];

const CATEGORY_IMAGES = {
  "Wedding Photography":   "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop",
  "Pre Shoot":             "https://images.unsplash.com/photo-1529636444744-adffc9135a5e?q=80&w=600&auto=format&fit=crop",
  "Birthday Events":       "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=600&auto=format&fit=crop",
  "Baby Photography":      "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?q=80&w=600&auto=format&fit=crop",
  "Fashion Photography":   "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=600&auto=format&fit=crop",
  "Nature Photography":    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=600&auto=format&fit=crop",
  "Commercial Photography":"https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=600&auto=format&fit=crop",
  "Drone Photography":     "https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=600&auto=format&fit=crop"
};

// ── Element References ──────────────────────────────
const elements = {
  menuBtn:         document.getElementById('menu-btn'),
  navMenu:         document.getElementById('nav-menu'),
  categoriesContainer: document.getElementById('categories-container'),
  galleryContainer:    document.getElementById('gallery-container'),
  galleryTitle:        document.getElementById('gallery-title'),
  galleryFilters:      document.getElementById('gallery-filters'),
  slideshow:           document.getElementById('featured-slideshow'),
  slideshowDots:       document.getElementById('slideshow-dots'),
  authPanel:           document.getElementById('auth-container'),
  bookingForm:         document.getElementById('booking-form'),
  loginBtn:            document.getElementById('btn-google-login'),
  logoutBtn:           document.getElementById('btn-logout'),
  userWelcome:         document.getElementById('user-welcome'),
  bookingEmail:        document.getElementById('bk-email'),
  lightbox:            document.getElementById('lightbox'),
  lightboxImg:         document.getElementById('lightbox-img'),
  lightboxClose:       document.getElementById('lightbox-close'),
  lightboxPrev:        document.getElementById('lightbox-prev'),
  lightboxNext:        document.getElementById('lightbox-next'),
  lightboxCounter:     document.getElementById('lightbox-counter'),
};

// ── Photo Cache (avoids Firestore composite-index requirement) ──
let cachedPhotos = [];
let lightboxImages = [];
let lightboxIndex = 0;

// ── Mobile Nav ──────────────────────────────────────
if (elements.menuBtn) {
  elements.menuBtn.addEventListener('click', () => {
    elements.navMenu.classList.toggle('show');
  });
  // Close nav when a link is clicked
  elements.navMenu?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => elements.navMenu.classList.remove('show'));
  });
}

// ── Sticky Header ───────────────────────────────────
window.addEventListener('scroll', () => {
  const header = document.getElementById('main-header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 80);
});

// ── Load Website Config from Firestore ─────────────
async function loadWebsiteConfig() {
  try {
    const snap = await getDocs(collection(db, "settings"));
    if (!snap.empty) {
      const data = snap.docs[0].data();

      if (data.heroTitle)    document.getElementById('dyn-hero-title').innerText   = data.heroTitle;
      if (data.heroSubtitle) document.getElementById('dyn-hero-subtitle').innerText = data.heroSubtitle;
      if (data.footerText)   document.getElementById('dyn-footer-text').innerHTML   = data.footerText;

      // Contact section
      if (data.phone) {
        document.getElementById('det-phone').innerText = data.phone;
        const qp = document.getElementById('bk-quick-phone');
        if (qp) qp.innerText = data.phone;
      }
      if (data.email) {
        document.getElementById('det-email').innerText = data.email;
        const qe = document.getElementById('bk-quick-email');
        if (qe) qe.innerText = data.email;
      }

      // Social icons
      const socialHtml = `
        <a href="${data.facebook  || '#'}" target="_blank" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="${data.instagram || '#'}" target="_blank" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
        <a href="https://wa.me/${data.whatsapp || ''}" target="_blank" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
      `;
      const contactSocials = document.getElementById('det-socials');
      const footerSocials  = document.getElementById('footer-socials');
      if (contactSocials) contactSocials.innerHTML = socialHtml;
      if (footerSocials)  footerSocials.innerHTML  = socialHtml;
    }
  } catch (err) {
    // Settings read failed — likely Firestore rules. Defaults from HTML remain.
    console.warn("Could not load site settings:", err.message);
  }
}

// ── Category Cards ──────────────────────────────────
function renderCategoryDeck() {
  if (!elements.categoriesContainer) return;
  elements.categoriesContainer.innerHTML = AVAILABLE_CATEGORIES.map(cat => `
    <div class="category-card" data-category="${cat}">
      <img
        src="${CATEGORY_IMAGES[cat]}"
        alt="${cat}"
        class="skeleton"
        loading="lazy"
        onload="this.classList.remove('skeleton')"
      >
      <div class="category-info">
        <h3>${cat}</h3>
        <span>View Collection →</span>
      </div>
    </div>
  `).join('');

  elements.categoriesContainer.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.getAttribute('data-category');
      document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => fetchPortfolioGallery(cat), 400);
    });
  });
}

// ── Gallery Filter Tabs ─────────────────────────────
function renderGalleryFilters() {
  if (!elements.galleryFilters) return;

  // "All" button already in HTML
  elements.galleryFilters.querySelector('[data-filter="all"]')
    ?.addEventListener('click', () => fetchPortfolioGallery(null));

  AVAILABLE_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.setAttribute('data-filter', cat);
    btn.textContent = cat;
    btn.addEventListener('click', () => fetchPortfolioGallery(cat));
    elements.galleryFilters.appendChild(btn);
  });
}

// ── Gallery Load ────────────────────────────────────
// FIX: All photos are fetched once and filtered client-side.
// This avoids the Firestore composite index requirement for
// where("category")+orderBy("createdAt") queries.
async function fetchPortfolioGallery(categoryFilter = null) {
  if (!elements.galleryContainer) return;

  // Update active filter button
  elements.galleryFilters?.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === (categoryFilter || 'all'));
  });

  elements.galleryTitle.innerText = categoryFilter
    ? `${categoryFilter} Portfolio`
    : "All Photographs";

  elements.galleryContainer.innerHTML = '<div class="gallery-empty"><div class="spinner"></div></div>';

  try {
    // Fetch from Firestore only once, then cache
    if (cachedPhotos.length === 0) {
      const q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      cachedPhotos = snapshot.docs.map(d => d.data());
    }

    const photos = categoryFilter
      ? cachedPhotos.filter(p => p.category === categoryFilter)
      : cachedPhotos;

    elements.galleryContainer.innerHTML = '';

    if (photos.length === 0) {
      elements.galleryContainer.innerHTML = `
        <div class="gallery-empty" style="padding:80px; text-align:center; width:100%;">
          <i class="fa fa-images" style="font-size:2rem; color:var(--accent); margin-bottom:14px; display:block;"></i>
          <p style="color:var(--text-muted);">No photographs found in this category yet.</p>
        </div>`;
      return;
    }

    lightboxImages = photos.map(p => p.imageUrl);

    photos.forEach((photo, idx) => {
      const item = document.createElement('div');
      item.className = 'masonry-item';
      item.innerHTML = `<img src="${photo.imageUrl}" alt="${photo.category}" loading="lazy">`;
      item.addEventListener('click', () => openLightbox(idx));
      elements.galleryContainer.appendChild(item);
    });

  } catch (err) {
    console.error("Gallery load error:", err);
    elements.galleryContainer.innerHTML = `
      <div class="gallery-empty" style="padding:80px; text-align:center; width:100%;">
        <i class="fa fa-exclamation-circle" style="font-size:2rem; color:var(--accent); margin-bottom:14px; display:block;"></i>
        <p style="color:var(--text-muted); margin-bottom:8px;">Gallery could not be loaded.</p>
        <p style="color:var(--text-muted); font-size:0.8rem;">
          Check Firebase Console → Firestore → Rules and make sure photos collection allows public reads.
        </p>
      </div>`;
  }
}

// ── Lightbox ────────────────────────────────────────
function openLightbox(index) {
  lightboxIndex = index;
  elements.lightboxImg.src = lightboxImages[index];
  elements.lightbox?.classList.add('active');
  updateLightboxCounter();
}

function updateLightboxCounter() {
  if (elements.lightboxCounter) {
    elements.lightboxCounter.textContent =
      `${lightboxIndex + 1} / ${lightboxImages.length}`;
  }
}

elements.lightboxClose?.addEventListener('click', () => {
  elements.lightbox?.classList.remove('active');
});
elements.lightbox?.addEventListener('click', e => {
  if (e.target === elements.lightbox) elements.lightbox.classList.remove('active');
});
elements.lightboxPrev?.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  elements.lightboxImg.src = lightboxImages[lightboxIndex];
  updateLightboxCounter();
});
elements.lightboxNext?.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  elements.lightboxImg.src = lightboxImages[lightboxIndex];
  updateLightboxCounter();
});
// Keyboard navigation
document.addEventListener('keydown', e => {
  if (!elements.lightbox?.classList.contains('active')) return;
  if (e.key === 'Escape')     elements.lightbox.classList.remove('active');
  if (e.key === 'ArrowLeft')  elements.lightboxPrev?.click();
  if (e.key === 'ArrowRight') elements.lightboxNext?.click();
});

// ── Slideshow ────────────────────────────────────────
async function initSlideshowCarousel() {
  if (!elements.slideshow) return;
  try {
    const q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(8));
    const snap = await getDocs(q);

    document.getElementById('slideshow-loader')?.remove();

    if (snap.empty) {
      elements.slideshow.style.display = "none";
      document.querySelector('.slideshow-wrap')?.style && (document.querySelector('.slideshow-wrap').style.display = 'none');
      return;
    }

    let idx = 0;
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = `slide${idx === 0 ? ' active' : ''}`;
      div.style.backgroundImage = `url('${data.imageUrl}')`;
      elements.slideshow.appendChild(div);
      idx++;
    });

    const slides = elements.slideshow.querySelectorAll('.slide');
    const dotsContainer = elements.slideshowDots;

    // Create dots
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = `slideshow-dot${i === 0 ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer?.appendChild(dot);
    });

    let currentSlide = 0;
    function goToSlide(n) {
      slides[currentSlide].classList.remove('active');
      dotsContainer?.children[currentSlide]?.classList.remove('active');
      currentSlide = n;
      slides[currentSlide].classList.add('active');
      dotsContainer?.children[currentSlide]?.classList.add('active');
    }

    if (slides.length > 1) {
      setInterval(() => goToSlide((currentSlide + 1) % slides.length), 4000);
    }

  } catch (e) {
    console.error("Slideshow error:", e);
    document.querySelector('.slideshow-wrap')?.remove();
  }
}

// ── Stat Counter Animation ──────────────────────────
function animateCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.getAttribute('data-target')) || 0;
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        el.textContent = target.toLocaleString();
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current).toLocaleString();
      }
    }, duration / steps);
  });
}

// Trigger counters when stats bar enters viewport
const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
const statsBar = document.querySelector('.stats-bar');
if (statsBar) statsObserver.observe(statsBar);

// ── Scroll Reveal ────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('revealed');
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.scroll-reveal').forEach(el => revealObserver.observe(el));

// ── Auth State ───────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    if (elements.authPanel)    elements.authPanel.style.display    = "none";
    if (elements.bookingForm)  elements.bookingForm.style.display  = "block";
    if (elements.userWelcome)  elements.userWelcome.innerText       = `Booking as: ${user.displayName || user.email}`;
    if (elements.bookingEmail) elements.bookingEmail.value          = user.email;
  } else {
    if (elements.authPanel)   elements.authPanel.style.display    = "block";
    if (elements.bookingForm) elements.bookingForm.style.display  = "none";
  }
});

elements.loginBtn?.addEventListener('click', () => {
  signInWithPopup(auth, googleProvider).catch(e => alert("Google sign-in failed: " + e.message));
});
elements.logoutBtn?.addEventListener('click', () => signOut(auth));

// ── Booking Form Submit ──────────────────────────────
const bForm = document.getElementById('booking-form');
if (bForm) {
  bForm.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = bForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;

    const payload = {
      name:      document.getElementById('bk-name').value,
      phone:     document.getElementById('bk-phone').value,
      email:     elements.bookingEmail.value,
      eventType: document.getElementById('bk-type').value,
      date:      document.getElementById('bk-date').value,
      location:  document.getElementById('bk-location').value,
      notes:     document.getElementById('bk-notes').value || '',
      status:    "Pending",
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "bookings"), payload);
      submitBtn.innerHTML = '<i class="fa fa-check"></i> Booking Submitted!';
      submitBtn.style.background = '#2ecc71';
      submitBtn.style.borderColor = '#2ecc71';
      submitBtn.style.color = '#000';
      setTimeout(() => {
        bForm.reset();
        elements.bookingEmail.value = auth.currentUser?.email || '';
        submitBtn.innerHTML = originalText;
        submitBtn.style.cssText = '';
        submitBtn.disabled = false;
      }, 3000);
    } catch (err) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      // FIX: descriptive error that hints at Firestore rules if permission denied
      if (err.code === 'permission-denied') {
        alert("Booking failed: Firestore rules are blocking writes.\n\nGo to Firebase Console → Firestore → Rules and allow authenticated users to create bookings.");
      } else {
        alert("Booking submission failed: " + err.message);
      }
    }
  });
}

// ── Init ─────────────────────────────────────────────
loadWebsiteConfig();
renderCategoryDeck();
renderGalleryFilters();
fetchPortfolioGallery();
initSlideshowCarousel();
