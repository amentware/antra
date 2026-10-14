/**
 * Antra — default categories and category palette. Category colours are stored
 * as hex strings; the UI derives soft tinted backgrounds from them.
 */

export interface DefaultCategory {
  name: string
  emoji: string
  color: string
}

/** Shipped defaults. `Other` is the fallback bucket for the public API. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & Dining', emoji: '🍽️', color: '#F26B1D' },
  { name: 'Groceries', emoji: '🛒', color: '#2FA36B' },
  { name: 'Rent', emoji: '🏠', color: '#6C5CE7' },
  { name: 'Transport', emoji: '🚕', color: '#0A84FF' },
  { name: 'Fuel', emoji: '⛽', color: '#E5484D' },
  { name: 'Shopping', emoji: '🛍️', color: '#E84C9C' },
  { name: 'Bills & Utilities', emoji: '💡', color: '#C99A2E' },
  { name: 'Entertainment', emoji: '🎬', color: '#8E44AD' },
  { name: 'Health', emoji: '🩺', color: '#12A594' },
  { name: 'Travel', emoji: '✈️', color: '#0F8BFF' },
  { name: 'Education', emoji: '📚', color: '#556CD6' },
  { name: 'Subscriptions', emoji: '🔁', color: '#7C6BF2' },
  { name: 'Other', emoji: '📦', color: '#8A8F98' },
]

/** The fallback category name used by the public API when a match fails. */
export const FALLBACK_CATEGORY_NAME = 'Other'

/** Palette offered in the category/account editors. */
export const CATEGORY_PALETTE = [
  '#F26B1D',
  '#E5484D',
  '#E84C9C',
  '#8E44AD',
  '#6C5CE7',
  '#556CD6',
  '#0A84FF',
  '#0F8BFF',
  '#12A594',
  '#2FA36B',
  '#7BB32E',
  '#C99A2E',
  '#8A8F98',
  '#1F2933',
]

/** Emoji suggestions offered in the category editor (free text also allowed). */
export const CATEGORY_EMOJI_CHOICES = [
  '🍽️', '🛒', '🏠', '🚕', '⛽', '🛍️', '💡', '🎬', '🩺', '✈️',
  '📚', '🔁', '📦', '☕', '🍺', '🎁', '🐾', '💇', '🏋️', '🧾',
  '📱', '💊', '🧹', '🎓', '🚌', '🅿️', '🧴', '🎮', '💻', '💳',
]
