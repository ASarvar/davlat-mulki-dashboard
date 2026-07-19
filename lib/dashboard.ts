import { REGIONS } from "./regions";
import { CATEGORIES } from "./categories";
import { fetchIntegrationCounts } from "./integration";
import { getManualEntries } from "./db";
import { DashboardCell, DashboardResponse } from "./types";

export async function getDashboardData(): Promise<DashboardResponse> {
  const [integrationEntries, manualEntries] = await Promise.all([
    fetchIntegrationCounts(),
    getManualEntries(),
  ]);

  const cells: DashboardCell[] = [];

  for (const region of REGIONS) {
    for (const category of CATEGORIES) {
      if (category.isIntegration) {
        const found = integrationEntries.find(
          (e) => e.regionId === region.id && e.categoryId === category.id
        );
        cells.push({
          regionId: region.id,
          categoryId: category.id,
          count: found?.count ?? 0,
          source: "integration",
          fileName: null,
          fileUrl: null,
          updatedAt: found?.syncedAt ?? null,
        });
      } else {
        const found = manualEntries.find(
          (e) => e.regionId === region.id && e.categoryId === category.id
        );
        cells.push({
          regionId: region.id,
          categoryId: category.id,
          count: found?.count ?? 0,
          source: "manual",
          fileName: found?.fileName ?? null,
          fileUrl: found?.fileUrl ?? null,
          updatedAt: found?.updatedAt ?? null,
        });
      }
    }
  }

  return {
    year: 2026,
    regions: REGIONS,
    categories: CATEGORIES,
    cells,
    generatedAt: new Date().toISOString(),
  };
}
