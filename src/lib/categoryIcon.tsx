import { createElement } from 'react'
import {
  BedDouble, Ellipsis, FileBadge, House, ShoppingBasket, Stamp, Tag, Truck, User, Users, Utensils, Wifi, Zap,
  type LucideIcon,
} from 'lucide-react'

// Picked by keyword so categories he adds later still get a sensible icon
const ICONS: [string[], LucideIcon][] = [
  [['salary', 'wage', 'staff'], Users],
  [['accommodation', 'room for staff', 'bed'], BedDouble],
  [['rent', 'room'], House],
  [['food', 'tea', 'meal'], Utensils],
  [['visa'], Stamp],
  [['licence', 'license'], FileBadge],
  [['current', 'electric', 'dewa', 'water'], Zap],
  [['internet', 'phone', 'mobile'], Wifi],
  [['owner'], User],
  [['transport', 'delivery', 'petrol', 'fuel'], Truck],
  [['stock', 'purchase', 'goods'], ShoppingBasket],
  [['other', 'misc'], Ellipsis],
]

// Full class names so Tailwind keeps them
const COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
]

function categoryIcon(name = ''): LucideIcon {
  const n = name.toLowerCase()
  // Check longer keywords first so "Staff Accommodation" isn't matched as "staff"
  return ICONS.find(([words]) => words.some((w) => w.length > 5 && n.includes(w)))?.[1]
    ?? ICONS.find(([words]) => words.some((w) => n.includes(w)))?.[1]
    ?? Tag
}

function categoryColor(id: number): string {
  return COLORS[id % COLORS.length]
}

export function CategoryBadge({ id, name, size = 'md' }: { id: number; name?: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-10 w-10'
  return (
    <span className={`flex ${box} flex-none items-center justify-center rounded-xl ${categoryColor(id)}`}>
      {createElement(categoryIcon(name), { size: size === 'lg' ? 22 : 20, strokeWidth: 2 })}
    </span>
  )
}
