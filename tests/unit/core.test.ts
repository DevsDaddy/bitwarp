/**
 * BitWarp Networking core tests
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
import { Color, RGBValue } from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Core Tests', () => {
  // Tested types
  let color : Color;

  beforeAll(() => {
    color = new Color(new RGBValue(255,0,0));
  })

  // Test color type
  it('Should be right color', () => {
    expect(color instanceof Color).to.be.true;
  })
  it('Color to HEX conversion', ()=> {
    let hexColor = color.toHEX();
    expect(hexColor).toMatch("#ff0000");
  })
  it('Color to string conversion', ()=> {
    let stringColor = color.toString(":");
    expect(stringColor).toMatch("255:0:0");
  })
  it('Color to object conversion', ()=> {
    let objectColor = color.toObject();
    expect(objectColor).toMatchObject({ red: 255, green: 0, blue: 0 });
  })
  it('String to Color conversion', ()=> {
    let stringColor = "255:0:0";
    expect(Color.fromString(stringColor, ":") as Color).toMatchObject(color);
  })
  it('HEX to Color conversion', ()=> {
    let hexColor = "#ff0000";
    expect(Color.fromString(hexColor)).toMatchObject(color);
  })
  it('JSON to Color conversion', ()=> {
    let jsonColor = JSON.stringify({ red: 255, green: 0, blue: 0 });
    expect(Color.fromJSON(jsonColor)).toMatchObject(color);
  })

});