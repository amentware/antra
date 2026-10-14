/**
 * Antra — shared currency metadata and formatting.
 *
 * Money is ALWAYS stored as integer minor units (paise, cents, …). Currency is a
 * pure *display* setting: we never convert between currencies.
 *
 * `minorUnits(currency)` returns the number of decimal places for that currency
 * (2 for most, 0 for JPY/KRW/VND, 3 for KWD/BHD/OMR). This is what lets us keep
 * integer math exact regardless of display currency.
 */

export interface CurrencyMeta {
  code: string
  name: string
  symbol: string
  /** Decimal places used for minor-unit storage. */
  decimals: number
  /** Default locale for grouping/number formatting. */
  locale: string
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, locale: 'en-IN' },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, locale: 'en-IE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, locale: 'en-GB' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, locale: 'en-AE' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, locale: 'en-SA' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, locale: 'en-SG' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, locale: 'ja-JP' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2, locale: 'zh-CN' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2, locale: 'en-HK' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2, locale: 'ms-MY' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2, locale: 'th-TH' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2, locale: 'id-ID' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2, locale: 'en-PH' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0, locale: 'vi-VN' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, locale: 'ko-KR' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2, locale: 'en-PK' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2, locale: 'bn-BD' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2, locale: 'en-LK' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', decimals: 2, locale: 'en-NP' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimals: 3, locale: 'en-KW' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'ب.د', decimals: 3, locale: 'en-BH' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimals: 3, locale: 'en-OM' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', decimals: 2, locale: 'en-QA' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, locale: 'en-ZA' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2, locale: 'en-NG' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, locale: 'en-KE' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2, locale: 'en-EG' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2, locale: 'he-IL' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2, locale: 'tr-TR' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2, locale: 'ru-RU' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2, locale: 'pt-BR' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2, locale: 'es-MX' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimals: 2, locale: 'es-AR' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2, locale: 'en-NZ' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2, locale: 'sv-SE' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2, locale: 'nb-NO' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2, locale: 'da-DK' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', decimals: 2, locale: 'pl-PL' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2, locale: 'cs-CZ' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 2, locale: 'hu-HU' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2, locale: 'ro-RO' },
]

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]))

export const DEFAULT_CURRENCY = 'INR'

export function getCurrency(code: string | null | undefined): CurrencyMeta {
  return BY_CODE.get((code ?? DEFAULT_CURRENCY).toUpperCase()) ?? BY_CODE.get(DEFAULT_CURRENCY)!
}

export function isKnownCurrency(code: string): boolean {
  return BY_CODE.has(code.toUpperCase())
}

/** Number of minor-unit decimal places for a currency code. */
export function minorUnits(code: string | null | undefined): number {
  return getCurrency(code).decimals
}

/** Factor to multiply major units by to get minor units (10^decimals). */
export function minorFactor(code: string | null | undefined): number {
  return Math.pow(10, minorUnits(code))
}

/** Plain number formatting (no currency symbol) using the currency's locale. */
export function formatNumber(value: number, currency?: string, opts?: Intl.NumberFormatOptions): string {
  const meta = getCurrency(currency)
  return new Intl.NumberFormat(meta.locale, { maximumFractionDigits: 0, ...opts }).format(value)
}

export interface CurrencyParts {
  /** Currency symbol, e.g. "₹". Empty string if the locale emits the code. */
  symbol: string
  /** Sign, "-" when negative. */
  sign: string
  /** Grouped integer part, e.g. "12,89,292" for INR lakh grouping. */
  integer: string
  /** Decimal digits without the separator, e.g. "90". Empty when decimals = 0. */
  decimal: string
  /** The locale's decimal separator, e.g. "." or ",". */
  decimalSeparator: string
  /** Position of the symbol relative to the number. */
  symbolPlacement: 'prefix' | 'suffix'
}

/**
 * Split a minor-unit amount into parts so the UI can render the integer part
 * large and the decimal part smaller/muted, à la the design reference.
 */
export function formatMinorParts(minor: number, currency?: string): CurrencyParts {
  const meta = getCurrency(currency)
  const dec = meta.decimals
  const negative = minor < 0
  const abs = Math.abs(Math.round(minor))
  const factor = Math.pow(10, dec)
  const intVal = Math.floor(abs / factor)
  const fracVal = abs % factor

  const nf = new Intl.NumberFormat(meta.locale, { useGrouping: true, maximumFractionDigits: 0 })
  const integer = nf.format(intVal)
  const decimal = dec > 0 ? String(fracVal).padStart(dec, '0') : ''

  // Resolve symbol + separator + placement from a tiny probe value.
  const probe = new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
  const probeParts = probe.formatToParts(0.5)
  const symbol = probeParts.find((p) => p.type === 'currency')?.value ?? meta.symbol
  const decimalSeparator = probeParts.find((p) => p.type === 'decimal')?.value ?? '.'
  const firstMeaningful = probeParts.find((p) => p.type === 'integer' || p.type === 'currency')
  const symbolPlacement: 'prefix' | 'suffix' = firstMeaningful?.type === 'currency' ? 'prefix' : 'suffix'

  return {
    symbol,
    sign: negative ? '-' : '',
    integer,
    decimal,
    decimalSeparator,
    symbolPlacement,
  }
}

/** Format a minor-unit amount as a full localized currency string. */
export function formatMinor(
  minor: number,
  currency?: string,
  opts?: { compact?: boolean; signDisplay?: Intl.NumberFormatOptions['signDisplay'] },
): string {
  const meta = getCurrency(currency)
  if (opts?.compact) {
    return formatCompactMinor(minor, currency, opts.signDisplay)
  }
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
    signDisplay: opts?.signDisplay,
  }).format(minor / Math.pow(10, meta.decimals))
}

/** Compact formatting for chart axes, e.g. ₹1.2K / ₹3.4L (lakh) for INR. */
export function formatCompactMinor(minor: number, currency?: string, signDisplay?: Intl.NumberFormatOptions['signDisplay']): string {
  const meta = getCurrency(currency)
  const major = minor / Math.pow(10, meta.decimals)
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    signDisplay,
  }).format(major)
}

/** Examples shown in the Settings currency picker. */
export function currencyExample(code: string): string {
  return formatMinor(1289292, code)
}
