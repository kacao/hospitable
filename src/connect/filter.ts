import { ConfigurationError } from '../errors'

/**
 * Operators supported by Connect's `field[operator]=value` filter
 * syntax. Multi-value operators accept comma-separated lists; the
 * single-value ones take one value.
 */
export type ConnectFilterOperator =
  /** Include values. Multi-value. */
  | 'is'
  /** Exclude values. Multi-value. */
  | 'not'
  /** `<` — single value. */
  | 'lt'
  /** `<=` — single value. */
  | 'lte'
  /** `>` — single value. */
  | 'gt'
  /** `>=` — single value. */
  | 'gte'
  /** Inclusive range. Two values. */
  | 'between'
  /** `<` date. Single value. */
  | 'before'
  /** `>` date. Single value. */
  | 'after'

const MULTI_VALUE_OPS = new Set<ConnectFilterOperator>(['is', 'not'])
const SINGLE_VALUE_OPS = new Set<ConnectFilterOperator>(['lt', 'lte', 'gt', 'gte', 'before', 'after'])

/**
 * Allowlisted shape for field identifiers. Letters, digits, underscore,
 * and dot (for nested paths like `financials.host`). Must start with a
 * letter or underscore.
 *
 * Enforced on every `field` argument across `where`, `sortAsc`,
 * `sortDesc`, and `select` to block two classes of defect:
 *
 * 1. **Log injection.** Without the guard, a field value containing
 *    newlines / ANSI control codes flows into `ConfigurationError.message`
 *    and then into any structured-log sink the caller uses (Sentry,
 *    CloudWatch, etc.). AI agents composing filters from LLM output
 *    are the realistic attack surface.
 * 2. **Param-key corruption.** A field containing `]` or `[` would
 *    produce a malformed `field[operator]` key that the API would reject
 *    with an unhelpful 400 deep in the request pipeline.
 *
 * The error message deliberately does NOT echo the offending `field`
 * value (that's the defect the guard is preventing).
 */
const FIELD_PATTERN = /^[A-Za-z_][\w.]*$/

function assertValidField(field: string): void {
  if (!FIELD_PATTERN.test(field)) {
    throw new ConfigurationError(
      `ConnectFilter: field name must match ${FIELD_PATTERN.source} ` +
        '(letters, digits, underscore, dot; must start with a letter or underscore).',
    )
  }
}

/**
 * Fluent, immutable builder for Connect list params — composes
 * `field[operator]=value` filters, `sort[asc|desc]=field`, `_select=`,
 * and pagination (page / perPage).
 *
 * Every chainable method returns a new `ConnectFilter`; branch safely
 * without mutating shared state. Terminate with {@link toParams}.
 *
 * @example
 * ```ts
 * const params = new ConnectFilter()
 *   .where('city', 'is', ['New York', 'Seattle'])
 *   .where('status', 'not', ['deny', 'cancelled'])
 *   .where('arrival_date', 'before', '2024-02-01')
 *   .sortDesc('arrival_date')
 *   .select('id', 'arrival_date', 'financials.host')
 *   .perPage(50)
 *   .toParams()
 *
 * await connect.reservations.listByCustomer(customerId, params)
 * ```
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class ConnectFilter {
  private readonly state: Record<string, string>

  constructor(state: Record<string, string> = {}) {
    this.state = state
  }

  /**
   * Add a filter. Operator determines how `value` is stringified:
   * `is` / `not` join arrays with commas; `between` requires exactly
   * two values; every other operator takes a single value.
   *
   * @throws {ConfigurationError} when the value shape doesn't match the operator
   */
  where(
    field: string,
    operator: ConnectFilterOperator,
    value: string | number | boolean | Array<string | number | boolean>,
  ): ConnectFilter {
    assertValidField(field)

    const stringified = Array.isArray(value)
      ? value.map(v => String(v)).join(',')
      : String(value)

    if (operator === 'between') {
      const parts = Array.isArray(value) ? value : String(value).split(',')
      if (parts.length !== 2) {
        throw new ConfigurationError(
          'ConnectFilter.where: `between` requires exactly two values. ' +
            `Got ${parts.length}. Example: .where('amount', 'between', [100, 500]).`,
        )
      }
    } else if (MULTI_VALUE_OPS.has(operator)) {
      if (Array.isArray(value) && value.length === 0) {
        throw new ConfigurationError(
          `ConnectFilter.where: \`${operator}\` requires at least one value. ` +
            'Empty arrays cause the API to reject the request.',
        )
      }
    } else if (SINGLE_VALUE_OPS.has(operator)) {
      if (Array.isArray(value)) {
        throw new ConfigurationError(
          `ConnectFilter.where: \`${operator}\` takes a single value — received an array. ` +
            `Example: .where('<field>', '${operator}', '2024-02-01').`,
        )
      }
    }

    // Comma is the multi-value delimiter on `is`, `not`, and `between`.
    // A value containing a literal comma (e.g. 'San Francisco, CA') would
    // silently split into two values when the API parses the query string,
    // so reject it up front rather than producing an ambiguous filter.
    if (Array.isArray(value) && (MULTI_VALUE_OPS.has(operator) || operator === 'between')) {
      for (const v of value) {
        if (typeof v === 'string' && v.includes(',')) {
          throw new ConfigurationError(
            `ConnectFilter.where: \`${operator}\` values cannot contain commas — ` +
              'comma is the multi-value delimiter in the Connect query syntax. ' +
              'Split the value into separate filters or normalize it before passing.',
          )
        }
      }
    }

    return new ConnectFilter({
      ...this.state,
      [`${field}[${operator}]`]: stringified,
    })
  }

  /** Sort ascending by `field`. Replaces any prior sort. */
  sortAsc(field: string): ConnectFilter {
    assertValidField(field)
    const next = this.stripSort()
    next[`sort[asc]`] = field
    return new ConnectFilter(next)
  }

  /** Sort descending by `field`. Replaces any prior sort. */
  sortDesc(field: string): ConnectFilter {
    assertValidField(field)
    const next = this.stripSort()
    next[`sort[desc]`] = field
    return new ConnectFilter(next)
  }

  /** Shortcut for `sort=latest` — sorts by record creation time, newest first. */
  sortLatest(): ConnectFilter {
    const next = this.stripSort()
    next['sort'] = 'latest'
    return new ConnectFilter(next)
  }

  /** Shortcut for `sort=oldest` — sorts by record creation time, oldest first. */
  sortOldest(): ConnectFilter {
    const next = this.stripSort()
    next['sort'] = 'oldest'
    return new ConnectFilter(next)
  }

  /** Request only a subset of response fields via `_select=a,b,c`. */
  select(...fields: string[]): ConnectFilter {
    if (fields.length === 0) return this
    fields.forEach(assertValidField)
    return new ConnectFilter({ ...this.state, _select: fields.join(',') })
  }

  page(n: number): ConnectFilter {
    return new ConnectFilter({ ...this.state, page: String(n) })
  }

  perPage(n: number): ConnectFilter {
    return new ConnectFilter({ ...this.state, per_page: String(n) })
  }

  /** Materialize the filter into a plain params record. */
  toParams(): Record<string, string> {
    return { ...this.state }
  }

  private stripSort(): Record<string, string> {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(this.state)) {
      if (k === 'sort' || k === 'sort[asc]' || k === 'sort[desc]') continue
      next[k] = v
    }
    return next
  }
}
