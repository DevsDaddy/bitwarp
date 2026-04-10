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
}