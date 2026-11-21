'use client';
import { downloadBlob, safeName } from './export';
import { htmlToText } from './htmlClean';

const DOC_CSS = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111}
h1{font-size:24pt}h2{font-size:18pt}h3{font-size:14pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}
blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:12px;color:#555}.page-break{page-break-after:always;border:0}`;

export function exportDocWord(design, title) {
  const m = design.page?.margin ?? 1;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${(title || '').replace(/</g, '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:${design.width / 96}in ${design.height / 96}in;margin:${m}in}${DOC_CSS}</style></head>
<body>${design.html || ''}</body></html>`;
  downloadBlob(new Blob(['﻿', html], { type: 'application/msword' }), `${safeName(title)}.doc`);
}

export function exportDocHtml(design, title) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${(title || '').replace(/</g, '')}</title><style>body{max-width:${design.width}px;margin:40px auto;padding:0 24px}${DOC_CSS}</style></head><body>${design.html || ''}</body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html' }), `${safeName(title)}.html`);
}

export function exportDocText(design, title) {
  downloadBlob(new Blob([htmlToText(design.html)], { type: 'text/plain' }), `${safeName(title)}.txt`);
}
