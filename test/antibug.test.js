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

test('koordinat lokasi tak valid ditandai', () => {
    assert.equal(detectBug({ locationMessage: { degreesLatitude: NaN, degreesLongitude: 106 } }).flagged, true)
    assert.equal(detectBug({ liveLocationMessage: { degreesLatitude: 9999, degreesLongitude: 0 } }).flagged, true)
    assert.equal(detectBug({ locationMessage: { degreesLatitude: -6.2, degreesLongitude: 106.8 } }).flagged, false)
})

test('AIRich submessages berlebih ditandai', () => {
    const big = { aiRichResponseMessage: { submessages: Array(1000).fill(0).map((_, i) => ({ text: 'x' + i })) } }
    assert.equal(detectBug(big).flagged, true)
    assert.equal(detectBug({ aiRichResponseMessage: { submessages: [{ text: 'hai' }] } }).flagged, false)
})

test('poll & contacts berlebih ditandai', () => {
    assert.equal(detectBug({ pollCreationMessageV3: { name: 'q', options: Array(2000).fill(0).map((_, i) => ({ optionName: 'x' + i })) } }).flagged, true)
    assert.equal(detectBug({ contactsArrayMessage: { contacts: Array(5000).fill(0).map((_, i) => ({ vcard: 'x' + i })) } }).flagged, true)
})

test('cycle sejati ditandai, shared-ref tidak', () => {
    const cyc = { conversation: 'a' }
    cyc.self = cyc
    assert.equal(detectBug(cyc).flagged, true)
    const ci = { mentionedJid: ['1@s.whatsapp.net'] }
    assert.equal(detectBug({ extendedTextMessage: { text: 'a', contextInfo: ci }, x: ci }).flagged, false)
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
