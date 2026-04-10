/**
 * BitWarp Networking Color Type
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
import { FormatUtils } from '../utils/format';
import { ErrorHandler } from './handlers';

/**
 * RGB Interface
 */
export interface IRGB {
  red ? : number;
  green ? : number;
  blue ? : number;

  toString(separator ? : string) : string;
}

/**
 * RGBA interface
 */
export interface IRGBA {
  alpha ? : number;
}

/**
 * RGB Value
 */
export class RGBValue implements IRGB {
  private r : number = 0;
  private g : number = 0;
  private b : number = 0;

  /**
   * Create new RGB value
   * @param red {number} Ranged value from 0 to 255
   * @param green {number} Ranged value from 0 to 255
   * @param blue {number} Ranged value from 0 to 255
   */
  constructor(red? : number, green? : number, blue? : number) {
    if(red) this.red = red;
    if(green) this.green = green;
    if(blue) this.blue = blue;
  }

  // Color values
  public get red() : number { return this.r; }
  public get green() : number { return this.g; }
  public get blue() : number { return this.b; }

  // Set color value
  public set red(value: number) { this.r = FormatUtils.range(value, 0, 255); }
  public set green (value: number) { this.g = FormatUtils.range(value, 0, 255); }
  public set blue(value: number) { this.b = FormatUtils.range(value, 0, 255); }

  /**
   * Convert RGB to string
   * @param separator {string} Separator (by-default is ",")
   * @returns {string} RGB string (for example: "255,255,0")
   */
  public toString(separator?: string): string {
    if(!separator) separator = ",";
    return `${this.red}${separator}${this.green}${separator}${this.blue}`;
  }
}

/**
 * RGBA Value
 */
export class RGBAValue extends RGBValue implements IRGBA {
  private a : number = 1;

  /**
   * Create new RGBA Value
   * @param red {number} Ranged value from 0 to 255
   * @param green {number} Ranged value from 0 to 255
   * @param blue {number} Ranged value from 0 to 255
   * @param alpha {number} Ranged value from 0 to 255
   */
  constructor(red? : number, green? : number, blue? : number, alpha? : number) {
    super(red, green, blue);
    if (alpha) this.alpha = alpha;
  }

  // Get Alpha Value
  public get alpha() : number { return this.a; }

  // Set Alpha Value
  public set alpha(value: number) { this.a = FormatUtils.range(value, 0, 1); }

  /**
   * Convert RGBA to string
   * @param separator {string} Separator (by-default is ",")
   * @returns {string} RGBA string (for example: "255,255,0,0.25")
   */
  public override toString(separator?: string): string {
    if(!separator) separator = ",";
    return `${this.red}${separator}${this.green}${separator}${this.blue}${separator}${this.alpha}`;
  }
}

/**
 * Color class
 */
export class Color {
  private readonly current : RGBValue | RGBAValue;

  /**
   * Create Color
   * @param initial {RGBValue|RGBAValue} Color Value
   */
  constructor(initial ? : RGBValue | RGBAValue) {
    this.current = initial ? initial : new RGBAValue();
  }

  // Color Fields
  public get red() : number { return this.current.red; }
  public get green() : number { return this.current.green; }
  public get blue() : number { return this.current.blue; }
  public set red(value: number) { this.current.red = value; }
  public set green (value: number) { this.current.green = value; }
  public set blue(value: number) { this.current.blue = value; }

  /**
   * Convert color to string
   * @param separator {string} Separator (by-defaults ",")
   * @returns {string} Returns color string (for example: "255,255,225,0.5")
   */
  public toString(separator : string = ",") : string {
    return this.current.toString(separator);
  }

