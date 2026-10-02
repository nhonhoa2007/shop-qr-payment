'use client';

import { useState, useRef, useMemo } from 'react';
import {
  formatVND,
  generateSkuPrefix,
  generateVariantSku,
  generateVariantMatrix,
  calculateVariantSummary,
  validateClientVariants,
} from '@shared/utils';
import { ConfirmDialog } from '@client/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import type { Product, ProductVariant } from '@shared/types';
import Link from 'next/link';
import Image from 'next/image';
import {
  Upload,
  Loader2,
  Image as ImageIcon,
  X,
  Package,
  Layers,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Wand2,
  AlertCircle,
  Tag,
  Info,
  Check,
} from 'lucide-react';

interface VariantFormItem {
  id?: string;
  sku: string;
  title: string;
  price: number;
  stock: number;
  color: string;
  size: string;
  image?: string;
  isActive: boolean;
}

type ProductConfirmState =
  | { type: 'clearVariants' }
  | { type: 'deleteProduct'; id: string; name: string }
  | { type: 'matrixMode'; generated: VariantFormItem[]; count: number }
  | null;

export function AdminProductsView({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'variants'>('general');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mở rộng dòng xem nhanh danh sách biến thể trong bảng
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Form Thông tin cơ bản
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 10,
    category: '',
    image: '',
    isActive: true,
  });

  // Form Danh sách biến thể
  const [variants, setVariants] = useState<VariantFormItem[]>([]);

  // Bộ sinh ma trận biến thể tự động (Quick Matrix Generator)
  const [showMatrixGen, setShowMatrixGen] = useState(false);
  const [matrixColors, setMatrixColors] = useState('');
  const [matrixSizes, setMatrixSizes] = useState('');
  const [matrixSkuPrefix, setMatrixSkuPrefix] = useState('');
  const [matrixPrice, setMatrixPrice] = useState(100000);
  const [matrixStock, setMatrixStock] = useState(10);

  // Dialog xác nhận thay cho confirm() native
  const [confirmState, setConfirmState] = useState<ProductConfirmState>(null);

  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setActiveTab('general');
    setShowMatrixGen(false);
    setForm({
      name: '',
      description: '',
      price: 100000,
      stock: 10,
      category: 'Thời trang',
      image: '',
      isActive: true,
    });
    setVariants([]);
    setMatrixColors('');
    setMatrixSizes('');
    setMatrixPrice(100000);
    setMatrixStock(10);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setActiveTab('general');
    setShowMatrixGen(false);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      category: product.category || '',
      image: product.image || '',
      isActive: product.isActive,
    });

    const existingVariants: VariantFormItem[] = (product.variants || []).map((v) => ({
      id: v.id,
      sku: v.sku || '',
      title: v.title || '',
      price: v.price,
      stock: v.stock,
      color: v.color || '',
      size: v.size || '',
      image: v.image || '',
      isActive: v.isActive !== false,
    }));
    setVariants(existingVariants);

    // Đồng bộ lại biến thể mới nhất từ API chi tiết nếu có
    if (product.id) {
      fetch(`/api/products?id=${product.id}&all=true`)
        .then((res) => res.json())
        .then((data) => {
          if (data.product?.variants) {
            setVariants(
              data.product.variants.map((v: ProductVariant) => ({
                id: v.id,
                sku: v.sku || '',
                title: v.title || '',
                price: v.price,
                stock: v.stock,
                color: v.color || '',
                size: v.size || '',
                image: v.image || '',
                isActive: v.isActive !== false,
              }))
            );
          }
        })
        .catch(() => {});
    }

    setMatrixColors('');
    setMatrixSizes('');
    setMatrixPrice(product.price);
    setMatrixStock(10);
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Vui lòng chọn file hình ảnh (JPG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setUploadingImage(true);
    const toastId = toast.loading('Đang tải ảnh lên...');

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: uploadData,
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Tải ảnh lên thất bại');
      }

      setForm((prev) => ({ ...prev, image: data.url as string }));
      toast.success('Đã tải ảnh lên thành công!', { id: toastId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải ảnh lên', { id: toastId });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Thêm một biến thể đơn lẻ thủ công
  const handleAddSingleVariant = () => {
    const prefix = generateSkuPrefix(form.name);
    const nextIdx = variants.length + 1;
    const suggestedSku = generateVariantSku(prefix, null, null, nextIdx);

    setVariants((prev) => [
      ...prev,
      {
        sku: suggestedSku,
        title: `Biến thể ${nextIdx}`,
        color: '',
        size: '',
        price: form.price || 100000,
        stock: 10,
        image: '',
        isActive: true,
      },
    ]);
  };

  // Cập nhật từng trường trong biến thể
  const handleUpdateVariant = (
    index: number,
    field: keyof VariantFormItem,
    value: string | number | boolean
  ) => {
    setVariants((prev) => {
      const clone = [...prev];
      const current = { ...clone[index], [field]: value };

      // Tự động cập nhật Title và gợi ý SKU khi người dùng đổi Màu hoặc Kích cỡ
      if (field === 'color' || field === 'size') {
        const colorVal = field === 'color' ? String(value) : current.color;
        const sizeVal = field === 'size' ? String(value) : current.size;

        // Nếu title chưa đổi hoặc dạng auto thì cập nhật lại
        const autoTitle = [colorVal.trim(), sizeVal.trim()].filter(Boolean).join(' / ');
        if (autoTitle) {
          current.title = autoTitle;
        }

        // Tự động gợi ý SKU nếu SKU chưa nhập hoặc chỉ có prefix
        const prefix = generateSkuPrefix(form.name);
        current.sku = generateVariantSku(prefix, colorVal, sizeVal, index);
      }

      clone[index] = current;
      return clone;
    });
  };

  // Xóa một biến thể
  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // Xóa toàn bộ biến thể để quay về sản phẩm đơn thể
  const handleClearAllVariants = () => {
    setConfirmState({ type: 'clearVariants' });
  };

  // Kích hoạt sinh ma trận biến thể tự động
  const handleExecuteMatrix = () => {
    const colors = matrixColors.split(/[,;\n]/).map((c) => c.trim()).filter(Boolean);
    const sizes = matrixSizes.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

    if (colors.length === 0 && sizes.length === 0) {
      toast.error('Vui lòng nhập ít nhất một màu sắc hoặc một kích cỡ để sinh biến thể');
      return;
    }

    const generated = generateVariantMatrix({
      productName: form.name,
      skuPrefix: matrixSkuPrefix || generateSkuPrefix(form.name),
      colors,
      sizes,
      basePrice: matrixPrice || form.price || 100000,
      baseStock: matrixStock >= 0 ? matrixStock : 10,
    });

    if (generated.length === 0) {
      toast.error('Không thể sinh biến thể từ dữ liệu đã nhập');
      return;
    }

    if (variants.length > 0) {
      // Đã có biến thể: hỏi người dùng muốn thêm vào hay thay thế toàn bộ
      setConfirmState({ type: 'matrixMode', generated: generated as VariantFormItem[], count: generated.length });
      return;
    }
    setVariants(generated as VariantFormItem[]);

    toast.success(`Đã tạo thành công ${generated.length} biến thể!`);
    setShowMatrixGen(false);
  };

  // Tính toán tóm tắt biến thể trong form
  const variantSummary = useMemo(() => {
    return calculateVariantSummary(variants);
  }, [variants]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      setActiveTab('general');
      return;
    }

    // Xác thực danh sách biến thể nếu có
    if (variants.length > 0) {
      const clientValidation = validateClientVariants(variants);
      if (!clientValidation.valid) {
        toast.error(clientValidation.error || 'Dữ liệu biến thể chưa hợp lệ');
        setActiveTab('variants');
        return;
      }
    }

    setLoading(true);

    try {
      const totalStock =
        variants.length > 0
          ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
          : Number(form.stock) || 0;

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price) || 0,
        stock: totalStock,
        category: form.category.trim() || null,
        image: form.image.trim() || null,
        isActive: form.isActive,
        variants:
          variants.length > 0
            ? variants.map((v, idx) => ({
                id: v.id,
                sku: v.sku.trim(),
                title: (
                  v.title.trim() ||
                  [v.color, v.size].filter(Boolean).join(' / ') ||
                  `Biến thể ${idx + 1}`
                ).trim(),
                price: Math.max(0, Number(v.price) || 0),
                stock: Math.max(0, Number(v.stock) || 0),
                color: v.color?.trim() || null,
                size: v.size?.trim() || null,
                image: v.image?.trim() || null,
                isActive: v.isActive !== false,
              }))
            : [],
      };

      if (editingProduct) {
        // Cập nhật sản phẩm & biến thể
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Cập nhật sản phẩm thất bại');

        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? data.product : p))
        );
        toast.success(
          `Đã cập nhật sản phẩm "${data.product.name}"${
            variants.length > 0 ? ` cùng ${variants.length} biến thể!` : '!'
          }`
        );
      } else {
        // Tạo sản phẩm mới kèm biến thể
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Tạo sản phẩm thất bại');

        setProducts((prev) => [data.product, ...prev]);
        toast.success(
          `Đã tạo sản phẩm mới "${data.product.name}"${
            variants.length > 0 ? ` kèm ${variants.length} biến thể!` : '!'
          }`
        );
      }
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xử lý sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Xóa thất bại');

      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success(`Đã xóa sản phẩm "${name}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa sản phẩm');
    }
  };

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const matchSku = (p.variants || []).some(
          (v) => (v.sku || '').toLowerCase().includes(q) || (v.title || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchDesc && !matchSku) return false;
      }
      return true;
    });
  }, [products, filterCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-700">Sản phẩm & Kho hàng</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Quản lý sản phẩm
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
              {products.length} sản phẩm
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Tìm tên, SKU biến thể..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none w-56 shadow-2xs"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm mới</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">Danh mục</th>
                <th className="px-6 py-4 text-center">Biến thể</th>
                <th className="px-6 py-4">Đơn giá</th>
                <th className="px-6 py-4">Tồn kho</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 text-gray-300 opacity-60" />
                    <p className="font-medium text-gray-500">
                      {searchQuery || filterCategory !== 'ALL'
                        ? 'Không tìm thấy sản phẩm phù hợp với bộ lọc'
                        : 'Chưa có sản phẩm nào trong hệ thống'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const hasVariants = Boolean(p.variants && p.variants.length > 0);
                  const isExpanded = expandedProductIds.has(p.id);
                  const pSummary = calculateVariantSummary(p.variants || []);

                  return (
                    <tr key={p.id} className="group hover:bg-slate-50/60 transition-colors">
                      <td colSpan={7} className="p-0">
                        {/* Main Product Row */}
                        <div className="flex items-center w-full px-6 py-4">
                          {/* Col 1: Sản phẩm */}
                          <div className="flex items-center gap-3.5 flex-1 min-w-[240px]">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200/70 overflow-hidden flex-shrink-0 relative shadow-2xs">
                              {p.image ? (
                                <Image
                                  src={p.image}
                                  alt={p.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <Package className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 pr-4">
                              <p className="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {p.name}
                              </p>
                              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                {p.description || 'Chưa có mô tả'}
                              </p>
                            </div>
                          </div>

                          {/* Col 2: Danh mục */}
                          <div className="w-32 flex-shrink-0 text-gray-600">
                            <span className="inline-block bg-gray-100/80 border border-gray-200/50 px-2.5 py-0.5 rounded-lg text-xs font-medium text-gray-700">
                              {p.category || 'Chưa phân loại'}
                            </span>
                          </div>

                          {/* Col 3: Badge biến thể */}
                          <div className="w-36 flex-shrink-0 flex items-center justify-center">
                            {hasVariants ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(p.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                  isExpanded
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                }`}
                                title="Bấm để xem danh sách biến thể chi tiết"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>{p.variants!.length} biến thể</span>
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 ml-0.5 text-purple-500" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                <span>Đơn thể</span>
                              </span>
                            )}
                          </div>

                          {/* Col 4: Đơn giá */}
                          <div className="w-36 flex-shrink-0 font-bold">
                            {hasVariants && pSummary.hasPriceRange ? (
                              <div>
                                <span className="text-blue-600 text-xs sm:text-sm font-extrabold">
                                  {formatVND(pSummary.minPrice)} - {formatVND(pSummary.maxPrice)}
                                </span>
                                <p className="text-[10px] text-gray-400 font-normal">Đa mức giá</p>
                              </div>
                            ) : (
                              <span className="text-blue-600 font-bold">
                                {formatVND(p.price)}
                              </span>
                            )}
                          </div>

                          {/* Col 5: Tồn kho */}
                          <div className="w-28 flex-shrink-0">
                            <span
                              className={`font-bold text-sm ${
                                p.stock === 0
                                  ? 'text-rose-600'
                                  : p.stock <= 5
                                  ? 'text-amber-600'
                                  : 'text-gray-800'
                              }`}
                            >
                              {p.stock}
                            </span>
                            {hasVariants && (
                              <p className="text-[10px] text-gray-400 font-normal">
                                tổng {p.variants!.length} loại
                              </p>
                            )}
                          </div>

                          {/* Col 6: Trạng thái */}
                          <div className="w-28 flex-shrink-0">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                p.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                            >
                              {p.isActive ? 'Đang bán' : 'Ẩn'}
                            </span>
                          </div>

                          {/* Col 7: Thao tác */}
                          <div className="w-32 flex-shrink-0 text-right flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition text-xs font-semibold"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmState({ type: 'deleteProduct', id: p.id, name: p.name })}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition text-xs font-semibold"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Variants Detail Sub-Table */}
                        {hasVariants && isExpanded && (
                          <div className="bg-slate-50/90 border-t border-b border-purple-100 px-6 py-4 animate-fade-in">
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-purple-600" />
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                                  Danh sách các biến thể của &ldquo;{p.name}&rdquo;
                                </span>
                                <span className="text-xs text-gray-500 font-medium">
                                  ({p.variants!.length} phiên bản)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                              >
                                <span>Chỉnh sửa biến thể</span>
                                <span>→</span>
                              </button>
                            </div>

                            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-2xs">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-2.5">Mã SKU</th>
                                    <th className="px-4 py-2.5">Phiên bản / Tiêu đề</th>
                                    <th className="px-4 py-2.5">Màu sắc</th>
                                    <th className="px-4 py-2.5">Kích thước</th>
                                    <th className="px-4 py-2.5">Đơn giá</th>
                                    <th className="px-4 py-2.5">Kho hàng</th>
                                    <th className="px-4 py-2.5">Trạng thái</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {p.variants!.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2 font-mono font-bold text-gray-800">
                                        {v.sku || '---'}
                                      </td>
                                      <td className="px-4 py-2 font-medium text-gray-900">
                                        {v.title}
                                      </td>
                                      <td className="px-4 py-2 text-gray-600">
                                        {v.color ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 font-medium">
                                            {v.color}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">---</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-gray-600">
                                        {v.size ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold">
                                            {v.size}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">---</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 font-bold text-blue-600">
                                        {formatVND(v.price)}
                                      </td>
                                      <td className="px-4 py-2 font-semibold">
                                        <span
                                          className={
                                            v.stock === 0
                                              ? 'text-rose-600 font-bold'
                                              : v.stock <= 5
                                              ? 'text-amber-600'
                                              : 'text-gray-800'
                                          }
                                        >
                                          {v.stock}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            v.isActive
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                              : 'bg-gray-100 text-gray-500'
                                          }`}
                                        >
                                          {v.isActive ? 'Đang bán' : 'Ẩn'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Chỉnh sửa Sản phẩm & Biến thể */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl animate-fade-in flex flex-col max-h-[92vh] border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
                    <Package className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingProduct ? `Chỉnh sửa: ${editingProduct.name}` : 'Thêm sản phẩm mới'}
                  </h2>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Thiết lập thông tin chung, giá, tồn kho và các biến thể phân loại (Size, Màu, SKU).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                title="Đóng modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Tabs */}
            <div className="flex items-center gap-2 pt-4 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'general'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Thông tin chung</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('variants')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'variants'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Cấu hình biến thể</span>
                {variants.length > 0 && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-xs font-extrabold ${
                      activeTab === 'variants'
                        ? 'bg-purple-800 text-white'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {variants.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body / Tab Contents */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto pr-1 space-y-5 py-3">
              {activeTab === 'general' ? (
                /* TAB 1: THÔNG TIN CHUNG */
                <div className="space-y-4">
                  {variants.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/70 flex items-start gap-3 text-purple-900">
                      <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold">
                          Sản phẩm hiện đang có {variants.length} biến thể (tổng kho:{' '}
                          {variantSummary.totalStock} sp).
                        </p>
                        <p className="text-purple-700 mt-0.5">
                          Tồn kho tổng của sản phẩm sẽ được tự động đồng bộ theo tổng tồn kho của
                          từng biến thể. Bạn có thể sang tab &ldquo;Cấu hình biến thể&rdquo; để quản
                          lý chi tiết từng Size/Màu.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên sản phẩm *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
                      placeholder="Ví dụ: Áo Sơ Mi Oxford Cotton Cao Cấp"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Giá bán mặc định (VND) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Giá gốc hoặc giá niêm yết khi sản phẩm không có biến thể riêng
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Số lượng tồn kho {variants.length > 0 && '(Tự động đồng bộ)'} *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        disabled={variants.length > 0}
                        value={variants.length > 0 ? variantSummary.totalStock : form.stock}
                        onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                        className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                          variants.length > 0 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                        }`}
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        {variants.length > 0
                          ? `Đồng bộ từ tổng tồn kho của ${variants.length} biến thể`
                          : 'Số lượng hàng thực tế trong kho'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Danh mục
                      </label>
                      <input
                        type="text"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Thời trang, Phụ kiện, Giày dép..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trạng thái kinh doanh
                      </label>
                      <select
                        value={form.isActive ? 'true' : 'false'}
                        onChange={(e) =>
                          setForm({ ...form, isActive: e.target.value === 'true' })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="true">Đang bán (Hiển thị khách mua)</option>
                        <option value="false">Tạm ẩn (Không hiển thị)</option>
                      </select>
                    </div>
                  </div>

                  {/* Hình ảnh */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hình ảnh đại diện sản phẩm
                    </label>
                    <div className="flex gap-4 items-start">
                      <div className="relative w-20 h-20 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center group shadow-2xs">
                        {form.image ? (
                          <>
                            <Image
                              src={form.image}
                              alt="Preview"
                              fill
                              sizes="80px"
                              className="object-cover"
                              unoptimized
                            />
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, image: '' }))}
                              className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl z-10 cursor-pointer"
                              title="Xóa ảnh"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                            <ImageIcon className="w-6 h-6 mb-1 text-gray-300" />
                            <span className="text-[10px] text-gray-400">Chưa có ảnh</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={form.image}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, image: e.target.value }))
                            }
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Nhập URL ảnh hoặc bấm Tải ảnh lên..."
                            disabled={uploadingImage}
                          />
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                          />
                          <button
                            type="button"
                            disabled={uploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 cursor-pointer"
                          >
                            {uploadingImage ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span>Đang tải...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 text-gray-600" />
                                <span>Tải ảnh lên</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">
                          Hỗ trợ JPG, PNG, WEBP, GIF (tối đa 5MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mô tả */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mô tả chi tiết
                    </label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Chi tiết chất liệu, kiểu dáng, hướng dẫn chọn size..."
                    />
                  </div>
                </div>
              ) : (
                /* TAB 2: CẤU HÌNH BIẾN THỂ */
                <div className="space-y-4">
                  {/* Variants Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-100/80 text-purple-800 text-xs font-bold border border-purple-200/70">
                        <Layers className="w-3.5 h-3.5 text-purple-600" />
                        <span>{variants.length} biến thể</span>
                      </span>
                      {variants.length > 0 && (
                        <>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200/70">
                            <span>Tổng kho: {variantSummary.totalStock}</span>
                          </span>
                          {variantSummary.hasPriceRange && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/70">
                              <span>
                                {formatVND(variantSummary.minPrice)} -{' '}
                                {formatVND(variantSummary.maxPrice)}
                              </span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowMatrixGen(!showMatrixGen)}
                        className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>{showMatrixGen ? 'Đóng bộ sinh' : '⚡ Sinh nhanh'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddSingleVariant}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm biến thể</span>
                      </button>

                      {variants.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllVariants}
                          className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                          title="Xóa tất cả biến thể"
                        >
                          Xóa hết
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Quick Matrix Generator Panel */}
                  {showMatrixGen && (
                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wand2 className="w-4 h-4 text-purple-700" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                            Sinh tổ hợp ma trận biến thể tự động (Size x Màu)
                          </h4>
                        </div>
                        <span className="text-[11px] text-purple-600">
                          Tiết kiệm 95% thời gian nhập liệu
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            Các kích cỡ (Size) - Phân cách bằng dấu phẩy
                          </label>
                          <input
                            type="text"
                            value={matrixSizes}
                            onChange={(e) => setMatrixSizes(e.target.value)}
                            placeholder="Ví dụ: S, M, L, XL hoặc 39, 40, 41, 42"
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            Các màu sắc (Color) - Phân cách bằng dấu phẩy
                          </label>
                          <input
                            type="text"
                            value={matrixColors}
                            onChange={(e) => setMatrixColors(e.target.value)}
                            placeholder="Ví dụ: Đen, Trắng, Xanh Navy, Đỏ Cherry"
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            Tiền tố mã SKU
                          </label>
                          <input
                            type="text"
                            value={matrixSkuPrefix}
                            onChange={(e) => setMatrixSkuPrefix(e.target.value)}
                            placeholder="Ví dụ: AO-POLO"
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">
                              Giá bán (đ)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={matrixPrice}
                              onChange={(e) => setMatrixPrice(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">
                              Kho mỗi loại
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={matrixStock}
                              onChange={(e) => setMatrixStock(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-200/60">
                        <button
                          type="button"
                          onClick={() => setShowMatrixGen(false)}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-white rounded-lg transition"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleExecuteMatrix}
                          className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Sinh biến thể ngay</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Variants Config Table */}
                  {variants.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-3">
                        <Layers className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">
                        Chưa cấu hình biến thể nào
                      </h4>
                      <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
                        Sản phẩm hiện đang ở dạng đơn thể. Bổ sung các phiên bản phân loại kích
                        thước, màu sắc để khách hàng có thể lựa chọn khi đặt mua.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleAddSingleVariant}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Thêm biến thể thủ công</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMatrixGen(true)}
                          className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Wand2 className="w-4 h-4" />
                          <span>⚡ Sinh tổ hợp Size x Màu</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-3 w-10 text-center">#</th>
                              <th className="px-3 py-3 min-w-[130px]">Mã SKU *</th>
                              <th className="px-3 py-3 min-w-[140px]">Tên / Phiên bản *</th>
                              <th className="px-3 py-3 w-28">Kích thước (Size)</th>
                              <th className="px-3 py-3 w-28">Màu sắc (Color)</th>
                              <th className="px-3 py-3 min-w-[120px]">Giá bán (đ) *</th>
                              <th className="px-3 py-3 w-24">Tồn kho *</th>
                              <th className="px-3 py-3 w-16 text-center">Bán</th>
                              <th className="px-3 py-3 w-12 text-center">Xóa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {variants.map((v, idx) => {
                              const isSkuEmpty = !v.sku.trim();
                              const isSkuDuplicate = variants.some(
                                (other, oIdx) =>
                                  oIdx !== idx &&
                                  other.sku.trim().toLowerCase() === v.sku.trim().toLowerCase()
                              );

                              return (
                                <tr key={v.id || idx} className="hover:bg-gray-50/70 transition">
                                  <td className="px-3 py-2 text-center text-gray-400 font-medium">
                                    {idx + 1}
                                  </td>

                                  {/* Mã SKU */}
                                  <td className="px-3 py-2">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        required
                                        value={v.sku}
                                        onChange={(e) =>
                                          handleUpdateVariant(idx, 'sku', e.target.value)
                                        }
                                        placeholder="Mã SKU..."
                                        className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-xs outline-none focus:ring-1 ${
                                          isSkuEmpty || isSkuDuplicate
                                            ? 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                                            : 'border-gray-200 focus:ring-purple-500 font-bold'
                                        }`}
                                      />
                                      {isSkuDuplicate && (
                                        <span
                                          className="absolute right-2 top-2 text-red-500"
                                          title="Mã SKU bị trùng lặp!"
                                        >
                                          <AlertCircle className="w-3.5 h-3.5" />
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Tiêu đề phiên bản */}
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      required
                                      value={v.title}
                                      onChange={(e) =>
                                        handleUpdateVariant(idx, 'title', e.target.value)
                                      }
                                      placeholder="vd: Đỏ / L"
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                                    />
                                  </td>

                                  {/* Kích thước */}
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={v.size}
                                      onChange={(e) =>
                                        handleUpdateVariant(idx, 'size', e.target.value)
                                      }
                                      placeholder="S, M, 40..."
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                  </td>

                                  {/* Màu sắc */}
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={v.color}
                                      onChange={(e) =>
                                        handleUpdateVariant(idx, 'color', e.target.value)
                                      }
                                      placeholder="Đen, Trắng..."
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                  </td>

                                  {/* Giá */}
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      required
                                      min={0}
                                      value={v.price}
                                      onChange={(e) =>
                                        handleUpdateVariant(idx, 'price', Number(e.target.value))
                                      }
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500 font-bold text-blue-600"
                                    />
                                  </td>

                                  {/* Tồn kho */}
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      required
                                      min={0}
                                      value={v.stock}
                                      onChange={(e) =>
                                        handleUpdateVariant(idx, 'stock', Number(e.target.value))
                                      }
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500 font-bold text-gray-800"
                                    />
                                  </td>

                                  {/* Bật / Tắt bán */}
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={v.isActive}
                                      onChange={(e) =>
                                        handleUpdateVariant(idx, 'isActive', e.target.checked)
                                      }
                                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
                                    />
                                  </td>

                                  {/* Nút Xóa */}
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveVariant(idx)}
                                      className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition cursor-pointer"
                                      title="Xóa biến thể này"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  {variants.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                      <Tag className="w-3.5 h-3.5 text-purple-600" />
                      <span>
                        {variants.length} biến thể | Tổng kho: {variantSummary.totalStock} sp
                      </span>
                    </span>
                  ) : (
                    <span>Sản phẩm đơn thể (chưa có biến thể phân loại)</span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-sm font-semibold cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingImage}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold transition flex items-center gap-2 text-sm disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? 'Đang lưu...' : 'Lưu sản phẩm'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog xác nhận thay cho confirm() native */}
      <ConfirmDialog
        open={confirmState !== null}
        onClose={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.type === 'clearVariants') {
            setVariants([]);
            toast.info('Đã xóa tất cả biến thể');
          } else if (confirmState?.type === 'deleteProduct') {
            handleDelete(confirmState.id, confirmState.name);
          } else if (confirmState?.type === 'matrixMode') {
            setVariants((prev) => [...prev, ...confirmState.generated]);
            toast.success(`Đã thêm ${confirmState.count} biến thể mới!`);
            setShowMatrixGen(false);
          }
          setConfirmState(null);
        }}
        title={
          confirmState?.type === 'clearVariants'
            ? 'Xóa toàn bộ biến thể?'
            : confirmState?.type === 'deleteProduct'
              ? `Xóa sản phẩm "${confirmState.name}"?`
              : `Đã sinh ${confirmState?.type === 'matrixMode' ? confirmState.count : 0} biến thể mới`
        }
        description={
          confirmState?.type === 'clearVariants'
            ? 'Toàn bộ biến thể sẽ được xóa và sản phẩm quay về dạng đơn thể.'
            : confirmState?.type === 'deleteProduct'
              ? 'Sản phẩm và toàn bộ biến thể của nó sẽ bị xóa vĩnh viễn.'
              : confirmState?.type === 'matrixMode'
                ? 'Chọn "Thêm vào" để nối vào danh sách hiện có, hoặc "Thay thế" để ghi đè toàn bộ.'
                : undefined
        }
        confirmLabel={
          confirmState?.type === 'matrixMode' ? 'Thêm vào danh sách' : 'Xóa'
        }
        cancelLabel="Giữ lại"
        variant={confirmState?.type === 'matrixMode' ? 'default' : 'danger'}
        secondaryAction={
          confirmState?.type === 'matrixMode'
            ? {
                label: 'Thay thế toàn bộ',
                onClick: () => {
                  setVariants(confirmState.generated);
                  toast.success(`Đã thay thế bằng ${confirmState.count} biến thể mới!`);
                  setShowMatrixGen(false);
                },
              }
            : undefined
        }
      />
    </div>
  );
}

export { AdminProductsView as AdminProductManager, AdminProductsView as default };
