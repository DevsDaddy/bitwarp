/**
 * BitWarp Networking Format Utils
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/**
 * Date formatting options
 */
interface FormatDateOptions {
  locale ? : string;
  customTokens?: Record<string, (date: Date, locale?: string) => string>;
}

/**
 * Export format utils
 */
export class FormatUtils {
  /**
   * Get ranged value
   * @param value {number} current value
   * @param from {number} from
   * @param to {number} to
   * @returns {number} Ranged value
   */
  public static range(value : number, from ? : number, to ? : number) : number {
    // Basic checks
    if(!from && !to) throw new RangeError("Invalid range");
    if(from && to && to <= from) throw new RangeError("Invalid range");
    if(from && to && from >= to) throw new RangeError("Invalid range");

    // Crop values
    if(from && value < from) value = from;
    if(to && value > to) value = to;
    return value;
  }

  /**
   * Format date
   * @param dateInput {Date|string|number} Date input
   * @param mask {string} Mask (for example: "{{dd}}.{{mm}}.{{YYYY}} {{HH}}:{{ii}}:{{ss}}"
   * @param options {FormatDateOptions} Date formatting options
   * @returns {string} Formatted date
   */
  public static formatDate(
    dateInput: Date | string | number,
    mask: string,
    options: FormatDateOptions = {}
  ): string {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }

    const { locale = 'default', customTokens = {} } = options;

    // Built-in tokens
    const builtInTokens: Record<string, (date: Date, locale?: string) => string> = {
      // Day
      dd: (d) => d.getDate().toString().padStart(2, '0'),
      d: (d) => d.getDate().toString(),

      // Month
      mm: (d) => (d.getMonth() + 1).toString().padStart(2, '0'),
      m: (d) => (d.getMonth() + 1).toString(),
      MMM: (d, loc) =>
        new Intl.DateTimeFormat(loc, { month: 'short' }).format(d),
      MMMM: (d, loc) =>
        new Intl.DateTimeFormat(loc, { month: 'long' }).format(d),

      // Year
      YYYY: (d) => d.getFullYear().toString(),
      YY: (d) => d.getFullYear().toString().slice(-2),

      // Hours
      HH: (d) => d.getHours().toString().padStart(2, '0'),
      H: (d) => d.getHours().toString(),

      // Minutes
      ii: (d) => d.getMinutes().toString().padStart(2, '0'),
      i: (d) => d.getMinutes().toString(),

      // Seconds
      ss: (d) => d.getSeconds().toString().padStart(2, '0'),
      s: (d) => d.getSeconds().toString(),

      // Day of week
      ddd: (d, loc) =>
        new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d),
      dddd: (d, loc) =>
        new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(d),
    };

    // Join built-in and user tokens
    const allTokens = { ...builtInTokens, ...customTokens };

    // Replace by mask {{tokenName}}
    return mask.replace(/\{\{([^}]+)\}\}/g, (_, tokenName: string) => {
      const formatter = allTokens[tokenName];
      if (!formatter) {
        return `{{${tokenName}}}`;
      }
      return formatter(date, locale);
    });
  }
}