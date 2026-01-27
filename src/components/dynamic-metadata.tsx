"use client";

import { useEffect } from "react";

export function DynamicMetadata() {
  useEffect(() => {
    // Get school data from environment variables
    const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME || "E-Learning System";
    const schoolLogo = process.env.NEXT_PUBLIC_SCHOOL_LOGO || "/favicon.ico";

    // Debug logging
    console.log('Environment variables:', {
      NEXT_PUBLIC_SCHOOL_NAME: process.env.NEXT_PUBLIC_SCHOOL_NAME,
      NEXT_PUBLIC_SCHOOL_LOGO: process.env.NEXT_PUBLIC_SCHOOL_LOGO,
      schoolName,
      schoolLogo
    });

    // Update document title
    document.title = `${schoolName} - E-Learning`;
    
    // Also update meta title tag if it exists
    const titleMeta = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    if (titleMeta) {
      titleMeta.content = `${schoolName} - E-Learning`;
    }
    
    // Update twitter title if it exists
    const twitterTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement;
    if (twitterTitle) {
      twitterTitle.content = `${schoolName} - E-Learning`;
    }

    // Update favicon if different from default
    if (schoolLogo && schoolLogo !== "/favicon.ico") {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      existingFavicons.forEach(favicon => favicon.remove());

      // Add new favicon
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = schoolLogo;
      link.type = 'image/x-icon';
      document.head.appendChild(link);
      
      // Also add apple-touch-icon
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = schoolLogo;
      document.head.appendChild(appleLink);
    }
  }, []); // Run only once on mount

  return null; // This component doesn't render anything
}
