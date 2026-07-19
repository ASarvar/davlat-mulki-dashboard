export type ManualEntry = {
  regionId: string;
  categoryId: string;
  count: number;
  fileName: string | null;
  fileUrl: string | null;
  updatedAt: string;
};

export type IntegrationEntry = {
  regionId: string;
  categoryId: string;
  count: number;
  syncedAt: string;
};

export type DashboardCell = {
  regionId: string;
  categoryId: string;
  count: number;
  source: "integration" | "manual";
  fileName: string | null;
  fileUrl: string | null;
  updatedAt: string | null;
};

export type DashboardResponse = {
  year: number;
  regions: { id: string; name: string }[];
  categories: {
    id: string;
    order: number;
    name: string;
    isIntegration: boolean;
  }[];
  cells: DashboardCell[];
  generatedAt: string;
};
