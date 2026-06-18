/* ============================================================
   HAIRBEY — Yönetici Paneli
   Randevuları listeler; onaylar, iptal eder, erteler veya siler.
   Her işlemde müşteriye uygun WhatsApp bildirimi açılır.
============================================================ */
(function () {
  "use strict";

  var SS_KEY = "hairbey_admin_pass";
  var SS_EMAIL = "hairbey_admin_email";
  var TIME_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00",
                    "15:00","16:00","17:00","18:00","19:00","20:00"];

  var loginView = document.getElementById("loginView");
  var panelView = document.getElementById("panelView");
  var loginForm = document.getElementById("loginForm");
  var adminEmail = document.getElementById("adminEmail");
  var adminPass = document.getElementById("adminPass");
  var loginError = document.getElementById("loginError");
  var logoutBtn = document.getElementById("logoutBtn");
  var apptList = document.getElementById("apptList");
  var panelStatus = document.getElementById("panelStatus");
  var statusFilter = document.getElementById("statusFilter");
  var refreshBtn = document.getElementById("refreshBtn");

  var STATUS_TR = { pending: "Beklemede", confirmed: "Onaylı", cancelled: "İptal" };

  function getPass() { try { return sessionStorage.getItem(SS_KEY) || ""; } catch (e) { return ""; } }
  function getEmail() { try { return sessionStorage.getItem(SS_EMAIL) || ""; } catch (e) { return ""; } }
  function setCreds(email, pass) {
    try { sessionStorage.setItem(SS_EMAIL, email); sessionStorage.setItem(SS_KEY, pass); } catch (e) {}
  }
  function clearPass() {
    try { sessionStorage.removeItem(SS_KEY); sessionStorage.removeItem(SS_EMAIL); } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers["x-admin-email"] = getEmail();
    opts.headers["x-admin-password"] = getPass();
    return fetch(path, opts);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function trDate(iso) { return iso ? iso.split("-").reverse().join(".") : ""; }

  // Telefonu uluslararası WhatsApp biçimine çevir (90XXXXXXXXXX)
  function waNumber(t) {
    var d = (t || "").replace(/\D/g, "");
    if (d.indexOf("90") === 0 && d.length === 12) return d;
    if (d.indexOf("0") === 0) d = d.slice(1);
    if (d.length === 10) return "90" + d;
    return d;
  }
  function openCustomerWhatsApp(appt, message) {
    var url = "https://wa.me/" + waNumber(appt.telefon) + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener");
  }

  /* ---------------- Giriş ---------------- */
  function showPanel() {
    loginView.hidden = true;
    panelView.hidden = false;
    logoutBtn.hidden = false;
    loadAppointments();
  }
  function showLogin(msg) {
    loginView.hidden = false;
    panelView.hidden = true;
    logoutBtn.hidden = true;
    if (msg) loginError.textContent = msg;
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.textContent = "";
    var em = adminEmail.value.trim();
    var p = adminPass.value.trim();
    if (!em || !p) { loginError.textContent = "Lütfen e-posta ve şifre girin."; return; }
    setCreds(em, p);
    // Doğrulama: liste isteği at, 401 ise e-posta/şifre yanlış
    api("/api/admin/appointments").then(function (r) {
      if (r.status === 401) { clearPass(); loginError.textContent = "E-posta veya şifre hatalı."; return; }
      if (!r.ok) { loginError.textContent = "Sunucuya ulaşılamadı. Site Netlify'da yayında mı?"; return; }
      showPanel();
    }).catch(function () {
      loginError.textContent = "Sunucuya ulaşılamadı. Backend yayında olmalı (Netlify Functions).";
    });
  });

  logoutBtn.addEventListener("click", function () { clearPass(); showLogin(""); });
  refreshBtn.addEventListener("click", loadAppointments);
  statusFilter.addEventListener("change", render);

  /* ---------------- Veri ---------------- */
  var allItems = [];

  function loadAppointments() {
    panelStatus.textContent = "Yükleniyor...";
    api("/api/admin/appointments").then(function (r) {
      if (r.status === 401) { clearPass(); showLogin("Oturum sona erdi, tekrar giriş yapın."); return; }
      return r.json();
    }).then(function (data) {
      if (!data) return;
      allItems = data.items || [];
      render();
    }).catch(function () {
      panelStatus.textContent = "Randevular yüklenemedi.";
    });
  }

  function render() {
    var filter = statusFilter.value;
    var items = allItems.filter(function (a) { return filter === "all" || a.status === filter; });

    panelStatus.textContent = items.length + " randevu";
    apptList.innerHTML = "";

    if (!items.length) {
      apptList.innerHTML = '<p class="admin-empty">Gösterilecek randevu yok.</p>';
      return;
    }

    items.forEach(function (a) {
      apptList.appendChild(renderCard(a));
    });
  }

  function renderCard(a) {
    var card = document.createElement("article");
    card.className = "appt-card status-" + a.status;

    card.innerHTML =
      '<div class="appt-top">' +
        '<div class="appt-when"><strong>' + trDate(a.tarih) + '</strong><span>' + esc(a.saat) + '</span></div>' +
        '<span class="appt-badge badge-' + a.status + '">' + (STATUS_TR[a.status] || a.status) + '</span>' +
      '</div>' +
      '<div class="appt-info">' +
        '<div><span class="lbl">Müşteri</span>' + esc(a.ad) + '</div>' +
        '<div><span class="lbl">Telefon</span><a href="tel:' + esc(a.telefon) + '">' + esc(a.telefon) + '</a></div>' +
        '<div><span class="lbl">Hizmet</span>' + esc(a.hizmet) + '</div>' +
        (a.not ? '<div><span class="lbl">Not</span>' + esc(a.not) + '</div>' : '') +
      '</div>';

    // İşlem butonları
    var actions = document.createElement("div");
    actions.className = "appt-actions";

    if (a.status !== "confirmed") {
      actions.appendChild(makeBtn("Onayla", "btn-approve", function () { confirmAppt(a); }));
    }
    if (a.status !== "cancelled") {
      actions.appendChild(makeBtn("İptal Et", "btn-cancel", function () { cancelAppt(a); }));
    }
    actions.appendChild(makeBtn("Ertele", "btn-reschedule", function () { toggleReschedule(card, a); }));
    actions.appendChild(makeBtn("Sil", "btn-delete", function () { deleteAppt(a); }));
    card.appendChild(actions);

    // Ertele paneli (gizli)
    var rb = document.createElement("div");
    rb.className = "reschedule-box";
    rb.hidden = true;
    rb.innerHTML =
      '<input type="date" class="rs-date" value="' + esc(a.tarih) + '" />' +
      '<select class="rs-time">' +
        TIME_SLOTS.map(function (s) {
          return '<option' + (s === a.saat ? ' selected' : '') + '>' + s + '</option>';
        }).join("") +
      '</select>';
    var saveBtn = makeBtn("Kaydet & Bildir", "btn-approve", function () {
      var nd = rb.querySelector(".rs-date").value;
      var nt = rb.querySelector(".rs-time").value;
      rescheduleAppt(a, nd, nt);
    });
    rb.appendChild(saveBtn);
    card.appendChild(rb);

    return card;
  }

  function makeBtn(text, cls, fn) {
    var b = document.createElement("button");
    b.className = "appt-btn " + cls;
    b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }

  function toggleReschedule(card, a) {
    var box = card.querySelector(".reschedule-box");
    box.hidden = !box.hidden;
  }

  /* ---------------- İşlemler ---------------- */
  function patch(id, body) {
    return api("/api/admin/appointments/" + id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (b) { return { status: r.status, body: b }; });
    });
  }

  function confirmAppt(a) {
    patch(a.id, { status: "confirmed" }).then(function (res) {
      if (res.status !== 200) { alert(res.body.error || "İşlem başarısız."); return; }
      openCustomerWhatsApp(a,
        "Merhaba " + a.ad + ", " + trDate(a.tarih) + " " + a.saat +
        " için Hairbey randevunuz ONAYLANMIŞTIR. ✅ Sizi bekliyoruz!");
      loadAppointments();
    });
  }

  function cancelAppt(a) {
    if (!confirm(a.ad + " adlı randevuyu iptal etmek istediğinize emin misiniz?")) return;
    patch(a.id, { status: "cancelled" }).then(function (res) {
      if (res.status !== 200) { alert(res.body.error || "İşlem başarısız."); return; }
      openCustomerWhatsApp(a,
        "Merhaba " + a.ad + ", " + trDate(a.tarih) + " " + a.saat +
        " için Hairbey randevunuz iptal edilmiştir. Yeni randevu için bize ulaşabilirsiniz.");
      loadAppointments();
    });
  }

  function rescheduleAppt(a, newDate, newTime) {
    if (!newDate || !newTime) { alert("Lütfen yeni tarih ve saat seçin."); return; }
    patch(a.id, { tarih: newDate, saat: newTime }).then(function (res) {
      if (res.status === 409) { alert("Yeni saat dolu. Başka bir saat seçin."); return; }
      if (res.status !== 200) { alert(res.body.error || "İşlem başarısız."); return; }
      openCustomerWhatsApp(a,
        "Merhaba " + a.ad + ", Hairbey randevunuz " + trDate(newDate) + " " + newTime +
        " olarak güncellenmiştir. Görüşmek üzere!");
      loadAppointments();
    });
  }

  function deleteAppt(a) {
    if (!confirm("Bu randevu kalıcı olarak silinsin mi? (Müşteriye mesaj gitmez)")) return;
    api("/api/admin/appointments/" + a.id, { method: "DELETE" }).then(function (r) {
      if (r.ok) loadAppointments(); else alert("Silinemedi.");
    });
  }

  /* ---------------- Başlangıç ---------------- */
  if (getPass()) {
    api("/api/admin/appointments").then(function (r) {
      if (r.ok) showPanel(); else { clearPass(); showLogin(""); }
    }).catch(function () { showLogin(""); });
  } else {
    showLogin("");
  }
})();
