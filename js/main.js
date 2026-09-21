const header = document.querySelector('#site-header');
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');

const steamCanvas = document.querySelector('.steam-canvas');
const hero = document.querySelector('.hero');
if (steamCanvas && hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const context = steamCanvas.getContext('2d');
  const particles = [];
  let animationFrame;
  let width = 0;
  let height = 0;
  let density = 0;

  const resizeCanvas = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    steamCanvas.width = width * ratio;
    steamCanvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    density = Math.max(18, Math.round(width / 55));
  };

  const createParticle = (startAtBottom = false) => ({
    x: Math.random() * width,
    y: startAtBottom ? height + Math.random() * 30 : Math.random() * height,
    radius: 10 + Math.random() * 24,
    speed: .08 + Math.random() * .18,
    drift: (Math.random() - .5) * .18,
    phase: Math.random() * Math.PI * 2,
    opacity: .025 + Math.random() * .055
  });

  const drawSteam = (timestamp) => {
    context.clearRect(0, 0, width, height);
    if (particles.length < density) particles.push(createParticle(true));

    particles.forEach((particle, index) => {
      particle.y -= particle.speed;
      particle.x += Math.sin(timestamp * .00035 + particle.phase) * particle.drift;

      const gradient = context.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius
      );
      gradient.addColorStop(0, `rgba(255, 244, 239, ${particle.opacity})`);
      gradient.addColorStop(1, 'rgba(255, 244, 239, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();

      if (particle.y < -particle.radius * 2) particles[index] = createParticle(true);
    });

    animationFrame = window.requestAnimationFrame(drawSteam);
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  animationFrame = window.requestAnimationFrame(drawSteam);
  window.addEventListener('beforeunload', () => window.cancelAnimationFrame(animationFrame));
}

const savedTheme = localStorage.getItem('zui-theme');
if (savedTheme === 'light') {
  document.documentElement.dataset.theme = 'light';
}

function updateThemeControls() {
  const isLight = document.documentElement.dataset.theme === 'light';
  document.querySelectorAll('.theme-toggle').forEach((control) => {
    control.setAttribute('aria-pressed', String(isLight));
    control.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    const label = control.querySelector('.theme-toggle-label');
    if (label) label.textContent = isLight ? 'Dark theme' : 'Light theme';
    const icon = control.querySelector('[aria-hidden="true"]');
    if (icon) icon.textContent = isLight ? '☾' : '☼';
  });
}

document.querySelectorAll('.theme-toggle').forEach((control) => {
  control.addEventListener('click', () => {
    const isLight = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
    localStorage.setItem('zui-theme', isLight ? 'light' : 'dark');
    updateThemeControls();
  });
});
updateThemeControls();

if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  mobileMenu.setAttribute('aria-hidden', String(!open));
  mobileMenu.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const cuisineData = {
  Japan: {
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=85',
    title: 'Precision, restraint, depth.'
  },
  Thailand: {
    image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=1200&q=85',
    title: 'Brightness, balance, energy.'
  },
  Vietnam: {
    image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1200&q=85',
    title: 'Freshness, texture, soul.'
  },
  Korea: {
    image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1200&q=85',
    title: 'Smoke, ferment, fire.'
  }
};

document.querySelectorAll('.journey-tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    const cuisine = cuisineData[button.dataset.cuisine];
    document.querySelectorAll('.journey-tabs button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const image = document.querySelector('#cuisine-image');
    image.style.opacity = '0.2';
    window.setTimeout(() => {
      image.src = cuisine.image;
      image.alt = `${button.dataset.cuisine}-inspired dish`;
      document.querySelector('#cuisine-label').textContent = `0${Object.keys(cuisineData).indexOf(button.dataset.cuisine) + 1} / ${button.dataset.cuisine}`;
      document.querySelector('#cuisine-title').textContent = cuisine.title;
      image.style.opacity = '1';
    }, 180);
  });
});

