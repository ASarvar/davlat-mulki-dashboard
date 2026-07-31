import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn-uslubidagi klass birlashtiruvchi.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Minglik ajratgich bilan formatlash — `toLocaleString("uz-UZ")` ISHLATMANG bu yerda:
// Node (server) va brauzer (client) ICU ma'lumotlari har xil bo'lishi mumkin va
// bir xil son turlicha chiqadi ("5,443" vs "5 443") — Client Component'da bu
// hydration mismatch'ga olib keladi. Bu funksiya ikkalasida ham bir xil natija beradi.
export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
