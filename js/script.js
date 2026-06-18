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
     6) Randevu formu — WhatsApp'a yönlendir
  -------------------------------------------------------- */
  var form = document.getElementById("randevuForm");
  var errorBox = document.getElementById("formError");

  // Tarih alanı için bugünden öncesini engelle
  var tarihInput = document.getElementById("tarih");
  if (tarihInput) {
    var today = new Date().toISOString().split("T")[0];
    tarihInput.min = today;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
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
    if (tarih < new Date().toISOString().split("T")[0]) {
      errorBox.textContent = "Lütfen bugün veya ileri bir tarih seçin.";
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
  });

  /* --------------------------------------------------------
     7) Footer yılı otomatik güncelle
  -------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
