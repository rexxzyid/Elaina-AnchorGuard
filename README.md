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
  deleteMode: 'auto',
  guardIncoming: true,
  guardOutgoing: true,
  blockOnBug: false,
  selfOnly: false,
  onDetect: ({ direction, jid, sender, reasons }) => {
    console.log('[antibug]', direction, jid, sender, reasons)
  }
})
```

Panggil setelah socket dibuat. `guard.stop()` melepas hook.

## Opsi

| Opsi | Default | Arti |
|---|---|---|
| `autoDelete` | `true` | Hapus otomatis pesan yang terdeteksi bug |
| `deleteMode` | `'auto'` | `'auto'` = revoke bila dari kita, delete-for-me bila dari orang lain. `'everyone'` = selalu revoke. `'me'` = selalu delete-for-me |
| `guardIncoming` | `true` | Pindai pesan masuk (`messages.upsert`) |
| `guardOutgoing` | `true` | Sanitize pesan keluar (membungkus `sock.sendMessage`; melempar error bila payload berbahaya) |
| `blockOnBug` | `false` | Blok pengirim (`updateBlockStatus`) saat pesan bug diterima (bukan dari kita) |
| `selfOnly` | `false` | Hanya jaga chat nomor sendiri |
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

- Flood karakter **combining** (`̀`…) dan **invisible/zero-width/RTL override**
- Teks / caption **raksasa** dan **newline** berlebih
- **Bom mention** (`mentionedJid` / `groupMentions` sangat banyak)
- `nativeFlowMessage` / `listMessage` / `carouselMessage` dengan tombol/section/row/card berlebih
- `buttonParamsJson` **rusak** atau raksasa
- **Nesting pembungkus** terlalu dalam (viewOnce/ephemeral/deviceSent/edited)
- Struktur terlalu dalam / jumlah node berlebih / **circular**
- Ukuran encode protobuf melebihi batas (bila `proto` dilewatkan)

## Catatan

- Untuk pesan orang lain, WhatsApp tidak mengizinkan revoke; guard memakai delete-for-me.
- Ambang bisa disetel via `thresholds` agar tidak false-positive pada pesan panjang yang sah.
- Kompatibel dengan `@rexxhayanasi/elaina-baileys` (yang juga membawa guard ini secara bawaan) maupun socket Baileys lain yang menyediakan `ev`, `sendMessage`, `chatModify`, `updateBlockStatus`.

## Lisensi

MIT
