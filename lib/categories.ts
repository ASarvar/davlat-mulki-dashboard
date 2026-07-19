export type Category = {
  id: string;
  order: number;
  name: string;
  /**
   * true  -> ma'lumot API integratsiyasi orqali avtomatik keladi
   * false -> ma'lumot qo'lda kiritiladi va asos fayl biriktiriladi
   */
  isIntegration: boolean;
};

// Rasmiy tasniflash bo'yicha 10 ta kategoriya (tartib raqamlari asl hujjatdagidek saqlangan)
export const CATEGORIES: Category[] = [
  {
    id: "bolib-tolash",
    order: 1,
    name: "Bo'lib to'lash sharti bilan sotilgan",
    isIntegration: true,
  },
  {
    id: "sotilgan-kadastr",
    order: 2,
    name: "Sotilgan (kadastr hujjati xaridor nomiga rasmiylashtirilmagan)",
    isIntegration: true,
  },
  {
    id: "begaraz",
    order: 3,
    name: "Beg'araz (tekin) foydalanishga berilgan",
    isIntegration: true,
  },
  {
    id: "xususiylashtirish-savdo",
    order: 4,
    name: "Xususiylashtirish va ijaraga berish uchun savdoda turgan",
    isIntegration: true,
  },
  {
    id: "savdoga-chiqarish",
    order: 5,
    name: "Savdoga chiqarish jarayonida",
    isIntegration: true,
  },
  {
    id: "savdosi-toxtatilgan",
    order: 6,
    name: "Savdosi to'xtatilgan",
    isIntegration: false,
  },
  {
    id: "yaroqsiz",
    order: 7,
    name: "Foydalanishga yaroqsiz holatda",
    isIntegration: false,
  },
  {
    id: "chekka-hudud",
    order: 8,
    name: "Chekka hududlarda joylashgan",
    isIntegration: false,
  },
  {
    id: "bosh-turgan",
    order: 9,
    name: "Bo'sh turgan",
    isIntegration: false,
  },
  {
    id: "bosh-maydon",
    order: 10,
    name: "Bo'sh turgan maydoni mavjud",
    isIntegration: false,
  },
];

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export const INTEGRATION_CATEGORIES = CATEGORIES.filter((c) => c.isIntegration);
export const MANUAL_CATEGORIES = CATEGORIES.filter((c) => !c.isIntegration);
