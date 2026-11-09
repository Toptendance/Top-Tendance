'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StoreLocation } from '@/components/common/StoreLocation';
import { Footer } from '@/components/common/Footer';

// Operational routes where customer-facing store locator and marketing footer should be hidden
const PORTAL_PREFIXES = ['/pos', '/inventory', '/reports'];

export function ConditionalFooter() {
  const pathname = usePathname();

  const isPortal = PORTAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
  );

  if (isPortal) {
    return null;
  }

  return (
    <>
      <StoreLocation />
      <Footer />
    </>
  );
}

