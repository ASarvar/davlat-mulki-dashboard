import { getDashboardData } from "@/lib/dashboard";
import EntryForm from "@/components/EntryForm";
import ManualStatusList from "@/components/ManualStatusList";

export default async function KiritishPage(
  props: {
    searchParams: Promise<{ region?: string; category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const data = await getDashboardData();
  const manualCategories = data.categories.filter((c) => !c.isIntegration);

  const regionId = searchParams.region ?? data.regions[0].id;
  const categoryId = searchParams.category ?? manualCategories[0].id;

  const cell = data.cells.find(
    (c) => c.regionId === regionId && c.categoryId === categoryId
  );

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Qo'lda ma'lumot kiritish
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          6–10-kategoriyalar uchun hudud bo'yicha obyektlar sonini kiriting va
          asos sifatida tegishli faylni biriktiring. Har bir fayl faqat
          tanlangan kategoriyaga bog'lanadi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <EntryForm
          key={`${regionId}-${categoryId}`}
          regions={data.regions}
          categories={manualCategories}
          regionId={regionId}
          categoryId={categoryId}
          initialCount={cell?.count ?? 0}
          initialFileName={cell?.fileName ?? null}
          initialFileUrl={cell?.fileUrl ?? null}
        />
        <ManualStatusList
          data={data}
          regionId={regionId}
          activeCategoryId={categoryId}
        />
      </div>
    </main>
  );
}
