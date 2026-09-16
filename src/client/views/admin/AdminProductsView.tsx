'use client';

import { useState, useRef } from 'react';
import { formatVND } from '@/lib/utils';
import { toast } from 'sonner';
import type { Product } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { Upload, Loader2, Image as ImageIcon, X, Package } from 'lucide-react';

export function AdminProductManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 10,
    category: '',
    image: '',
    isActive: true,
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      description: '',
      price: 100000,
      stock: 10,
      category: 'Thời trang',
      image: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      category: product.category || '',
      image: product.image || '',
      isActive: product.isActive,
    });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProduct) {
        // Update
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, ...form }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? data.product : p))
        );
        toast.success('Đã cập nhật sản phẩm!');
      } else {
        // Create
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setProducts((prev) => [data.product, ...prev]);
        toast.success('Đã tạo sản phẩm mới!');
      }
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xử lý');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa "${name}"?`)) return;

    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Xóa thất bại');

      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Đã xóa sản phẩm');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa');
    }
  };

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  const filteredProducts = products.filter((p) => {
    if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium">Sản phẩm</span>
          </div>
          <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none w-52"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm text-sm"
          >
            <span>+</span>
            <span>Thêm sản phẩm mới</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">Danh mục</th>
                <th className="px-6 py-4">Đơn giá</th>
                <th className="px-6 py-4">Tồn kho</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    {searchQuery || filterCategory !== 'ALL'
                      ? 'Không tìm thấy sản phẩm phù hợp'
                      : 'Chưa có sản phẩm nào'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 relative">
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
                        <div>
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {p.description || 'Không có mô tả'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-full text-xs">
                        {p.category || 'Chưa phân loại'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-600">
                      {formatVND(p.price)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {p.stock}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.isActive ? 'Đang bán' : 'Ẩn'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition text-xs font-medium"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-xs font-medium"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4">
              {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: Áo sơ mi Oxford"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá bán (VND) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số lượng kho *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Danh mục
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Thời trang, Phụ kiện,..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={form.isActive ? 'true' : 'false'}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.value === 'true' })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="true">Đang bán</option>
                    <option value="false">Ẩn</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hình ảnh sản phẩm
                </label>
                <div className="flex gap-4 items-start">
                  {/* Image Preview */}
                  <div className="relative w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center group">
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
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl z-10"
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

                  {/* Input URL & Upload Button */}
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.image}
                        onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                        className="flex-1 px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="https://... hoặc bấm tải ảnh lên"
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
                        className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Chi tiết sản phẩm..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Lưu sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
