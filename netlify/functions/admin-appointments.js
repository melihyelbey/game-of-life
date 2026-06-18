// Yönetici uçları (şifre korumalı — x-admin-password başlığı):
//   GET    /api/admin/appointments       → tüm randevular
//   PATCH  /api/admin/appointments/:id    → durum güncelle ve/veya ertele
//   DELETE /api/admin/appointments/:id    → kaydı kalıcı sil
import {
  store, json, isAdmin, listAppointments, ACTIVE_STATUSES, validTime, validDate,
} from "./_lib.js";

const VALID_STATUSES = ["pending", "confirmed", "cancelled"];

export default async (req, context) => {
  if (!isAdmin(req)) return json({ error: "Yetkisiz" }, 401);

  const id = context.params && context.params.id;

  // --- Tüm randevuları listele ---
  if (req.method === "GET") {
    try {
      const items = await listAppointments();
      items.sort((a, b) =>
        (a.tarih + a.saat).localeCompare(b.tarih + b.saat)
      );
      return json({ items });
    } catch (e) {
      return json({ error: "Sunucu hatası" }, 500);
    }
  }

  if (!id) return json({ error: "Randevu id gerekli" }, 400);
  const s = store();

  // --- Güncelle: onay/iptal (status) ve/veya ertele (tarih/saat) ---
  if (req.method === "PATCH") {
    let body;
    try { body = await req.json(); }
    catch (e) { return json({ error: "Geçersiz istek" }, 400); }

    const appt = await s.get(id, { type: "json" });
    if (!appt) return json({ error: "Randevu bulunamadı" }, 404);

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return json({ error: "Geçersiz durum" }, 400);
      }
      appt.status = body.status;
    }

    // Ertele: yeni tarih/saat
    if (body.tarih !== undefined || body.saat !== undefined) {
      const yeniTarih = body.tarih !== undefined ? body.tarih : appt.tarih;
      const yeniSaat = body.saat !== undefined ? body.saat : appt.saat;
      if (!validDate(yeniTarih) || !validTime(yeniSaat)) {
        return json({ error: "Tarih veya saat biçimi geçersiz." }, 400);
      }
      // Yeni slot başka aktif randevu tarafından doluysa engelle
      const items = await listAppointments();
      const clash = items.some(
        (a) => a.id !== id && a.tarih === yeniTarih && a.saat === yeniSaat &&
               ACTIVE_STATUSES.includes(a.status)
      );
      if (clash) return json({ error: "Yeni saat dolu." }, 409);
      appt.tarih = yeniTarih;
      appt.saat = yeniSaat;
    }

    appt.updatedAt = new Date().toISOString();
    await s.setJSON(id, appt);
    return json({ ok: true, appointment: appt });
  }

  // --- Kalıcı sil ---
  if (req.method === "DELETE") {
    await s.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Yöntem desteklenmiyor" }, 405);
};

export const config = {
  path: ["/api/admin/appointments", "/api/admin/appointments/:id"],
};
