/* ============================================================
   HAIRBEY — Etkileşim & Animasyonlar
   Saf vanilla JS, harici bağımlılık yok.
============================================================ */
(function () {
  "use strict";

  /* İşletme bilgisi — değiştirmek isterseniz tek yerden güncelleyin */
  var WHATSAPP_NUMBER = "905350454736"; // uluslararası format (ülke kodu + numara)

  /* --------------------------------------------------------
     1) Sticky navbar — scroll'da küçülür / cam efekti
  -------------------------------------------------------- */
  var navbar = document.getElementById("navbar");
  function onScroll() {
    if (window.scrollY > 40) navbar.classList.add("scrolled");
    else navbar.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --------------------------------------------------------
     2) Mobil hamburger menü
  -------------------------------------------------------- */
  var hamburger = document.getElementById("hamburger");
  var navLinks = document.getElementById("navLinks");

  function closeMenu() {
    hamburger.classList.remove("open");
    navLinks.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  }
  hamburger.addEventListener("click", function () {
    var open = navLinks.classList.toggle("open");
    hamburger.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", String(open));
  });
  // Menü linkine tıklayınca kapat
  navLinks.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });

  /* --------------------------------------------------------
     3) Scroll-reveal — bölümler görünür oldukça belirir
  -------------------------------------------------------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // Eski tarayıcı: hepsini göster
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* --------------------------------------------------------
     4) Scroll-spy — aktif menü linkini vurgula
  -------------------------------------------------------- */
  var sections = document.querySelectorAll("section[id]");
  var linkMap = {};
  document.querySelectorAll(".nav-link").forEach(function (link) {
    var id = link.getAttribute("href").replace("#", "");
    linkMap[id] = link;
  });
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var link = linkMap[entry.target.id];
            if (!link) return;
            Object.keys(linkMap).forEach(function (k) { linkMap[k].classList.remove("active"); });
            link.classList.add("active");
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* --------------------------------------------------------
     5) Sayaç animasyonu (Hakkımızda istatistikleri)
  -------------------------------------------------------- */
  var counters = document.querySelectorAll(".stat-num");
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString("tr-TR");
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && counters.length) {
    var counterIO = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (c) { counterIO.observe(c); });
  }

  /* --------------------------------------------------------
     6) Randevu formu — WhatsApp'a yönlendir + dolu/geçmiş saat kontrolü

     NOT: Bu statik bir sitedir (sunucu yok). "Dolu" bilgisi tarayıcıda
     localStorage ile saklanır; yani bu cihazda alınan randevular dolu
     görünür. Tüm cihazlarda ortak (gerçek) dolu/boş takibi için backend
     gerekir — README'ye bakın.
  -------------------------------------------------------- */
  var form = document.getElementById("randevuForm");
  var errorBox = document.getElementById("formError");
  var tarihInput = document.getElementById("tarih");
  var saatSelect = document.getElementById("saat");

  // Açık olduğumuz saat aralığı (çalışma saatlerine göre düzenleyebilirsiniz)
  var TIME_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00",
                    "15:00","16:00","17:00","18:00","19:00","20:00"];
  var STORAGE_KEY = "hairbey_dolu_randevular";

  // --- Yerel saate göre tarih yardımcıları (UTC kaymasını önler) ---
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function toLocalDateStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function todayStr() { return toLocalDateStr(new Date()); }
  function nowHHMM() {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // --- localStorage: dolu randevular { "2026-06-20": ["10:00", ...] } ---
  function getBooked() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function isBooked(date, time) {
    var all = getBooked();
    return Array.isArray(all[date]) && all[date].indexOf(time) !== -1;
  }
  function addBooked(date, time) {
    var all = getBooked();
    if (!Array.isArray(all[date])) all[date] = [];
    if (all[date].indexOf(time) === -1) all[date].push(time);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) {}
  }

  // --- Seçilen tarihe göre saat listesini yeniden oluştur ---
  function rebuildSlots() {
    var date = tarihInput.value;
    saatSelect.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = date ? "Saat seçin" : "Önce tarih seçin";
    saatSelect.appendChild(placeholder);

    if (!date) return;

    var isToday = date === todayStr();
    var current = nowHHMM();

    TIME_SLOTS.forEach(function (slot) {
      var opt = document.createElement("option");
      opt.value = slot;
      var label = slot;
      var disabled = false;

      if (isBooked(date, slot)) { disabled = true; label += " — Dolu"; }
      else if (isToday && slot <= current) { disabled = true; label += " — Geçti"; }

      opt.textContent = label;
      opt.disabled = disabled;
      saatSelect.appendChild(opt);
    });
  }

  if (tarihInput && saatSelect) {
    tarihInput.min = todayStr();                 // takvimde geçmiş günler kapalı
    tarihInput.addEventListener("change", function () {
      errorBox.style.color = "";
      errorBox.textContent = "";
      // Geçmiş bir tarih elle yazılırsa engelle
      if (tarihInput.value && tarihInput.value < todayStr()) {
        errorBox.textContent = "Geçmiş bir tarih seçilemez. Lütfen bugün veya ileri bir tarih seçin.";
        tarihInput.value = "";
      }
      rebuildSlots();
    });
    rebuildSlots();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorBox.style.color = "";
    errorBox.textContent = "";

    var ad = form.ad.value.trim();
    var telefon = form.telefon.value.trim();
    var hizmet = form.hizmet.value;
    var tarih = form.tarih.value;
    var saat = form.saat.value;
    var notu = form["not"].value.trim();

    // Doğrulama
    if (!ad || !telefon || !hizmet || !tarih || !saat) {
      errorBox.textContent = "Lütfen ad, telefon, hizmet, tarih ve saat alanlarını doldurun.";
      return;
    }
    // Telefon: rakamları say (Türkiye için 10-11 hane bekleriz)
    var digits = telefon.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      errorBox.textContent = "Lütfen geçerli bir telefon numarası girin (örn. 05XX XXX XX XX).";
      return;
    }
    if (tarih < todayStr()) {
      errorBox.textContent = "Geçmiş bir tarih seçilemez. Lütfen bugün veya ileri bir tarih seçin.";
      return;
    }
    if (tarih === todayStr() && saat <= nowHHMM()) {
      errorBox.textContent = "Geçmiş bir saat seçilemez. Lütfen ileri bir saat seçin.";
      rebuildSlots();
      return;
    }
    if (isBooked(tarih, saat)) {
      errorBox.textContent = "Bu saat dolu. Lütfen başka bir saat seçin.";
      rebuildSlots();
      return;
    }

    // Tarihi okunaklı biçime çevir (gg.aa.yyyy)
    var tarihStr = tarih.split("-").reverse().join(".");

    // WhatsApp mesajını oluştur
    var lines = [
      "Merhaba Hairbey, randevu almak istiyorum.",
      "",
      "👤 Ad Soyad: " + ad,
      "📞 Telefon: " + telefon,
      "✂️ Hizmet: " + hizmet,
      "📅 Tarih: " + tarihStr,
      "⏰ Saat: " + saat
    ];
    if (notu) lines.push("📝 Not: " + notu);

    var message = encodeURIComponent(lines.join("\n"));
    var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + message;

    window.open(url, "_blank", "noopener");

    // Bu saati "dolu" olarak işaretle ve listeyi güncelle
    addBooked(tarih, saat);
    rebuildSlots();
    errorBox.style.color = "#7ee08a";
    errorBox.textContent = "Randevu talebiniz WhatsApp'ta açıldı. Bu saat artık dolu olarak işaretlendi.";
  });

  /* --------------------------------------------------------
     7) Footer yılı otomatik güncelle
  -------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
