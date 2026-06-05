import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardDealDelayMs, normalizeFlowSettings, randomBankDrawDelayMs, syncDealTimingFromPreset, } from './flowSettings';
describe('deal timing — single canonical source', () => {
    it('fast/normal/slow map to expected delay', () => {
        expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'fast' }))).toBe(1000);
        expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'normal' }))).toBe(3000);
        expect(cardDealDelayMs(normalizeFlowSettings({ dealSpeedPreset: 'slow' }))).toBe(5000);
    });
    it('syncDealTimingFromPreset aligns bank and natural delays to cardDealDelayMs', () => {
        const synced = syncDealTimingFromPreset(normalizeFlowSettings({ dealSpeedPreset: 'slow' }));
        const delay = cardDealDelayMs(synced);
        expect(synced.naturalDealDelayMs).toBe(delay);
        expect(synced.autoDealDelayMs).toBe(delay);
        expect(randomBankDrawDelayMs(synced)).toBe(delay);
        expect(synced.bankDrawMinDelayMs).toBe(delay);
        expect(synced.bankDrawMaxDelayMs).toBe(delay);
    });
    it('useSequentialCardReveal uses cardDealDelayMs only', () => {
        const src = readFileSync(join(process.cwd(), 'src/hooks/useSequentialCardReveal.ts'), 'utf8');
        expect(src).toContain('cardDealDelayMs');
        expect(src).not.toMatch(/setTimeout\([^,]+,\s*\d{3,}\)/);
    });
    it('useBlackjackTableFlow bank pacing uses cardDealDelayMs without extra multipliers', () => {
        const src = readFileSync(join(process.cwd(), 'src/components/useBlackjackTableFlow.ts'), 'utf8');
        expect(src).toContain('cardDealDelayMs');
        expect(src).toContain('randomBankDrawDelayMs');
        expect(src).not.toMatch(/cardDealDelayMs\([^)]+\)\s*\*\s*0\.5/);
        expect(src).not.toMatch(/Math\.round\(cardDealDelayMs/);
    });
});
