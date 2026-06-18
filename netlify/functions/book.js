// POST /api/book
// Yeni randevu oluşturur (durum: "pending" = beklemede). Herkese açık.
// Aynı tarih+saat doluysa reddeder (sunucu tarafı çakışma kontrolü).
import {
  store, json, listAppointments, ACTIVE_STATUSES,
  newId, validTime, validDate,
} from "./_lib.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Yöntem desteklenmiyor" }, 405);

  let body;
  try { body = await req.json(); }
  catch (e) { return json({ error: "Geçersiz istek" }, 400); }

  const ad = (body.ad || "").trim();
  const telefon = (body.telefon || "").trim();
  const hizmet = (body.hizmet || "").trim();
  const tarih = (body.tarih || "").trim();
  const saat = (body.saat || "").trim();
  const not = (body.not || "").trim();

  // Doğrulama
  if (!ad || !telefon || !hizmet || !tarih || !saat) {
    return json({ error: "Lütfen tüm zorunlu alanları doldurun." }, 400);
  }
  if (!validDate(tarih) || !validTime(saat)) {
    return json({ error: "Tarih veya saat biçimi geçersiz." }, 400);
  }
  const digits = telefon.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    return json({ error: "Geçerli bir telefon numarası girin." }, 400);
  }
  // Geçmiş tarih (sunucu UTC; bir günlük tolerans veriyoruz)
  const todayUTC = new Date().toISOString().slice(0, 10);
  if (tarih < todayUTC) {
    return json({ error: "Geçmiş bir tarih seçilemez." }, 400);
  }

  try {
    // Çakışma kontrolü
    const items = await listAppointments();
    const taken = items.some(
      (a) => a.tarih === tarih && a.saat === saat && ACTIVE_STATUSES.includes(a.status)
    );
    if (taken) {
      return json({ error: "Bu saat dolu. Lütfen başka bir saat seçin." }, 409);
    }

    const appt = {
      id: newId(),
      ad, telefon, hizmet, tarih, saat, not,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await store().setJSON(appt.id, appt);
    return json({ ok: true, id: appt.id });
  } catch (e) {
    return json({ error: "Sunucu hatası" }, 500);
  }
};

export const config = { path: "/api/book" };
