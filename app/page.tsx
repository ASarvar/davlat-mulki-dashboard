import { getDashboardData } from "@/lib/dashboard";
import SummaryCards from "@/components/SummaryCards";
import DataMatrix from "@/components/DataMatrix";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Davlat mulki obyektlarini ijaraga berish monitoringi
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Hududiy boshqarmalar balansidagi davlat mulki obyektlarini
          {" "}{data.year}-yilda ijaraga berish, shartnomalar rasmiylashtirilishi
          va kelib tushgan ijara to'lovlari bo'yicha holat — hudud va
          kategoriyalar kesimida.
        </p>
      </div>

      <div className="mb-6">
        <SummaryCards data={data} />
      </div>

      <DataMatrix data={data} />

      <p className="mt-4 text-xs text-muted">
        Ma'lumotlar so'nggi marta {new Date(data.generatedAt).toLocaleString(
          "uz-UZ"
        )} da yangilangan. 1–5-kategoriyalar API integratsiyasi orqali
        avtomatik, 6–10-kategoriyalar hududiy boshqarmalar tomonidan qo'lda
        kiritiladi.
      </p>
    </main>
  );
}
