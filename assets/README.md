# Görseller (assets)

Bu klasör site görselleri içindir.

Şu an sitedeki fotoğraflar **Unsplash**'tan çekiliyor (internet bağlantısı gerektirir).
Kendi salon fotoğraflarınızı kullanmak için:

1. Fotoğraflarınızı bu `assets/` klasörüne ekleyin (örn. `salon-1.jpg`, `hero.jpg`).
2. `index.html` içinde ilgili `src="https://images.unsplash.com/..."` linklerini
   `src="assets/salon-1.jpg"` gibi kendi dosyanızla değiştirin.
3. Hero arka planı ve "Hakkımızda" görseli `css/styles.css` içinde
   `.hero-bg` ve `.about-img` sınıflarındaki `url(...)` değerlerinde tanımlıdır;
   bunları da `url("../assets/hero.jpg")` şeklinde değiştirebilirsiniz.

**İpucu:** Web için fotoğrafları sıkıştırın (genişlik ~1600px, JPG/WebP) — sayfa daha hızlı açılır.
