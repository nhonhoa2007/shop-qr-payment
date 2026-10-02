import { CatalogService, type CatalogSort } from '@/server/modules/catalog/catalog.service';
import { HomeView } from '@client/views/HomeView';

export const revalidate = 60;

const ALLOWED_SORTS: CatalogSort[] = ['newest', 'price-asc', 'price-desc'];

interface HomePageProps {
  searchParams?: Promise<{ category?: string; search?: string; sort?: string; page?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const currentCategory = resolvedSearchParams?.category?.trim() || null;
  const searchQuery = resolvedSearchParams?.search?.trim() || null;
  const currentSort = ALLOWED_SORTS.includes(resolvedSearchParams?.sort as CatalogSort)
    ? (resolvedSearchParams?.sort as CatalogSort)
    : 'newest';
  const parsedPage = Number(resolvedSearchParams?.page);
  const currentPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  const { products, allCategories, total, limit } = await CatalogService.getHomeCatalog({
    category: currentCategory,
    search: searchQuery,
    page: currentPage,
    limit: 12,
    sort: currentSort,
  });

  return (
    <HomeView
      products={products}
      allCategories={allCategories}
      currentCategory={currentCategory}
      searchQuery={searchQuery}
      total={total}
      page={currentPage}
      pageSize={limit}
      currentSort={currentSort}
    />
  );
}
