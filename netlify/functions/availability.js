// GET /api/availability?date=YYYY-MM-DD
// Belirli bir gün için DOLU saatleri döndürür (herkese açık — kişisel veri içermez).
import { json, listAppointments, ACTIVE_STATUSES, validDate } from "./_lib.js";

export default async (req) => {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!validDate(date)) {
    return json({ error: "Geçersiz tarih. Biçim: YYYY-MM-DD" }, 400);
  }

  try {
    const items = await listAppointments();
    const booked = items
      .filter((a) => a.tarih === date && ACTIVE_STATUSES.includes(a.status))
      .map((a) => a.saat);
    return json({ date, booked: Array.from(new Set(booked)) });
  } catch (e) {
    return json({ error: "Sunucu hatası" }, 500);
  }
};

export const config = { path: "/api/availability" };
