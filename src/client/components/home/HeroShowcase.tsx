'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Search, Star } from 'lucide-react';

type ProductCard = {
  name: string;
  reviews: number;
  image: string;
};

type ShowcaseCategory = {
  id: string;
  label: string;
  centerImage: string;
  centerAlt: string;
  lifestyleLeft: string;
  lifestyleRight: string;
  accent: string;
  innerLeft: string;
  innerRight: string;
  leftCard: ProductCard;
  rightCard: ProductCard;
};

// Ảnh trung tâm là PNG trong suốt; ảnh trong khung vuông là ảnh lifestyle mẫu.
// Thay các đường dẫn ở đây bằng ảnh thật khi có bộ ảnh của từng danh mục.
export const HERO_SHOWCASES: ShowcaseCategory[] = [
  {
    id: 'smartphones',
    label: 'Điện thoại',
    centerImage: '/showcase/smartphones.png',
    centerAlt: 'Cụm điện thoại thông minh, đồng hồ thông minh và tai nghe không dây',
    lifestyleLeft: '/showcase/smartphones-lifestyle.png',
    lifestyleRight: '/showcase/smartphones-lifestyle-2.png',
    accent: '#eeebfa',
    innerLeft: 'Luôn kết nối',
    innerRight: 'Công nghệ trong tầm tay',
    leftCard: { name: 'Điện thoại thông minh', reviews: 128, image: '/showcase/smartphones.png' },
    rightCard: { name: 'Đồng hồ thông minh', reviews: 86, image: '/showcase/smartphones.png' },
  },
  {
    id: 'laptops',
    label: 'Laptop',
    centerImage: '/showcase/laptops.png',
    centerAlt: 'Cụm laptop, bàn phím và chuột không dây',
    lifestyleLeft: '/showcase/laptops-lifestyle.png',
    lifestyleRight: '/showcase/laptops-lifestyle-2.png',
    accent: '#edf0f8',
    innerLeft: 'Làm việc linh hoạt',
    innerRight: 'Không gian sáng tạo',
    leftCard: { name: 'Laptop siêu mỏng', reviews: 204, image: '/showcase/laptops.png' },
    rightCard: { name: 'Bàn phím không dây', reviews: 97, image: '/showcase/laptops.png' },
  },
  {
    id: 'audio',
    label: 'Âm thanh',
    centerImage: '/showcase/audio.png',
    centerAlt: 'Cụm tai nghe chụp tai, loa Bluetooth và tai nghe không dây',
    lifestyleLeft: '/showcase/audio-lifestyle.png',
    lifestyleRight: '/showcase/audio-lifestyle-2.png',
    accent: '#e9edf3',
    innerLeft: 'Âm thanh cá nhân',
    innerRight: 'Góc giải trí',
    leftCard: { name: 'Tai nghe chống ồn', reviews: 73, image: '/showcase/audio.png' },
    rightCard: { name: 'Loa Bluetooth', reviews: 151, image: '/showcase/audio.png' },
  },
];

const spring = { type: 'spring' as const, stiffness: 260, damping: 24 };

function ProductShowcaseCard({ product }: { product: ProductCard }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-lg sm:p-3">
      <div className="relative mb-2 h-14 overflow-hidden rounded-xl bg-[#f2f3f8] sm:h-24">
        <Image src={product.image} alt="" fill sizes="(max-width: 640px) 130px, 190px" className="object-contain" />
      </div>
      <p className="truncate text-[10px] font-semibold text-slate-900 sm:text-sm">{product.name}</p>
      <div className="mt-1 flex items-center gap-1">
        <span className="flex shrink-0 text-amber-400" aria-label="5 trên 5 sao">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="size-2 fill-current sm:size-3" aria-hidden="true" />
          ))}
        </span>
        <span className="text-[9px] text-slate-500 sm:text-xs">({product.reviews})</span>
      </div>
    </div>
  );
}

function EditorialTile({
  category,
  label,
  side,
}: {
  category: ShowcaseCategory;
  label: string;
  side: 'left' | 'right';
}) {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-2xl border border-black/5 shadow-[0_16px_40px_rgba(40,30,30,0.10)]"
      style={{ backgroundColor: category.accent }}
    >
      <Image
        src={side === 'left' ? category.lifestyleLeft : category.lifestyleRight}
        alt=""
        fill
        sizes="(max-width: 640px) 130px, 220px"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 pb-2 pt-9 text-left text-[9px] font-medium text-white sm:px-4 sm:pb-4 sm:text-xs">
        {label}
      </div>
    </div>
  );
}

