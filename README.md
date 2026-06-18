# 💈 Hairbey — Berber Randevu Web Sitesi

Bursa Nilüfer'deki **Hairbey** erkek kuaförü için modern, animasyonlu ve mobil uyumlu
tek sayfalık web sitesi. Müşteriler hizmetleri görüp **WhatsApp üzerinden randevu** alabilir.

## ✨ Özellikler

- Premium koyu + altın tasarım, akıcı animasyonlar (scroll-reveal, ken-burns hero, sayaç, hover efektleri)
- Hizmet & fiyat listesi (Traş 450₺'den başlayan fiyatlar)
- WhatsApp ile online randevu formu (sunucu/veritabanı gerektirmez)
- Tıklanabilir telefon, e-posta, Instagram ve gömülü Google Harita
- Tamamen responsive (mobil/tablet/masaüstü) ve erişilebilir (`prefers-reduced-motion` desteği)
- Sıfır bağımlılık: saf HTML + CSS + JavaScript

## 📁 Dosya Yapısı

```
index.html       → Tüm sayfa içeriği
css/styles.css   → Tasarım sistemi ve animasyonlar
js/script.js     → Form, menü, animasyon mantığı
assets/          → Kendi fotoğraflarınız için
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
- **Renkler / fontlar:** `css/styles.css` dosyasının en üstündeki `:root` değişkenleri.
- **Fotoğraflar:** `assets/README.md` dosyasına bakın.

## 🌐 Ücretsiz Yayınlama (GitHub Pages)

1. Bu dalı GitHub'a gönderin (push).
2. GitHub'da repo → **Settings → Pages**.
3. **Source** olarak ilgili dalı ve `/ (root)` klasörünü seçin, **Save** deyin.
4. Birkaç dakika içinde siteniz `https://<kullanıcı-adı>.github.io/<repo>/` adresinde yayında olur.

> Alternatif olarak [Netlify](https://www.netlify.com/) veya [Vercel](https://vercel.com/) üzerine
> klasörü sürükleyip bırakarak da yayınlayabilirsiniz.

## 📞 İletişim

- **Adres:** Güngören Mah. Karanfil Sok. No:2, Nilüfer / Bursa
- **Telefon:** 0535 045 47 36
- **E-posta:** melihyelbey1216@gmail.com
- **Instagram:** [@melih_yelbey](https://instagram.com/melih_yelbey)
