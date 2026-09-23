# Elaina AnchorGuard

`@rexxhayanasi/elaina-anchorguard`

Guard **anti force-close** untuk WhatsApp (Baileys). Mendeteksi payload yang membuat aplikasi WhatsApp crash/force-close, lalu **auto-hapus** pesannya dan opsional **blok** pengirim. Menjaga pesan **masuk** maupun **keluar**.

> Best-effort, bukan 100%. Ini seperti antivirus: menangkap pola crash yang dikenal + heuristik struktural. Bug baru butuh update. Proses bot sendiri tidak ikut force-close (Baileys tidak merender UI), jadi bot bisa menghapus pesan racun sebelum HP/WA Web membukanya.

## Pasang

```bash
npm install @rexxhayanasi/elaina-anchorguard
```

## Pakai

```js
import { createAntiBugGuard } from '@rexxhayanasi/elaina-anchorguard'

const guard = createAntiBugGuard(sock, {
  autoDelete: true,
  guardIncoming: true,
  guardOutgoing: true,
  blockOnBug: true,
  revokeForEveryoneIfAdmin: true,
  kickOnBug: true,
  onDetect: ({ direction, jid, sender, reasons }) => {
    console.log('[antibug]', direction, jid, sender, reasons)
  }
})
```

Panggil setelah socket dibuat. `guard.stop()` melepas hook.

## Respons saat pesan crash terdeteksi

- **Di grup dan bot admin** → **hapus untuk semua** (`protocolMessage` REVOKE) + **kick** pengirim + **blokir** pengirim.
- **Kena di chat sendiri / DM, atau bot bukan admin** → **delete-for-me** (bersihkan dari chat kita) + **blokir** pengirim.
- Pesan dari kita sendiri (`fromMe`) → di-revoke, tanpa blokir.

## Opsi

| Opsi | Default | Arti |
|---|---|---|
| `autoDelete` | `true` | Hapus otomatis pesan yang terdeteksi bug |
| `revokeForEveryoneIfAdmin` | `true` | Di grup, kalau bot admin, hapus untuk semua (revoke). Kalau tidak, delete-for-me |
| `kickOnBug` | `true` | Kick pengirim dari grup saat pesan crash (butuh bot admin) |
| `blockOnBug` | `true` | Blokir pengirim saat pesan crash (bukan dari kita) |
| `groupMetadata` | `null` | Fungsi `async (jid) => metadata` untuk cek admin dari cache-mu (hemat kueri) |
| `guardIncoming` | `true` | Pindai pesan masuk (`messages.upsert`) |
| `guardOutgoing` | `true` | Sanitize pesan keluar (membungkus `sock.sendMessage`; melempar error bila payload berbahaya) |
| `selfOnly` | `false` | Hanya jaga chat nomor sendiri |
| `burstThreshold` | `2` | Jumlah pesan bug dari pengirim sama (dalam `burstWindowMs`) untuk memicu eskalasi |
| `burstWindowMs` | `60000` | Jendela waktu penghitungan burst |
| `leaveGroupOnBurst` | `false` | Kalau kick gagal berulang (bot bukan admin) saat burst, keluar dari grup |
| `cooldownMs` | `15000` | Redam log/callback berulang dari chat yang sama saat burst |
| `guardGroupAdds` | `true` | Pantau `group-participants.update` (aksi add) |
| `autoKickBadAdds` | `true` | Kick otomatis nomor berbahaya yang di-add ke grup (butuh bot admin) |
| `metaAiNumbers` | `true` | Anggap nomor Meta AI (`1313555…`) sebagai add berbahaya |
| `addWatchlist` | `[]` | Nomor tambahan yang otomatis di-kick saat di-add |

### Anti spam-add (grup)

Serangan umum: seseorang nge-add nomor **Meta AI** (`+1 313 555-xxxx`) beramai-ramai ke grup untuk memicu restriksi/ban grup. Guard memantau event penambahan anggota; kalau yang di-add adalah nomor Meta AI atau ada di `addWatchlist`, ia **langsung kick** (jika bot admin) dan — kalau penambahnya mengulang sampai ambang `burstThreshold` — **blokir + kick penambahnya**. Anggota normal yang di-add tidak tersentuh.
| `ownJid` | `sock.user.id` | JID nomor sendiri |
| `thresholds` | `{}` | Timpa ambang deteksi (lihat `ANTIBUG_DEFAULTS`) |
| `onDetect` | `null` | Callback saat bug terdeteksi |
| `proto` | `null` | Opsional; lewatkan `proto` Baileys untuk validasi round-trip protobuf |

## Deteksi manual

```js
import { detectBug } from '@rexxhayanasi/elaina-anchorguard'

const { flagged, reasons } = detectBug(msg.message)
if (flagged) console.log('bug:', reasons)
```

## Vektor crash yang ditangkap

- **Control / null bytes** (`\u0000`, C0/C1) — vektor crasher paling umum
- Flood karakter **combining** (`̀`…) dan **invisible/zero-width/hair-space/RTL override** (` `–`‏`, `⠀`, hangul filler, dll)
- Teks / caption **raksasa** dan **newline** berlebih
- **Bom mention** (`mentionedJid` / `groupMentions` sangat banyak)
- `nativeFlowMessage` / `listMessage` / `carouselMessage` dengan tombol/section/row/card berlebih
- `buttonParamsJson` **rusak** atau raksasa
- **AIRich** (`aiRichResponseMessage`) dengan submessages / content items berlebih
- **location / liveLocation** dengan koordinat **tak valid** (NaN/Infinity/di luar rentang lat±90 lng±180)
- **poll** dengan opsi berlebih, **contacts array** berlebih
- **Angka tak-hingga** (NaN/Infinity) di field mana pun
- **Nesting pembungkus** terlalu dalam (viewOnce/ephemeral/deviceSent/edited)
- Struktur terlalu dalam / jumlah node berlebih / **circular** (cycle sejati)
- Ukuran encode protobuf melebihi batas (bila `proto` dilewatkan)

Walk generik memindai **setiap** field di **semua** tipe message (flood karakter, ukuran, nesting, angka), jadi tipe apa pun tercakup untuk vektor tersebut; cek di atas menambah batas struktural per-tipe.

## Catatan

- Untuk pesan orang lain, WhatsApp tidak mengizinkan revoke; guard memakai delete-for-me.
- Ambang bisa disetel via `thresholds` agar tidak false-positive pada pesan panjang yang sah.
- Kompatibel dengan `@rexxhayanasi/elaina-baileys` (yang juga membawa guard ini secara bawaan) maupun socket Baileys lain yang menyediakan `ev`, `sendMessage`, `chatModify`, `updateBlockStatus`.

## Lisensi

MIT
