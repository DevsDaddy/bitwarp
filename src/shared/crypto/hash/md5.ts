/**
 * BitWarp Networking MD5 Hash Provider
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { IHashProvider } from '../../proto/crypto';

/**
 * MD5 Hash implementation
 */
export class MD5 implements IHashProvider {
  // Current Text
  private text : string = '';

  /**
   * MD5
   * @param {string} text Text to Hash
   */
  constructor(text : string) {
    if (!text) text = ''
    this.text = unescape(encodeURIComponent(text))
  }

  /**
   * Get MD5 Hash as HEX String
   * @returns {string} MD5 Hash
   */
  public GetHEX() : string {
    let self = this
    return self.M(self.V(self.Y(self.X(self.text), 8 * self.text.length))).toLowerCase()
  }

  /**
   * Get MD5 Hash for string
   * @param text {text} Text for MD5
   * @returns {string} HEX string
   */
  public static hash(text : string) : string {
    let md5 = new MD5(text);
    return md5.GetHEX();
  }

  private M(d : any) : any {
    let _ : any, m: string, f: string, r: number;
    for (_ = '0123456789ABCDEF', m = '0123456789ABCDEF', f = '', r = 0; r < d.length; r++)
      ((_ = d.charCodeAt(r)), (f += m.charAt((_ >>> 4) & 15) + m.charAt(15 & _)))
    return f
  }

