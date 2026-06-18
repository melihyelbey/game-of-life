# 💈 Hairbey — Berber Randevu Web Sitesi

Bursa Nilüfer'deki **Hairbey** erkek kuaförü için modern, animasyonlu ve mobil uyumlu
tek sayfalık web sitesi. Müşteriler hizmetleri görüp **WhatsApp üzerinden randevu** alabilir.

## ✨ Özellikler

- Premium koyu + altın tasarım, akıcı animasyonlar (scroll-reveal, ken-burns hero, sayaç, hover efektleri)
- Hizmet & fiyat listesi (Traş 450₺'den başlayan fiyatlar)
- WhatsApp ile online randevu formu (sunucu/veritabanı gerektirmez)
- Geçmiş tarih/saat seçimi engellenir; alınan saatler "Dolu" işaretlenip kapanır
- Tıklanabilir telefon, e-posta, Instagram ve gömülü Google Harita
- Tamamen responsive (mobil/tablet/masaüstü) ve erişilebilir (`prefers-reduced-motion` desteği)
- **Backend (Netlify Functions + Blobs):** randevular kalıcı saklanır, dolu saatler **tüm cihazlarda ortak** görünür
- **Yönetici paneli (`/admin`):** randevuları onayla / iptal et / ertele / sil — her işlemde müşteriye otomatik WhatsApp bildirimi açılır

## 📁 Dosya Yapısı

```
index.html                → Müşteri sayfası
admin.html                → Yönetici paneli (/admin)
css/styles.css            → Tasarım sistemi ve animasyonlar
js/script.js              → Form, menü, animasyon + backend bağlantısı
js/admin.js               → Yönetici paneli mantığı
netlify/functions/        → Serverless backend
  _lib.js                 → Ortak yardımcılar (Netlify Blobs)
  availability.js         → GET /api/availability (dolu saatler — herkese açık)
  book.js                 → POST /api/book (randevu oluştur)
  admin-appointments.js   → Yönetici uçları (şifre korumalı)
netlify.toml              → Netlify yapılandırması
package.json              → Backend bağımlılığı (@netlify/blobs)
assets/                   → Kendi fotoğraflarınız için
```

## 🚀 Çalıştırma

Bağımlılık yok. Sadece `index.html` dosyasını bir tarayıcıda açın.

İsterseniz basit bir yerel sunucuyla:

```bash
# Python ile
python3 -m http.server 8000
# Tarayıcıda: http://localhost:8000
```

## ✏️ Düzenleme

- **Fiyatlar / hizmetler:** `index.html` içindeki `#hizmetler` bölümü ve randevu formundaki
  `<select id="hizmet">` seçenekleri (ikisini de güncelleyin).
- **İletişim bilgileri:** `index.html` içindeki `#iletisim` bölümü ve footer.
- **WhatsApp numarası:** `js/script.js` dosyasının başındaki `WHATSAPP_NUMBER` değişkeni.
- **Randevu saat aralığı:** `js/script.js` içindeki `TIME_SLOTS` dizisi (çalışma saatlerinize göre düzenleyin).
- **Renkler / fontlar:** `css/styles.css` dosyasının en üstündeki `:root` değişkenleri.
- **Fotoğraflar:** `assets/README.md` dosyasına bakın.

## 🌐 Yayınlama (Netlify — backend dahil)

Backend ve yönetici panelinin çalışması için site **Netlify'a GitHub üzerinden bağlanarak**
yayınlanmalıdır (sürükle-bırak yöntemi fonksiyonları/Blobs'u çalıştırmaz).

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub**.
2. `melihyelbey/game-of-life` deposunu ve `claude/hairbey-booking-system-sdg3j2` dalını seçin.
3. Build komutu **boş**, publish dizini **`.`** (kök). **Deploy** deyin.
4. **Site configuration → Environment variables** bölümüne şu değişkeni ekleyin:
   - `ADMIN_PASSWORD` = *(yönetici paneli şifreniz)*
   Ardından **Deploys → Trigger deploy** ile yeniden yayınlayın.
5. Netlify Blobs otomatik etkindir; ekstra veritabanı kurulumu **gerekmez**.

> **Yerel test:** `npm install` sonrası `npx netlify dev` çalıştırın. Netlify Dev,
> yerel bir Blobs sanal alanı sağlar; `ADMIN_PASSWORD`'ü `.env` dosyasına yazabilirsiniz.

## 🔐 Yönetici Paneli (`/admin`)

- Adres: `https://<siteniz>.netlify.app/admin`
- Netlify'da tanımladığınız `ADMIN_PASSWORD` ile giriş yapılır.
- Her randevu için:
  - **Onayla** → durum "Onaylı" olur, müşteriye onay WhatsApp mesajı açılır.
  - **İptal Et** → durum "İptal" olur, saat boşa düşer, müşteriye iptal mesajı açılır.
  - **Ertele** → yeni tarih/saat seçip kaydedin; müşteriye güncelleme mesajı açılır.
  - **Sil** → kaydı kalıcı kaldırır (müşteriye mesaj gitmez).
- İptal/silinen randevuların saati otomatik olarak yeniden **boş** görünür.

> **Not:** WhatsApp bildirimleri, müşterinin numarasına önceden yazılmış mesajla
> WhatsApp'ı açar; göndermek için "gönder"e basmanız yeterlidir (wa.me yöntemi).
> Tek tuşla tam otomatik gönderim için ücretli WhatsApp Business API gerekir.

## ⏰ Backend yoksa ne olur?

Site backend'siz (ör. dosyayı çift tıklayıp veya sade statik hostta) açılırsa
otomatik olarak `localStorage` yedeğine düşer; dolu saatler yalnızca o tarayıcıda
geçerli olur. Netlify üzerinde yayınlandığında ise tüm cihazlarda ortak çalışır.

## 📞 İletişim

- **Adres:** Güngören Mah. Karanfil Sok. No:2, Nilüfer / Bursa
- **Telefon:** 0535 045 47 36
- **E-posta:** melihyelbey1216@gmail.com
- **Instagram:** [@melih_yelbey](https://instagram.com/melih_yelbey)
