'use client';
import { useEffect } from 'react';

// Adds the design fonts stylesheet after the page has shown, so it never blocks loading.
export default function FontLoader({ href }) {
  useEffect(() => {
    if (document.querySelector(`link[data-design-fonts]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.designFonts = '1';
    document.head.appendChild(link);
  }, [href]);
  return null;
}
