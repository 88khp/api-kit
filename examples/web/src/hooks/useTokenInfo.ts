/**
 * useTokenInfo — live token status display
 *
 * Decodes the stored JWT every second to show the live countdown until expiry.
 * This makes pre-emptive refresh and race conditions visually observable.
 */

import { useEffect, useState } from "react";
import { tokenStorage } from "../apiClient";
import { decodeJwt } from "../../../../src/jwt";

export interface TokenInfo {
  expiresAt: Date | null;
  secondsRemaining: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean; // within 10 s
}

export function useTokenInfo(): TokenInfo {
  const [info, setInfo] = useState<TokenInfo>({
    expiresAt: null,
    secondsRemaining: null,
    isExpired: false,
    isExpiringSoon: false,
  });

  useEffect(() => {
    function update() {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setInfo({ expiresAt: null, secondsRemaining: null, isExpired: false, isExpiringSoon: false });
        return;
      }

      const payload = decodeJwt(token);
      if (!payload?.exp) {
        setInfo({ expiresAt: null, secondsRemaining: null, isExpired: false, isExpiringSoon: false });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - now;
      setInfo({
        expiresAt: new Date(payload.exp * 1000),
        secondsRemaining: remaining,
        isExpired: remaining <= 0,
        isExpiringSoon: remaining > 0 && remaining <= 10,
      });
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Re-read after a refresh event
  useEffect(() => {
    const handler = () => {
      // Small delay to let storage settle
      setTimeout(() => {
        const token = tokenStorage.getAccessToken();
        if (!token) return;
        const payload = decodeJwt(token);
        if (!payload?.exp) return;
        const now = Math.floor(Date.now() / 1000);
        const remaining = payload.exp - now;
        setInfo({
          expiresAt: new Date(payload.exp * 1000),
          secondsRemaining: remaining,
          isExpired: remaining <= 0,
          isExpiringSoon: remaining > 0 && remaining <= 10,
        });
      }, 100);
    };
    window.addEventListener("token-refreshed", handler);
    return () => window.removeEventListener("token-refreshed", handler);
  }, []);

  return info;
}
