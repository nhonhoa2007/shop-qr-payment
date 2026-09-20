import { CatalogService } from '@/server/modules/catalog/catalog.service';
import { HomeView } from '@client/views/HomeView';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams?: Promise<{ category?: string; search?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const currentCategory = resolvedSearchParams?.category?.trim() || null;
  const searchQuery = resolvedSearchParams?.search?.trim() || null;

  const { products, allCategories } = await CatalogService.getHomeCatalog({
    category: currentCategory,
    search: searchQuery,
  });

  return (
    <HomeView
      products={products}
      allCategories={allCategories}
      currentCategory={currentCategory}
      searchQuery={searchQuery}
    />
  );
}
