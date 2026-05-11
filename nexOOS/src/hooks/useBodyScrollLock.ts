'use client';

import { useEffect } from 'react';

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    const { body, documentElement } = document;
    const currentLockCount = Number(body.dataset.scrollLockCount ?? '0');

    if (currentLockCount === 0) {
      body.dataset.previousBodyOverflow = body.style.overflow;
      documentElement.dataset.previousHtmlOverflow = documentElement.style.overflow;
      body.style.overflow = 'hidden';
      documentElement.style.overflow = 'hidden';
    }

    body.dataset.scrollLockCount = String(currentLockCount + 1);

    return () => {
      const nextLockCount = Math.max(
        0,
        Number(body.dataset.scrollLockCount ?? '1') - 1
      );

      if (nextLockCount === 0) {
        body.style.overflow = body.dataset.previousBodyOverflow ?? '';
        documentElement.style.overflow =
          documentElement.dataset.previousHtmlOverflow ?? '';
        delete body.dataset.scrollLockCount;
        delete body.dataset.previousBodyOverflow;
        delete documentElement.dataset.previousHtmlOverflow;
        return;
      }

      body.dataset.scrollLockCount = String(nextLockCount);
    };
  }, [locked]);
}