const menuList = document.querySelector('#menu-list');
const menuTabs = document.querySelectorAll('.menu-tabs button');
const menuData = {
  'Small plates': [
    ['Charred edamame', 'Smoked salt, lime leaf, sesame.'],
    ['Hand-folded dumplings', 'Seasonal filling, black vinegar, chilli crisp.'],
    ['King oyster mushroom', 'Green curry, crispy shallot, Thai basil.'],
    ['Seasonal sashimi', 'Market selection, ponzu, fresh wasabi.']
  ],
  Robata: [
    ['Miso-glazed aubergine', 'Sesame, spring onion, toasted rice.'],
    ['Charred chicken thigh', 'Yuzu kosho, shiso, smoked soy.'],
    ['Robata prawns', 'Tamarind glaze, coriander, lime.'],
    ['King oyster skewers', 'Burnt butter, chilli, crispy garlic.']
  ],
  'Wok & curry': [
    ['Wok-tossed noodles', 'Citrus, greens, toasted sesame, chilli.'],
    ['Thai green curry', 'Seasonal vegetables, coconut, Thai basil.'],
    ['Black pepper beef', 'Onion, peppercorn, fermented soy.'],
    ['Crispy rice bowl', 'Pickles, herbs, roasted mushrooms.']
  ],
  Dessert: [
    ['Miso caramel cheesecake', 'Sesame brittle, black sugar.'],
    ['Coconut pandan pudding', 'Mango, lime, toasted coconut.'],
    ['Matcha chocolate fondant', 'Matcha cream, cacao nib.'],
    ['Seasonal fruit', 'Coconut sorbet, ginger syrup.']
  ],
  Drinks: [
    ['YUWI spritz', 'Citrus, jasmine, sparkling tea.'],
    ['Lychee highball', 'Lychee, shiso, soda, vodka.'],
    ['Ginger old fashioned', 'Bourbon, ginger, toasted spice.'],
    ['Zero-proof umami tonic', 'Yuzu, herbs, tonic, sea salt.']
  ]
};

function renderMenu(category) {
  if (!menuList) return;
  menuList.setAttribute('aria-label', `${category} menu`);
  menuList.innerHTML = menuData[category].map(([name, description]) => `
    <article class="menu-item">
      <div><span>${category}</span><h2>${name}</h2><p>${description}</p></div>
      <strong>[Price]</strong>
    </article>
  `).join('');
}

if (menuList) {
  renderMenu('Small plates');
  menuTabs.forEach((button) => {
    button.addEventListener('click', () => {
      menuTabs.forEach((tab) => {
        tab.classList.toggle('active', tab === button);
        tab.setAttribute('aria-selected', String(tab === button));
      });
      renderMenu(button.dataset.category);
    });
  });
}

function bindDishTilt(cards) {
  cards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 12;
      const rotateX = (0.5 - py) * 12;

      card.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`);
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

bindDishTilt(document.querySelectorAll('.dish-card'));

function bindCardTilt(selector) {
  document.querySelectorAll(selector).forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 12;
      const rotateX = (0.5 - py) * 12;

      card.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`);
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

bindCardTilt('.intro-media, .journey-image, .story-image, .gallery-grid img');

const signatureDishes = document.querySelector('#signature-dishes');
if (signatureDishes && !signatureDishes.dataset.duplicated) {
  const cards = Array.from(signatureDishes.children);
  cards.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.remove('reveal');
    clone.classList.add('signature-duplicate');
    clone.querySelectorAll('img').forEach((image) => image.setAttribute('alt', ''));
    signatureDishes.appendChild(clone);
  });
  signatureDishes.dataset.duplicated = 'true';
  bindDishTilt(signatureDishes.querySelectorAll('.dish-card'));
}

if (signatureDishes) {
  let lastTimestamp = performance.now();
  let timerId;
  const scrollSpeed = 28;
  const firstDuplicate = signatureDishes.querySelector('.signature-duplicate');

  function advanceSignatureDishes() {
    const timestamp = performance.now();
    const elapsed = Math.min(timestamp - lastTimestamp, 50);
    lastTimestamp = timestamp;
    const railRect = signatureDishes.getBoundingClientRect();
    const duplicateRect = firstDuplicate?.getBoundingClientRect();
    const loopPoint = duplicateRect
      ? duplicateRect.left - railRect.left + signatureDishes.scrollLeft
      : signatureDishes.scrollWidth / 2;

    if (!signatureDishes.matches(':hover') && loopPoint > 0 && signatureDishes.scrollWidth > signatureDishes.clientWidth) {
      signatureDishes.scrollLeft += (scrollSpeed * elapsed) / 1000;
      if (signatureDishes.scrollLeft >= loopPoint) {
        signatureDishes.scrollLeft -= loopPoint;
      }
    }
  }

  timerId = window.setInterval(advanceSignatureDishes, 16);
  window.addEventListener('beforeunload', () => window.clearInterval(timerId));
}

