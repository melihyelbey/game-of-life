// Ortak yardımcılar — Hairbey backend
// Randevular Netlify Blobs'ta her biri ayrı kayıt (anahtar = id) olarak tutulur.
import { getStore } from "@netlify/blobs";

// Güçlü tutarlılık: yazdıktan hemen sonra okuyunca güncel veriyi görmek için.
export function store() {
  return getStore({ name: "appointments", consistency: "strong" });
}

// Bir saatin "dolu" sayıldığı durumlar (iptal edilenler boşa düşer)
export const ACTIVE_STATUSES = ["pending", "confirmed"];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Yönetici doğrulaması: e-posta + şifre.
// ADMIN_EMAIL ve ADMIN_PASSWORD ortam değişkenlerinden okunur.
// (Şifre güvenlik gereği kodda tutulmaz; Netlify env değişkenine eklenir.)
export function isAdmin(req) {
  const expectedPass = process.env.ADMIN_PASSWORD;
  const expectedEmail = (process.env.ADMIN_EMAIL || "melihyelbey1216@gmail.com").trim().toLowerCase();
  if (!expectedPass) return false; // şifre tanımlı değilse yönetim kapalı
  const givenPass = req.headers.get("x-admin-password") || "";
  const givenEmail = (req.headers.get("x-admin-email") || "").trim().toLowerCase();
  return givenPass === expectedPass && givenEmail === expectedEmail;
}

// Tüm randevuları oku
export async function listAppointments() {
  const s = store();
  const { blobs } = await s.list();
  const items = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: "json" }))
  );
  return items.filter(Boolean);
}

// Basit, çakışmaya dayanıklı id üretimi
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Geçerli "HH:MM" mi?
export function validTime(t) {
  return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
// Geçerli "YYYY-MM-DD" mi?
export function validDate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