  /**
   * Convert color to HEX string
   * @returns {string} HEX string
   */
  public toHEX() : string {
    const toHex = (c: number) => {
      const hex = Math.max(0, Math.min(255, c)).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(this.current.red)}${toHex(this.current.green)}${toHex(this.current.blue)}${(this.current instanceof RGBAValue) ? toHex(Math.round(this.current.alpha * 255)) : ""}`;
  }

  /**
   * Convert Color to JSON string
   * @returns {string} JSON string color
   */
  public toJSON() : string {
    return JSON.stringify(this.toObject())
  }

  /**
   * Convert color to simplified object
   * @returns { { red: number, green: number, blue: number, alpha ? : number } } RGB / RGBA Color simplified object
   */
  public toObject() : { red: number, green: number, blue: number, alpha ? : number } {
    return {
      red: this.current.red,
      green: this.current.green,
      blue: this.current.blue,
      ...(this.current instanceof RGBAValue && { alpha: this.current.alpha })
    }
  }

  /**
   * Convert color from string / HEX string
   * @param color {string} Color (string / HEX string)
   * @param separator {string} Color separator (for non-hex)
   * @returns {Color} Returns new Color
   */
  public static fromString(color : string, separator: string = ",") : Color {
    // To lower case for beginning
    color = color.toLowerCase();

    // Try to parse HEX
    let isHEX = color.startsWith("#");
    if (isHEX) {
      let c : any = color.slice(1);
      if (c.length === 3) c = c.split('').map((char: string) => char + char).join('');
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      let a : number | null = null;
      if (c.length === 8) {
        a = parseInt(c.substring(6, 8), 16) / 255;
      }

      // Return Color
      return new Color((a) ? new RGBAValue(r ?? 0, g ?? 0, b ?? 0, a ?? 0) : new RGBValue(r ?? 0, g ?? 0, b ?? 0));
    }

    // Or parse from string
    let isRGBA : boolean | null = null;
    if(color.startsWith("rgb")) {
      isRGBA = false;
      color.replace("rgb(", "");
      color.replace(")", "");
    }else if(color.startsWith("rgba")) {
      isRGBA = false;
      color.replace("rgba(", "");
      color.replace(")", "");
    }

    // Try to parse array
    let parsedArray : string[] = color.split(separator);
    let red : number | null = parseInt(parsedArray?.[0]) ?? null;
    let green : number | null = parseInt(parsedArray?.[1]) ?? null;
    let blue : number | null = parseInt(parsedArray?.[2]) ?? null;
    let alpha : number | null = parseInt(parsedArray?.[3]) ?? null;

    // Return Color
    return new Color((alpha) ? new RGBAValue(red ?? 0, green ?? 0, blue ?? 0, alpha ?? 0) : new RGBValue(red ?? 0, green ?? 0, blue ?? 0));
  }

  /**
   * From JSON
   * @param jsonColor {string} JSON string color
   * @returns {Color} Returns new Color
   */
  public static fromJSON(jsonColor : string) : Color {
    return this.parse(jsonColor);
  }

  /**
   * Trying to parse color from any string / json string / object / HEX string
   * @param color {any} Color
   * @returns {Color} Returns new Color
   */
  public static parse(color : any) : Color {
    // Basic types
    if(color instanceof Color) return color;
    if(color instanceof RGBValue || color instanceof RGBAValue) return new Color(color);
    if(typeof color === 'string') {
      if(color.startsWith("{") && color.endsWith("}")) color = JSON.parse(color)
      else return this.fromString(color);
    }

    // Parsing known inner fields
    if(color?.RGB && typeof color?.RGB === "string") return this.fromString(color?.RGB);
    if(color?.rgb && typeof color?.rgb === "string") return this.fromString(color?.rgb);
    if(color?.RGBA && typeof color?.RGBA === "string") return this.fromString(color?.RGBA);
    if(color?.rgba && typeof color?.rgba === "string") return this.fromString(color?.rgba);
    if(color?.hex && typeof color?.hex === "string") return this.fromString(color?.hex);
    if(color?.HEX && typeof color?.HEX === "string") return this.fromString(color?.HEX);

    // Parse color values
    let red : number | null = color?.r ?? color?.R ?? color?.red ?? color?.Red ?? color?.RED ?? null;
    let green : number | null = color?.g ?? color?.G ?? color?.green ?? color?.Green ?? color?.GREEN ?? null;
    let blue : number | null = color?.b ?? color?.B ?? color?.blue ?? color?.Blue ?? color?.BLUE ?? null;
    let alpha : number | null = color?.a ?? color?.A ?? color?.alpha ?? color?.Alpha ?? color?.ALPHA ?? null;
    return (alpha) ? new Color(new RGBAValue(red ?? 0, green ?? 0, blue ?? 0, alpha ?? 0)) : new Color(new RGBValue(red ?? 0, green ?? 0, blue ?? 0))
  }
}