  private X(d : any) : any[] {
    let _ : any, m : number;
    for (_ = Array(d.length >> 2), m = 0; m < _.length; m++) _[m] = 0
    for (m = 0; m < 8 * d.length; m += 8) _[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32
    return _
  }

  private V(d : any) : any {
    let _ : string, m : number;
    for (_ = '', m = 0; m < 32 * d.length; m += 8)
      _ += String.fromCharCode((d[m >> 5] >>> m % 32) & 255)
    return _
  }

  private Y(d : any, _ : any) {
    let self = this
    ;((d[_ >> 5] |= 128 << _ % 32), (d[14 + (((_ + 64) >>> 9) << 4)] = _))

    let m : number, f : number,r : number ,i : number, n : number;
    for (
      m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0;
      n < d.length;
      n += 16
    ) {
      let h = m,
        t = f,
        g = r,
        e = i
      ;((f = self.md5_ii(
        (f = self.md5_ii(
          (f = self.md5_ii(
            (f = self.md5_ii(
              (f = self.md5_hh(
                (f = self.md5_hh(
                  (f = self.md5_hh(
                    (f = self.md5_hh(
                      (f = self.md5_gg(
                        (f = self.md5_gg(
                          (f = self.md5_gg(
                            (f = self.md5_gg(
                              (f = self.md5_ff(
                                (f = self.md5_ff(
                                  (f = self.md5_ff(
                                    (f = self.md5_ff(
                                      f,
                                      (r = self.md5_ff(
                                        r,
                                        (i = self.md5_ff(
                                          i,
                                          (m = self.md5_ff(m, f, r, i, d[n + 0], 7, -680876936)),
                                          f,
                                          r,
                                          d[n + 1],
                                          12,
                                          -389564586,
                                        )),
                                        m,
                                        f,
                                        d[n + 2],
                                        17,
                                        606105819,
                                      )),
                                      i,
                                      m,
                                      d[n + 3],
                                      22,
                                      -1044525330,
                                    )),
                                    (r = self.md5_ff(
                                      r,
                                      (i = self.md5_ff(
                                        i,
                                        (m = self.md5_ff(m, f, r, i, d[n + 4], 7, -176418897)),
                                        f,
                                        r,
                                        d[n + 5],
                                        12,
                                        1200080426,
                                      )),
                                      m,
                                      f,
                                      d[n + 6],
                                      17,
                                      -1473231341,
                                    )),
                                    i,
                                    m,
                                    d[n + 7],
                                    22,
                                    -45705983,
                                  )),
                                  (r = self.md5_ff(
                                    r,
                                    (i = self.md5_ff(
                                      i,
                                      (m = self.md5_ff(m, f, r, i, d[n + 8], 7, 1770035416)),
                                      f,
                                      r,
                                      d[n + 9],
                                      12,
                                      -1958414417,
                                    )),
                                    m,
                                    f,
                                    d[n + 10],
                                    17,
                                    -42063,
                                  )),
                                  i,
                                  m,
                                  d[n + 11],
                                  22,
                                  -1990404162,
                                )),
                                (r = self.md5_ff(
                                  r,
                                  (i = self.md5_ff(
                                    i,
                                    (m = self.md5_ff(m, f, r, i, d[n + 12], 7, 1804603682)),
                                    f,
                                    r,
                                    d[n + 13],
                                    12,
                                    -40341101,
                                  )),
                                  m,
                                  f,
                                  d[n + 14],
                                  17,
                                  -1502002290,
                                )),
                                i,
                                m,
                                d[n + 15],
                                22,
                                1236535329,
                              )),
                              (r = self.md5_gg(
                                r,
                                (i = self.md5_gg(
                                  i,
                                  (m = self.md5_gg(m, f, r, i, d[n + 1], 5, -165796510)),
                                  f,
                                  r,
                                  d[n + 6],
                                  9,
                                  -1069501632,
                                )),
                                m,
                                f,
                                d[n + 11],
                                14,
                                643717713,
                              )),
                              i,
                              m,
                              d[n + 0],
                              20,
                              -373897302,
                            )),
                            (r = self.md5_gg(
                              r,
                              (i = self.md5_gg(
                                i,
                                (m = self.md5_gg(m, f, r, i, d[n + 5], 5, -701558691)),
                                f,
                                r,
                                d[n + 10],
                                9,
                                38016083,
                              )),
                              m,
                              f,
                              d[n + 15],
                              14,
                              -660478335,
                            )),
                            i,
                            m,
                            d[n + 4],
                            20,
                            -405537848,
                          )),
                          (r = self.md5_gg(
                            r,
                            (i = self.md5_gg(
                              i,
                              (m = self.md5_gg(m, f, r, i, d[n + 9], 5, 568446438)),
                              f,
                              r,
                              d[n + 14],
                              9,
                              -1019803690,
                            )),
                            m,
                            f,
                            d[n + 3],
                            14,
                            -187363961,
                          )),
                          i,
                          m,
                          d[n + 8],
                          20,
                          1163531501,
                        )),
                        (r = self.md5_gg(
                          r,
                          (i = self.md5_gg(
                            i,
                            (m = self.md5_gg(m, f, r, i, d[n + 13], 5, -1444681467)),
                            f,
                            r,
                            d[n + 2],
                            9,
                            -51403784,
                          )),
                          m,
                          f,
                          d[n + 7],
                          14,
                          1735328473,
                        )),
                        i,
                        m,
                        d[n + 12],
                        20,
                        -1926607734,
                      )),
                      (r = self.md5_hh(
                        r,
                        (i = self.md5_hh(
                          i,
                          (m = self.md5_hh(m, f, r, i, d[n + 5], 4, -378558)),
                          f,
                          r,
                          d[n + 8],
                          11,
                          -2022574463,
                        )),
                        m,
                        f,
                        d[n + 11],
                        16,
                        1839030562,
                      )),
                      i,
                      m,
                      d[n + 14],
                      23,
                      -35309556,
                    )),
                    (r = self.md5_hh(
                      r,
                      (i = self.md5_hh(
                        i,
                        (m = self.md5_hh(m, f, r, i, d[n + 1], 4, -1530992060)),
                        f,
                        r,
                        d[n + 4],
                        11,
                        1272893353,
                      )),
                      m,
                      f,
                      d[n + 7],
                      16,
                      -155497632,
                    )),
                    i,
                    m,
                    d[n + 10],
                    23,
                    -1094730640,
                  )),
                  (r = self.md5_hh(
                    r,
                    (i = self.md5_hh(
                      i,
                      (m = self.md5_hh(m, f, r, i, d[n + 13], 4, 681279174)),
                      f,
                      r,
                      d[n + 0],
                      11,
                      -358537222,
                    )),
                    m,
                    f,
                    d[n + 3],
                    16,
                    -722521979,
                  )),
                  i,
                  m,
                  d[n + 6],
                  23,
                  76029189,
                )),
                (r = self.md5_hh(
                  r,
                  (i = self.md5_hh(
                    i,
                    (m = self.md5_hh(m, f, r, i, d[n + 9], 4, -640364487)),
                    f,
                    r,
                    d[n + 12],
                    11,
                    -421815835,
                  )),
                  m,
                  f,
                  d[n + 15],
                  16,
                  530742520,
                )),
                i,
                m,
                d[n + 2],
                23,
                -995338651,
              )),
              (r = self.md5_ii(
                r,
                (i = self.md5_ii(
                  i,
                  (m = self.md5_ii(m, f, r, i, d[n + 0], 6, -198630844)),
                  f,
                  r,
                  d[n + 7],
                  10,
                  1126891415,
                )),
                m,
                f,
                d[n + 14],
                15,
                -1416354905,
              )),
              i,
              m,
              d[n + 5],
              21,
              -57434055,
            )),
            (r = self.md5_ii(
              r,
              (i = self.md5_ii(
                i,
                (m = self.md5_ii(m, f, r, i, d[n + 12], 6, 1700485571)),
                f,
                r,
                d[n + 3],
                10,
                -1894986606,
              )),
              m,
              f,
              d[n + 10],
              15,
              -1051523,
            )),
            i,
            m,
            d[n + 1],
            21,
            -2054922799,
          )),
          (r = self.md5_ii(
            r,
            (i = self.md5_ii(
              i,
              (m = self.md5_ii(m, f, r, i, d[n + 8], 6, 1873313359)),
              f,
              r,
              d[n + 15],
              10,
              -30611744,
            )),
            m,
            f,
            d[n + 6],
            15,
            -1560198380,
          )),
          i,
          m,
          d[n + 13],
          21,
          1309151649,
        )),
        (r = self.md5_ii(
          r,
          (i = self.md5_ii(
            i,
            (m = self.md5_ii(m, f, r, i, d[n + 4], 6, -145523070)),
            f,
            r,
            d[n + 11],
            10,
            -1120210379,
          )),
          m,
          f,
          d[n + 2],
          15,
          718787259,
        )),
        i,
        m,
        d[n + 9],
        21,
        -343485551,
      )),
        (m = self.safe_add(m, h)),
        (f = self.safe_add(f, t)),
        (r = self.safe_add(r, g)),
        (i = self.safe_add(i, e)))
    }
    return Array(m, f, r, i)
  }

  private md5_cmn(d  : any, _ : any, m : any, f : any, r : any, i : any) {
    let self = this
    return self.safe_add(
      self.bit_rol(self.safe_add(self.safe_add(_, d), self.safe_add(f, i)), r),
      m,
    )
  }

  private md5_ff(d  : any, _ : any, m : any, f : any, r : any, i : any, n : any) {
    let self = this
    return self.md5_cmn((_ & m) | (~_ & f), d, _, r, i, n)
  }

  private md5_gg(d : any, _ : any, m : any, f : any, r : any, i : any, n : any) {
    let self = this
    return self.md5_cmn((_ & f) | (m & ~f), d, _, r, i, n)
  }

  private md5_hh(d: any, _ : any, m : any, f : any, r : any, i : any, n : any) {
    let self = this
    return self.md5_cmn(_ ^ m ^ f, d, _, r, i, n)
  }

  private md5_ii(d : any, _ : any, m : any, f : any, r : any, i : any, n : any) {
    let self = this
    return self.md5_cmn(m ^ (_ | ~f), d, _, r, i, n)
  }

  private safe_add(d : any, _ : any) {
    let m = (65535 & d) + (65535 & _)
    return (((d >> 16) + (_ >> 16) + (m >> 16)) << 16) | (65535 & m)
  }

  private bit_rol(d : any, _ : any) {
    return (d << _) | (d >>> (32 - _))
  }
}