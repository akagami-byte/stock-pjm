/**
 * Waktu WIB (UTC+7) — helper untuk mencatat timestamp ke database.
 *
 * Kolom timestamp di DB (Supabase TIMESTAMP & SQLite TEXT) menyimpan nilai
 * tanpa timezone. Sebelumnya default DB = UTC (CURRENT_TIMESTAMP /
 * datetime('now')), sehingga tercatat UTC+0. Sekarang semua insert dikirim
 * eksplisit dalam WIB (UTC+7) agar waktu tercatat sesuai zona waktu yang
 * dipakai.
 *
 * Catatan: nilai dikembalikan TANPA offset timezone (naive), karena kolom
 * bertipe timestamp tanpa timezone. Postgres akan mengkonversi string
 * ber-offset ke UTC wall-time saat cast — justru salah. Jadi kirim wall-clock
 * WIB polos; client menampilkannya sebagai waktu lokal device (WIB).
 */

/** Format angka 2 digit. */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Waktu sekarang dalam wall-clock WIB (UTC+7), format "YYYY-MM-DDTHH:mm:ss".
 * E.g. "2026-08-11T12:30:00" saat UTC masih 05:30.
 */
export function getWIBDateTime(): string {
  // Geser epoch +7 jam, lalu baca komponen UTC → hasil = wall-clock WIB.
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  )
}