const reservationForm = document.querySelector('#reservation-form');
if (reservationForm) {
  const dateInput = reservationForm.querySelector('#reservation-date');
  const datePicker = reservationForm.querySelector('#reservation-date-picker');
  const calendarButton = reservationForm.querySelector('#calendar-button');
  const dateValueInput = reservationForm.querySelector('#reservation-date-value');
  const timeSelect = reservationForm.querySelector('#reservation-time');
  const today = new Date();
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
  function getIsoDate(displayDate) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(displayDate);
    if (!match) return '';
    const [, day, month, year] = match;
    const candidate = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      candidate.getFullYear() !== Number(year) ||
      candidate.getMonth() !== Number(month) - 1 ||
      candidate.getDate() !== Number(day)
    ) {
      return '';
    }
    return `${year}-${month}-${day}`;
  }

  function updateAvailableTimes() {
    const selectedDate = getIsoDate(dateInput.value);
    dateValueInput.value = dateInput.value || '';
    const isToday = selectedDate === localDate;
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    Array.from(timeSelect.options).forEach((option) => {
      if (!option.value) return;
      const [hours, minutes] = option.value.split(':').map(Number);
      option.disabled = isToday && (hours * 60 + minutes) <= currentMinutes;
    });
    if (timeSelect.selectedOptions[0]?.disabled) {
      timeSelect.value = '';
    }
  }

  dateInput.addEventListener('change', updateAvailableTimes);
  dateInput.addEventListener('input', updateAvailableTimes);
  datePicker.min = localDate;
  calendarButton.addEventListener('click', () => {
    if (typeof datePicker.showPicker === 'function') {
      datePicker.showPicker();
    } else {
      datePicker.focus();
      datePicker.click();
    }
  });
  function syncNativeDate() {
    const [year, month, day] = datePicker.value.split('-');
    dateInput.value = datePicker.value ? `${day}/${month}/${year}` : '';
    updateAvailableTimes();
  }
  datePicker.addEventListener('change', syncNativeDate);
  datePicker.addEventListener('input', syncNativeDate);
  updateAvailableTimes();

  reservationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#reservation-status');
    const submitButton = reservationForm.querySelector('button[type="submit"]');

    if (!reservationForm.reportValidity()) {
      return;
    }

    updateAvailableTimes();
    const selectedDate = getIsoDate(dateInput.value);
    dateValueInput.value = dateInput.value;
    if (!selectedDate) {
      dateInput.setCustomValidity('Please enter a valid date in dd/mm/yyyy format.');
      dateInput.reportValidity();
      dateInput.setCustomValidity('');
      return;
    }
    if (selectedDate < localDate) {
      dateInput.setCustomValidity('Please select today or a future date.');
      dateInput.reportValidity();
      dateInput.setCustomValidity('');
      return;
    }
    if (!timeSelect.value || timeSelect.selectedOptions[0]?.disabled) {
      timeSelect.setCustomValidity('Please select a future available time.');
      timeSelect.reportValidity();
      timeSelect.setCustomValidity('');
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    status.textContent = 'Sending your request directly to ZUII…';
    status.classList.add('is-visible');

    try {
      const reservationPayload = Object.fromEntries(new FormData(reservationForm));
      // The API stores the display date format: dd/mm/yyyy.
      reservationPayload.date = dateInput.value;
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationPayload)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to send the reservation request.');
      }

      status.textContent = `Request received by ZUII. Reference: ${result.reference}`;
      reservationForm.reset();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('is-error');
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
    }
  });
}
