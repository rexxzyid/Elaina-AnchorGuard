import test from 'node:test'
import assert from 'node:assert'
import { detectBug, createAntiBugGuard, ANTIBUG_DEFAULTS } from '../index.js'

test('pesan bersih tidak ditandai', () => {
    const r = detectBug({ extendedTextMessage: { text: 'halo', contextInfo: { mentionedJid: ['1@s.whatsapp.net'] } } })
    assert.equal(r.flagged, false)
})

test('flood combining ditandai', () => {
    const r = detectBug({ conversation: 'x' + '́'.repeat(5000) })
    assert.equal(r.flagged, true)
})

test('flood invisible ditandai', () => {
    const r = detectBug({ conversation: '​'.repeat(2000) })
    assert.equal(r.flagged, true)
})

test('bom mention ditandai', () => {
    const r = detectBug({ extendedTextMessage: { text: 'a', contextInfo: { mentionedJid: Array(5000).fill('1@s.whatsapp.net') } } })
    assert.equal(r.flagged, true)
})

test('teks raksasa ditandai', () => {
    const r = detectBug({ conversation: 'a'.repeat(ANTIBUG_DEFAULTS.maxText + 1) })
    assert.equal(r.flagged, true)
})

test('buttonParamsJson rusak ditandai', () => {
    const r = detectBug({ nativeFlowMessage: { buttons: [{ name: 'x', buttonParamsJson: '{bad' }] } })
    assert.equal(r.flagged, true)
})

test('guard menghapus pesan masuk yang bug', async () => {
    let deleted = null
    let blocked = null
    const mock = {
        user: { id: '62@s.whatsapp.net' },
        ev: { handlers: {}, on(e, h) { this.handlers[e] = h }, off() {} },
        sendMessage: async (jid, content) => { if (content?.delete) deleted = content.delete },
        chatModify: async (mod, jid) => { deleted = mod?.deleteForMe?.key },
        updateBlockStatus: async (jid) => { blocked = jid }
    }
    createAntiBugGuard(mock, { blockOnBug: true })
    const key = { remoteJid: '123@s.whatsapp.net', fromMe: false, id: 'ABC', participant: '123@s.whatsapp.net' }
    await mock.ev.handlers['messages.upsert']({ messages: [{ key, message: { conversation: '​'.repeat(2000) } }] })
    assert.ok(deleted)
    assert.equal(blocked, '123@s.whatsapp.net')
})

test('guard memblok pesan keluar yang bug', async () => {
    const mock = { user: { id: '62@s.whatsapp.net' }, ev: { on() {}, off() {} }, sendMessage: async () => ({}) }
    createAntiBugGuard(mock, { guardIncoming: false })
    await assert.rejects(() => mock.sendMessage('1@s.whatsapp.net', { conversation: 'a'.repeat(ANTIBUG_DEFAULTS.maxText + 1) }))
})
