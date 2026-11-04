'use client';

import { DropdownMenu } from '@animate-ui/react/primitives/radix-ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';

export interface AdminFilterOption {
  value: string;
  label: string;
}

export function AdminFilterMenu({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: readonly AdminFilterOption[];
  onValueChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? label;
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button type="button" aria-label={`${label}: ${selected}`} className="inline-flex min-h-10 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-700">
        <span>{selected}</span><ChevronDown className="size-3.5 text-slate-500" aria-hidden="true" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="start" sideOffset={6} className="z-50 min-w-[180px] rounded-md border border-slate-200 bg-white p-1 shadow-lg focus:outline-none">
        <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold text-slate-500">{label}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => <DropdownMenu.RadioItem key={option.value} value={option.value} className="relative flex min-h-9 cursor-pointer items-center rounded px-2 pr-7 text-xs text-slate-700 outline-none data-[highlighted]:bg-slate-100">
            {option.label}
            <DropdownMenu.ItemIndicator className="absolute right-2"><Check className="size-3.5" /></DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
