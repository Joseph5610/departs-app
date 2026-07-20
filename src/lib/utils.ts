import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const contrastCache = new Map<string, string>();

export function getContrastColor(hexColor: string): string {
    if (!hexColor) return '#ffffff';
    
    if (contrastCache.has(hexColor)) {
        return contrastCache.get(hexColor)!;
    }

    const hex = hexColor.replace('#', '');
    
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
        g = parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
        b = parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        return '#ffffff';
    }

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    const result = (yiq >= 128) ? '#000000' : '#ffffff';
    
    contrastCache.set(hexColor, result);
    return result;
}
