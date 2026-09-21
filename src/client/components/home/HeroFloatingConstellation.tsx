'use client';

import React, { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@shared/types';
import { formatVND } from '@shared/utils';
import { Star, ShieldCheck, Sparkles, ArrowUpRight } from 'lucide-react';

export interface HeroFloatingConstellationProps {
  products: Product[];
}

export function HeroFloatingConstellation({ products }: HeroFloatingConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Pick 3 representative hero products for the constellation
  const heroProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products.slice(0, 3);
  }, [products]);

  const pLeft = heroProducts[0];
  const pCenter = heroProducts[1] || heroProducts[0];
  const pRight = heroProducts[2] || heroProducts[0];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const y = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    setMouseOffset({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMouseOffset({ x: 0, y: 0 });
  };

  if (heroProducts.length === 0) {
    return null;
  }

  // Parallax calculations
  const rotX = isHovered ? -mouseOffset.y * 6 : 0;
  const rotY = isHovered ? mouseOffset.x * 8 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative select-none pt-4 pb-2 perspective-[1000px] overflow-visible"
    >
      {/* 3D FLOATING CONSTELLATION CONTAINER */}
      <div
        className="flex justify-center items-end gap-3 sm:gap-6 md:gap-8 h-48 sm:h-56 md:h-64 mb-6 transition-transform duration-300 ease-out"
        style={{
          transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* ========================================================= */}
        {/* 1. LEFT CARD (FLOATING LEVITATION - SLOW) */}
        {/* ========================================================= */}
        {pLeft && (
          <div
            className="animate-float-slow flex-shrink-0 flex flex-col items-center"
            style={{
              transform: `translate3d(${mouseOffset.x * -12}px, ${mouseOffset.y * -8}px, 20px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            <Link
              href={`/products/${pLeft.id}`}
              className="group block bg-white rounded-[24px] sm:rounded-[28px] p-2 sm:p-2.5 shadow-card-custom hover:shadow-card-hover-custom transition-all duration-300 w-28 sm:w-36 md:w-40 border border-[#ebebeb]/60"
            >
              <div className="aspect-square relative bg-[#f2f4f5] rounded-[18px] sm:rounded-[20px] overflow-hidden mb-2">
                {pLeft.image ? (
                  <Image
                    src={pLeft.image}
                    alt={pLeft.name}
                    fill
                    sizes="160px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Sản phẩm
                  </div>
                )}
                {pLeft.category && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[10px] font-semibold text-slate-800 shadow-xs">
                    {pLeft.category}
                  </span>
                )}
              </div>
              <div className="px-1">
                <p className="text-[11px] sm:text-xs font-semibold text-[#000000] truncate tracking-[-0.014em]">
                  {pLeft.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] font-bold text-[#5433eb]">
                    {formatVND(pLeft.price)}
                  </span>
                  <span className="flex items-center text-[10px] text-amber-500 font-bold">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                    4.9
                  </span>
                </div>
              </div>
            </Link>

            {/* Breathing Ground Shadow */}
            <div className="w-20 sm:w-28 h-3 rounded-full bg-slate-900/10 blur-[6px] mt-2 animate-shadow-pulse pointer-events-none" />
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. CENTER HERO CARD (MAJESTIC FLOATING - MEDIUM) */}
        {/* ========================================================= */}
        {pCenter && (
          <div
            className="animate-float-medium flex-shrink-0 flex flex-col items-center z-10 -translate-y-3 sm:-translate-y-4"
            style={{
              transform: `translate3d(${mouseOffset.x * 16}px, ${mouseOffset.y * 12}px, 60px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            {/* Playful Miniature Persona Badge (Surreal Diorama Touch) */}
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 border border-[#5433eb]/20 shadow-soft-sm-custom text-[10px] font-bold text-[#5433eb] mb-1.5 backdrop-blur-xs">
              <Sparkles className="w-3 h-3 text-[#5433eb] animate-spin" style={{ animationDuration: '4s' }} />
              <span>Tuyển chọn đặc quyền</span>
            </div>

            <Link
              href={`/products/${pCenter.id}`}
              className="group block bg-white rounded-[26px] sm:rounded-[30px] p-2.5 sm:p-3 shadow-card-hover-custom transition-all duration-300 w-36 sm:w-48 md:w-52 border border-[#ebebeb] relative overflow-hidden"
            >
              <div className="aspect-square relative bg-[#f2f4f5] rounded-[20px] sm:rounded-[22px] overflow-hidden mb-2.5">
                {pCenter.image ? (
                  <Image
                    src={pCenter.image}
                    alt={pCenter.name}
                    fill
                    priority
                    sizes="220px"
                    className="object-cover group-hover:scale-108 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
                    Sản phẩm
                  </div>
                )}
                {/* 100% VietQR badge */}
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[10px] font-bold text-emerald-700 shadow-xs">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>VietQR tức thì</span>
                </span>
              </div>

              <div className="px-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {pCenter.category || 'Shop Hot'}
                  </span>
                  <span className="flex items-center text-[11px] text-amber-500 font-extrabold">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                    5.0 (Tuyển chọn)
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#000000] truncate tracking-[-0.014em] group-hover:text-[#5433eb] transition-colors">
                  {pCenter.name}
                </p>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs sm:text-sm font-extrabold text-[#5433eb] tracking-tight">
                    {formatVND(pCenter.price)}
                  </span>
                  <span className="p-1 rounded-full bg-slate-50 text-slate-600 group-hover:bg-[#5433eb] group-hover:text-white transition">
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Breathing Hero Ground Shadow */}
            <div className="w-28 sm:w-36 h-4 rounded-full bg-slate-900/15 blur-[8px] mt-2 animate-shadow-pulse pointer-events-none" />
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. RIGHT CARD (FLOATING LEVITATION - FAST) */}
        {/* ========================================================= */}
        {pRight && (
          <div
            className="animate-float-fast flex-shrink-0 flex flex-col items-center hidden sm:flex"
            style={{
              transform: `translate3d(${mouseOffset.x * -8}px, ${mouseOffset.y * -14}px, 30px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            <Link
              href={`/products/${pRight.id}`}
              className="group block bg-white rounded-[24px] sm:rounded-[28px] p-2 sm:p-2.5 shadow-card-custom hover:shadow-card-hover-custom transition-all duration-300 w-28 sm:w-36 md:w-40 border border-[#ebebeb]/60"
            >
              <div className="aspect-square relative bg-[#f2f4f5] rounded-[18px] sm:rounded-[20px] overflow-hidden mb-2">
                {pRight.image ? (
                  <Image
                    src={pRight.image}
                    alt={pRight.name}
                    fill
                    sizes="160px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Sản phẩm
                  </div>
                )}
                {pRight.category && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[10px] font-semibold text-slate-800 shadow-xs">
                    {pRight.category}
                  </span>
                )}
              </div>
              <div className="px-1">
                <p className="text-[11px] sm:text-xs font-semibold text-[#000000] truncate tracking-[-0.014em]">
                  {pRight.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] font-bold text-[#5433eb]">
                    {formatVND(pRight.price)}
                  </span>
                  <span className="flex items-center text-[10px] text-amber-500 font-bold">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                    4.8
                  </span>
                </div>
              </div>
            </Link>

            {/* Breathing Ground Shadow */}
            <div className="w-20 sm:w-28 h-3 rounded-full bg-slate-900/10 blur-[6px] mt-2 animate-shadow-pulse pointer-events-none" />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. DYNAMIC WORDMARK "shop." WITH LIQUID VIDEO FLOW SHIMMER */}
      {/* ========================================================= */}
      <div className="inline-flex items-center justify-center gap-1 mb-2 select-none group cursor-default">
        {/* Animated Liquid Gradient Wordmark */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-[-0.05em] bg-clip-text text-transparent bg-gradient-to-r from-[#5433eb] via-[#8338ec] via-[#3a86ff] to-[#5433eb] animate-liquid-flow transition-transform duration-300 group-hover:scale-102"
          title="shop."
        >
          shop
        </h1>

        {/* Signature Dot with Tinted Violet Pulsing Glow */}
        <div className="relative mt-5 sm:mt-6 md:mt-7">
          <span className="block w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-[#5433eb] shadow-violet-custom transition-transform duration-300 group-hover:scale-125" />
          <span className="absolute inset-0 rounded-full bg-[#5433eb] animate-ping opacity-40" />
        </div>
      </div>
    </div>
  );
}
