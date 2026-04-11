/**
 * BitWarp Networking utils tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { describe, it, expect } from 'vitest';
import { FormatUtils, ParseUtils } from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Utils Tests', () => {
  // Format Utils
  it('Range min test', ()=> {
    let num = 100;
    expect(FormatUtils.range(num, 0, 50)).to.eq(50);
  });
  it('Range max test', ()=> {
    let num = 1;
    expect(FormatUtils.range(num, 10, 50)).to.eq(10);
  });
  it('Date format test', ()=> {
    let date = new Date("04.11.2026");
    expect(FormatUtils.formatDate(date, "{{dd}}.{{mm}}.{{YYYY}}")).toMatch("11.04.2026");
  })

  // Parse Utils
  it('Parse boolean test', ()=> {
    let sbool = "true";
    expect(ParseUtils.bool(sbool)).to.eq(true);
  })
});