export type Region = {
  id: string;
  name: string;
};

// O'zbekiston Respublikasi hududlari (13 viloyat + Respublika + poytaxt shahri)
export const REGIONS: Region[] = [
  { id: "qoraqalpogiston", name: "Qoraqalpog'iston Respublikasi" },
  { id: "andijon", name: "Andijon viloyati" },
  { id: "buxoro", name: "Buxoro viloyati" },
  { id: "jizzax", name: "Jizzax viloyati" },
  { id: "qashqadaryo", name: "Qashqadaryo viloyati" },
  { id: "navoiy", name: "Navoiy viloyati" },
  { id: "namangan", name: "Namangan viloyati" },
  { id: "samarqand", name: "Samarqand viloyati" },
  { id: "surxondaryo", name: "Surxondaryo viloyati" },
  { id: "sirdaryo", name: "Sirdaryo viloyati" },
  { id: "toshkent-viloyati", name: "Toshkent viloyati" },
  { id: "fargona", name: "Farg'ona viloyati" },
  { id: "xorazm", name: "Xorazm viloyati" },
  { id: "toshkent-shahri", name: "Toshkent shahri" },
];

export function getRegionName(id: string): string {
  return REGIONS.find((r) => r.id === id)?.name ?? id;
}