export function HeroShowcase({ searchQuery = '' }: { searchQuery?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const category = HERO_SHOWCASES[activeIndex];

  useEffect(() => {
    if (reduceMotion) return;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % HERO_SHOWCASES.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const enter = (x: number, delay: number) => ({
    initial: reduceMotion ? false : { x, y: 10, scale: 0.88, opacity: 0 },
    animate: { x: 0, y: 0, scale: 1, opacity: 1 },
    transition: reduceMotion ? { duration: 0 } : { ...spring, delay },
  });

  return (
    <div className="rounded-[32px] bg-white px-3 pb-10 pt-8 sm:px-8 sm:pt-12">
      <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-shop-violet">
        Khám phá công nghệ mỗi ngày
      </div>

      <div className="relative mx-auto h-[300px] w-full max-w-[1080px] sm:h-[380px] lg:h-[430px]" aria-live="off">
        <AnimatePresence mode="wait">
          <motion.div
            key={category.id}
            className="absolute inset-0 isolate"
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
          >
            <div className="absolute left-[3%] top-[14%] z-10 w-[36%] max-w-[220px] sm:left-[17%] sm:top-[13%]">
              <motion.div {...enter(40, 0.1)}>
                <EditorialTile category={category} label={category.innerLeft} side="left" />
              </motion.div>
            </div>
            <div className="absolute right-[3%] top-[14%] z-10 w-[36%] max-w-[220px] sm:right-[17%] sm:top-[13%]">
              <motion.div {...enter(-40, 0.1)}>
                <EditorialTile category={category} label={category.innerRight} side="right" />
              </motion.div>
            </div>

            <div className="absolute inset-y-0 left-1/2 z-20 w-[56%] max-w-[390px] -translate-x-1/2">
              <motion.div {...enter(0, 0)} className="relative h-full w-full">
                <Image
                  src={category.centerImage}
                  alt={category.centerAlt}
                  fill
                  loading="eager"
                  sizes="(max-width: 640px) 56vw, 390px"
                  className="object-contain drop-shadow-[0_24px_24px_rgba(50,40,40,0.13)]"
                />
              </motion.div>
            </div>

            <div className="absolute left-[3%] top-[45%] z-30 w-[33%] max-w-[185px] sm:top-[48%]">
              <motion.div {...enter(40, 0.18)}>
                <ProductShowcaseCard product={category.leftCard} />
              </motion.div>
            </div>
            <div className="absolute right-[3%] top-[45%] z-30 w-[33%] max-w-[185px] sm:top-[48%]">
              <motion.div {...enter(-40, 0.18)}>
                <ProductShowcaseCard product={category.rightCard} />
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-1 flex items-center justify-center gap-2" aria-label="Danh mục đang hiển thị">
        {HERO_SHOWCASES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Xem ${item.label}`}
            aria-current={index === activeIndex ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-7 bg-shop-violet' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
          />
        ))}
      </div>

      <h1 className="mt-5 text-center text-6xl font-semibold tracking-[-0.09em] text-ink-black sm:text-7xl">shop<span className="text-shop-violet">.</span></h1>

      <form action="/" method="GET" role="search" className="mx-auto mt-7 max-w-xl">
        <div className="flex items-center rounded-full border border-black/10 bg-white py-1.5 pl-5 pr-1.5 shadow-[0_12px_36px_rgba(35,26,26,0.08)] focus-within:border-shop-violet/50">
          <Search className="mr-3 size-5 shrink-0 text-muted-gray" aria-hidden="true" />
          <input
            type="search"
            name="search"
            defaultValue={searchQuery}
            placeholder="Bạn đang tìm sản phẩm nào hôm nay?"
            aria-label="Tìm kiếm sản phẩm"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-black placeholder:text-muted-gray focus:outline-none sm:text-base"
          />
          <button type="submit" aria-label="Tìm kiếm" className="ml-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-shop-violet text-white shadow-violet transition hover:bg-shop-violet-deep">
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
