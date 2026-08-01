#!/usr/bin/env node
/**
 * generate_badge_svg.js — Gera um badge SVG auto-contido com a cobertura da validação de regras
 *
 * Saída: escreve rules-coverage.svg na raiz do projeto
 *
 * Uso:
 *   node scripts/generate_badge_svg.js                    # Gera SVG padrão (shields.io style)
 *   node scripts/generate_badge_svg.js --output docs/badge.svg  # Caminho customizado
 */

const fs = require('fs');
const path = require('path');
const { computeStats } = require('./statsUtils');

const ROOT = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'rules-coverage.svg';
const OUTPUT_PATH = path.resolve(ROOT, outputArg.startsWith('/') || outputArg.startsWith('..') ? outputArg : outputArg);

// ─── Obter stats via shared utility ────────────────────────────────────────

const stats = computeStats();
if (stats.error) {
    console.error('Erro ao obter stats:', stats.error);
    stats.pct = 0; stats.passed = 0; stats.total = 1; stats.color = 'red';
    stats.label = 'regras'; stats.message = 'erro';
}

// ─── Cores e label ─────────────────────────────────────────────────────────

const colorMap = {
    brightgreen: '#44cc11', green: '#97ca00', yellowgreen: '#a4a61d',
    yellow: '#dfb317', orange: '#fe7d37', red: '#e05d44', blue: '#007ec6',
    grey: '#555', gray: '#555', lightgrey: '#9f9f9f', lightgray: '#9f9f9f',
};

const COLOR_HEX = colorMap[stats.color] || stats.color || '#44cc11';
const LABEL = stats.label || 'regras';
const MESSAGE = stats.message || `${stats.pct}%`;

// ─── Gera SVG ──────────────────────────────────────────────────────────────

const labelWidth = 55;
const msgWidth = Math.max(40, MESSAGE.length * 7.5 + 12);
const totalWidth = labelWidth + msgWidth;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${LABEL}: ${MESSAGE}">
  <title>${LABEL}: ${MESSAGE}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${msgWidth}" height="20" fill="${COLOR_HEX}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${Math.round(labelWidth / 2)}" y="14" font-weight="bold">${LABEL}</text>
    <text x="${labelWidth + Math.round(msgWidth / 2)}" y="14" font-weight="bold">${MESSAGE}</text>
  </g>
</svg>`;

fs.writeFileSync(OUTPUT_PATH, svg, 'utf-8');
console.log(`✅ Badge SVG gerado: ${OUTPUT_PATH}`);
console.log(`   Label: ${LABEL}`);
console.log(`   Mensagem: ${MESSAGE}`);
console.log(`   Cor: ${COLOR_HEX}`);
