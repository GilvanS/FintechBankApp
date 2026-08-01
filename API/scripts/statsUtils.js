/**
 * statsUtils.js — Função compartilhada de cálculo de estatísticas do SKILL.md
 *
 * Usada por: getBadgeStats.js (CLI), generate_badge_svg.js (SVG), index.cjs (API)
 *
 * Uso:
 *   const { computeStats } = require('./statsUtils');
 *   const stats = computeStats();
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILL_PATH = path.join(ROOT, 'SKILL.md');
const DOC_PATH = path.join(ROOT, 'docs', 'REGRAS-NEGOCIO-FATURA.md');

const read = (p) => {
    try { return fs.readFileSync(p, 'utf-8'); }
    catch { return null; }
};

/**
 * Lê SKILL.md e docs/REGRAS-NEGOCIO-FATURA.md e computa estatísticas
 * de cobertura: seções, cross-references, âncoras.
 *
 * @returns {Object} stats — { sections, sectionsWithRef, refCount, pct,
 *   score, anchorsOk, anchorsBad, passed, failed, warnings, total,
 *   label, message, color }
 */
function computeStats() {
    const skillContent = read(SKILL_PATH);
    if (!skillContent) {
        return { error: 'SKILL.md not found', sections: 0, sectionsWithRef: 0, refCount: 0, pct: 0, score: 0, passed: 0, failed: 0, warnings: 0, total: 1, label: 'regras', message: 'erro', color: 'red' };
    }

    // ── SKILL.md: sections and cross-references ──
    const parts = skillContent.split(/^## /m).filter(Boolean);
    const sectionCount = parts.length - 1;

    const refPattern = /🔗\s*(Consulte|Esta seção)/g;
    const refs = skillContent.match(refPattern) || [];
    const refCount = refs.length;

    let sectionsWithRef = 0;
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].includes('🔗')) sectionsWithRef++;
    }

    // ── docs/REGRAS-NEGOCIO-FATURA.md: anchor validation ──
    const docContent = read(DOC_PATH);
    let anchorsOk = 0, anchorsBad = 0;
    if (docContent) {
        const slugify = (text) => text.toLowerCase()
            .replace(/[^\w\s\u00C0-\u024F-]/g, '').replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const headingLines = docContent.match(/^#{1,6}\s.+$/gm) || [];
        const headingSlugs = new Set(headingLines.map(h => slugify(h.replace(/^#+\s*/, ''))));
        const anchorLinks = docContent.match(/\(#[^)]+\)/g) || [];
        for (const al of anchorLinks) {
            const slug = al.replace(/[()#]/g, '').trim();
            if (headingSlugs.has(slug)) anchorsOk++;
            else anchorsBad++;
        }
    }

    // ── Score composto ──
    const totalAnchors = anchorsOk + anchorsBad;
    const refScore = sectionCount > 0 ? (sectionsWithRef / sectionCount) * 70 : 0;
    const anchorScore = totalAnchors > 0 ? (anchorsOk / totalAnchors) * 30 : 30;
    const score = Math.round(refScore + anchorScore);
    const pct = Math.round((sectionsWithRef / Math.max(sectionCount, 1)) * 100);

    return {
        schemaVersion: 1,
        sections: sectionCount,
        sectionsWithRef,
        refCount,
        pct,
        score,
        anchorsOk,
        anchorsBad,
        totalAnchors,
        passed: refCount,
        failed: 0,
        warnings: sectionCount - sectionsWithRef,
        total: sectionCount,
        label: 'regras',
        message: `${pct}%`,
        color: pct >= 90 ? 'brightgreen' : pct >= 70 ? 'green' : pct >= 50 ? 'yellowgreen' : pct >= 30 ? 'yellow' : 'red'
    };
}

module.exports = { computeStats };
