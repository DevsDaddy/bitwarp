/**
 * BitWarp Networking Parsing Utils
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1001
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               21.04.2026
 */
import { FormatUtils } from './format';

/**
 * Parsing Utils
 */
export class ParseUtils {
  /**
   * Parse boolean
   * @param bool {string|number} Boolean as string or as number
   * @returns {boolean}
   */
  public static bool(bool : string | number) : boolean {
    if(typeof bool === "string") return (bool.toLowerCase() === "true");
    return FormatUtils.range(bool, 0, 1) === 1;
  }

  /**
   * Parse BigIng
   * @param input {number | boolean | bigint | string} Input Number
   * @returns {BigInt} Output BigInt
   */
  public static bigInt(input : number | boolean | bigint | string) : BigInt {
    return BigInt(input);
  }

  /**
   * Parse number
   * @param input {any} Input number
   * @returns {number} Output converted number (float64)
   */
  public static number(input : any) : number{
    return Number(input);
  }

}